import Stream from './streamModel.js';
import Store from '../stores/storeModel.js';
import { Message } from '../chat/chatModel.js';
import * as mux from '../../services/muxVideo.js';

// Live video is Mux (RTMP ingest → HLS playback). The Mux helpers live in
// services/muxVideo.js and reuse the same Basic-auth token as the VOD provider.

// ── Past-stream analytics helpers ─────────────────────────────────────────────

// A buyer messaging the store within this window of a stream's end counts as a
// lead that stream generated (buyers often message right after it wraps).
const LEAD_GRACE_MS = 15 * 60 * 1000;

// Freeze the audience analytics when a stream ends: flush the final concurrency
// segment into viewerSeconds, then derive the time-weighted average + peak.
// Mutates the (non-lean) stream doc in place; caller saves.
const finalizeStreamMetrics = (stream) => {
  const endedAt = stream.endedAt || new Date();
  const startedAt = stream.startedAt || stream.createdAt || endedAt;
  const lastChange = stream.lastViewerChangeAt || startedAt;

  const segmentSecs = Math.max(0, (endedAt.getTime() - new Date(lastChange).getTime()) / 1000);
  stream.viewerSeconds = (stream.viewerSeconds || 0) + (stream.viewerCount || 0) * segmentSecs;

  const durationSecs = Math.max(1, (endedAt.getTime() - new Date(startedAt).getTime()) / 1000);
  stream.avgViewers = Math.round(stream.viewerSeconds / durationSecs);
  stream.peakViewers = Math.max(stream.peakViewers || 0, stream.viewerCount || 0);
  // NB: viewerCount (the live gauge) is left as-is, not zeroed — the shared
  // formatStreamMeta still reads it for older rows, and totalViews/avgViewers
  // are the authoritative post-stream figures now.
  stream.lastViewerChangeAt = endedAt;
};

// Enrich each (lean) stream with usersContacted = "leads generated": the count
// of DISTINCT buyers who messaged the store during that stream's live window
// [startedAt, endedAt + grace]. Messages carry no streamId, so we bucket buyer
// messages by window in JS after ONE aggregation for the whole page (a seller's
// streams rarely overlap in time, so each message lands in at most one window).
const attachLeadsGenerated = async (streams) => {
  for (const s of streams) s.usersContacted = 0; // default so the field is always present
  if (!streams.length) return;

  const storeIds = [
    ...new Map(
      streams.map((s) => {
        const id = s.storeId?._id || s.storeId;
        return [String(id), id];
      })
    ).values(),
  ];
  const minStart = new Date(Math.min(...streams.map((s) => new Date(s.startedAt || s.createdAt).getTime())));

  let rows = [];
  try {
    rows = await Message.aggregate([
      { $match: { senderRole: 'buyer', createdAt: { $gte: minStart } } },
      { $lookup: { from: 'conversations', localField: 'conversationId', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $match: { 'c.storeId': { $in: storeIds } } },
      { $project: { _id: 0, buyerId: '$c.buyerId', storeId: '$c.storeId', createdAt: 1 } },
    ]);
  } catch (err) {
    console.warn('[getMyStreams] leads aggregation failed:', err.message);
    return; // leave usersContacted at 0 rather than failing the whole list
  }

  for (const s of streams) {
    const storeId = String(s.storeId?._id || s.storeId);
    const start = new Date(s.startedAt || s.createdAt).getTime();
    const end = (s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) + LEAD_GRACE_MS;
    const buyers = new Set();
    for (const r of rows) {
      if (String(r.storeId) !== storeId) continue;
      const t = new Date(r.createdAt).getTime();
      if (t >= start && t <= end) buyers.add(String(r.buyerId));
    }
    s.usersContacted = buyers.size;
  }
};

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/streams
 * Broadcaster creates a new live stream room.
 * Requires: auth, store must be owned by user and verified.
 */
export const createStream = async (req, res) => {
  const { storeId, title = '', productIds, category, thumbnail } = req.body;

  if (!storeId) {
    res.status(400);
    throw new Error('storeId is required');
  }

  const store = await Store.findById(storeId);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  if (store.ownerId?.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You do not own this store');
  }

  if (store.verificationStatus !== 'verified') {
    res.status(403);
    throw new Error(
      `Store must be verified before going live (current status: ${store.verificationStatus})`
    );
  }

  // Create a Mux live stream (RTMP ingest + HLS playback).
  const live = await mux.createLiveStream({ passthrough: String(store._id) });

  // Persist the stream doc
  // productIds (from GoLiveModal's "Feature Products" picker) — cap matches
  // the picker's own fetch limit (30) so a malformed payload can't grow this
  // unbounded.
  const stream = await Stream.create({
    storeId,
    ownerId:       req.user._id,
    muxStreamId:   live.id,
    muxPlaybackId: live.playbackId,
    muxStreamKey:  live.streamKey,
    title:         title.slice(0, 120),
    category:      (category || '').slice(0, 40),
    thumbnail:     thumbnail || '',
    status:        'idle', // flips to 'live' only when RTMP actually connects (markStreamLive)
    products:      Array.isArray(productIds) ? productIds.slice(0, 30) : [],
  });

  // NOTE: stream.status + store.isLive flip to live in markStreamLive, once the
  // broadcaster's RTMP session connects — so a failed/aborted attempt never
  // appears in the live feed or the seller's past streams.

  res.status(201).json({
    status: 'success',
    data: {
      streamId:    stream._id,
      // Broadcaster RTMP credentials — consumed by the native publisher (M3).
      rtmpUrl:     live.rtmpsUrl,
      streamKey:   live.streamKey,
      // Viewer playback.
      playbackId:  live.playbackId,
      playbackUrl: mux.livePlaybackUrl(live.playbackId),
    },
  });
};

/**
 * POST /api/streams/:id/viewer-token
 * Returns HLS playback info for an active stream. Mux public playback needs no
 * per-viewer token — kept at this path for the existing client call.
 */
export const viewerToken = async (req, res) => {
  const stream = await Stream.findById(req.params.id).lean();
  if (!stream) {
    res.status(404);
    throw new Error('Stream not found');
  }
  if (stream.status !== 'live') {
    res.status(400);
    throw new Error('Stream is not live');
  }

  res.status(200).json({
    status: 'success',
    data: {
      playbackId:  stream.muxPlaybackId,
      playbackUrl: mux.livePlaybackUrl(stream.muxPlaybackId),
    },
  });
};

/**
 * POST /api/streams/:id/end
 * Broadcaster ends the stream.
 */
export const endStream = async (req, res) => {
  const stream = await Stream.findById(req.params.id);
  if (!stream) {
    res.status(404);
    throw new Error('Stream not found');
  }

  if (stream.ownerId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You do not own this stream');
  }

  stream.status  = 'ended';
  stream.endedAt = new Date();
  finalizeStreamMetrics(stream); // freeze avg/peak from the concurrency curve
  await stream.save();

  // Mark store offline
  await Store.findByIdAndUpdate(stream.storeId, { isLive: false });

  // Tell Mux the broadcast finished (finalizes the VOD recording). Best-effort.
  mux.completeLiveStream(stream.muxStreamId).catch(() => {});

  // Notify all viewers via Socket.io
  // Import `io` lazily to avoid circular dep at module load time
  try {
    const { io } = await import('../../server.js');
    io.of('/stream')
      .to(`stream:${stream._id}`)
      .emit('stream_ended', {
        streamId: stream._id.toString(),
        storeId:  stream.storeId.toString(),
      });
  } catch (err) {
    console.warn('[endStream] Could not emit stream_ended:', err.message);
  }

  res.status(200).json({ status: 'success', data: { ok: true } });
};

// @desc    Broadcaster confirms the RTMP session connected → flip idle → live.
//          Called from the app on onConnectionSuccess. Idempotent.
// @route   POST /api/streams/:id/live
// @access  Private (owner)
export const markStreamLive = async (req, res) => {
  const stream = await Stream.findById(req.params.id);
  if (!stream) { res.status(404); throw new Error('Stream not found'); }
  if (stream.ownerId.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('You do not own this stream');
  }
  if (stream.status === 'idle') {
    stream.status = 'live';
    stream.startedAt = new Date();
    await stream.save();
    await Store.findByIdAndUpdate(stream.storeId, { isLive: true });
  }
  res.status(200).json({ status: 'success', data: { ok: true } });
};

// @desc    Abort a stream that never went live (RTMP failed / seller backed out)
//          → delete it so it never lingers as a phantom or a past stream.
// @route   POST /api/streams/:id/abort
// @access  Private (owner)
export const abortStream = async (req, res) => {
  const stream = await Stream.findById(req.params.id);
  if (!stream) { res.status(200).json({ status: 'success', data: { ok: true } }); return; }
  if (stream.ownerId.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('You do not own this stream');
  }
  // Only a never-live stream is safe to delete; a live/ended one uses endStream.
  if (stream.status === 'idle') {
    mux.completeLiveStream(stream.muxStreamId).catch(() => {});
    await Stream.deleteOne({ _id: stream._id });
  }
  res.status(200).json({ status: 'success', data: { ok: true } });
};

// @desc    Mux live-stream webhook — confirms/cleans up stream status from the
//          real ingest lifecycle (active → live; idle → auto-end if the
//          broadcaster crashed / closed without pressing End). Complements the
//          app's markStreamLive; keeps DB state honest even if the app dies.
// @route   POST /api/webhooks/mux-live   (raw body — mounted before express.json)
// @access  Public (Mux; HMAC-verified)
export const muxLiveWebhook = async (req, res) => {
  if (!mux.verifyWebhook(req.body, req.headers)) {
    res.status(400);
    throw new Error('Invalid Mux webhook signature');
  }
  let payload = null;
  try { payload = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)); } catch { /* ignore */ }
  const evt = mux.parseLiveWebhook(payload);
  if (!evt) { res.status(200).json({ received: true }); return; }

  const stream = await Stream.findOne({ muxStreamId: evt.muxStreamId });
  if (!stream) { res.status(200).json({ received: true }); return; }

  if (evt.state === 'live' && stream.status === 'idle') {
    // Ingest actually started — promote to live.
    stream.status = 'live';
    await stream.save();
    await Store.findByIdAndUpdate(stream.storeId, { isLive: true });
  } else if (evt.state === 'ended' && stream.status === 'live') {
    // Reconnect window elapsed with no ingest — the broadcaster is gone.
    stream.status = 'ended';
    stream.endedAt = new Date();
    finalizeStreamMetrics(stream); // freeze avg/peak even on an abrupt end
    await stream.save();
    await Store.findByIdAndUpdate(stream.storeId, { isLive: false });
    mux.completeLiveStream(stream.muxStreamId).catch(() => {});
    try {
      const { io } = await import('../../server.js');
      io.of('/stream').to(`stream:${stream._id}`).emit('stream_ended', {
        streamId: stream._id.toString(),
        storeId:  stream.storeId.toString(),
      });
    } catch { /* socket layer optional */ }
  }

  res.status(200).json({ received: true });
};

/**
 * GET /api/streams/active
 * Public — returns live streams sorted by viewer count desc.
 */
export const getActiveStreams = async (req, res) => {
  let streams = await Stream.find({ status: 'live' })
    .populate('storeId', 'name shortName logoUrl category city')
    .sort({ viewerCount: -1 })
    .lean();

  // Reconcile against Mux — a stream is only truly live while Mux is receiving
  // ingest. End any whose ingest has stopped (broadcaster dropped or closed the
  // app without tapping End) so buyers don't see phantom lives. A short grace
  // window avoids ending a stream in the seconds before Mux registers ingest.
  const GRACE_MS = 45_000;
  const now = Date.now();
  const staleIds = [];
  await Promise.all(streams.map(async (s) => {
    if (!s.muxStreamId) return;
    const startedMs = new Date(s.startedAt || s.createdAt).getTime();
    if (now - startedMs < GRACE_MS) return; // too fresh — trust the DB
    const st = await mux.muxLiveStatus(s.muxStreamId);
    if (st && st !== 'active' && st !== 'connected') staleIds.push(s._id);
  }));
  if (staleIds.length) {
    const staleSet = new Set(staleIds.map(String));
    await Stream.updateMany({ _id: { $in: staleIds } }, { $set: { status: 'ended', endedAt: new Date() } });
    const staleStoreIds = streams
      .filter((s) => staleSet.has(String(s._id)))
      .map((s) => s.storeId?._id || s.storeId)
      .filter(Boolean);
    if (staleStoreIds.length) await Store.updateMany({ _id: { $in: staleStoreIds } }, { $set: { isLive: false } });
    streams = streams.filter((s) => !staleSet.has(String(s._id)));
  }

  res.status(200).json({ status: 'success', data: { streams } });
};

/**
 * GET /api/streams/:id
 * Public — single stream with store + featured products populated.
 * Used by ViewerScreen for the store header (tap → store profile) and the
 * Featured Products bar.
 */
export const getStream = async (req, res) => {
  const stream = await Stream.findById(req.params.id)
    .populate('storeId', 'name shortName logoUrl')
    .populate('products', 'name price mrp imageUrl images category')
    .lean();

  if (!stream) {
    res.status(404);
    throw new Error('Stream not found');
  }

  res.status(200).json({ status: 'success', data: { stream } });
};

/**
 * GET /api/streams/mine
 * Authenticated — the caller's own streams (live + ended), newest first.
 * Powers the seller Dashboard "Recent Streams" and Go Live "Previous streams".
 */
export const getMyStreams = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

  const streams = await Stream.find({ ownerId: req.user._id, status: { $ne: 'idle' } })
    .populate('storeId', 'name shortName logoUrl')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Derive "leads generated" per stream (buyers who messaged during its window).
  await attachLeadsGenerated(streams);

  res.status(200).json({ status: 'success', data: { streams } });
};
