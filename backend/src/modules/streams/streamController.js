import Stream from './streamModel.js';
import Store from '../stores/storeModel.js';
import * as mux from '../../services/muxVideo.js';

// Live video is Mux (RTMP ingest → HLS playback). The Mux helpers live in
// services/muxVideo.js and reuse the same Basic-auth token as the VOD provider.

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
    status:        'live',
    startedAt:     new Date(),
    products:      Array.isArray(productIds) ? productIds.slice(0, 30) : [],
  });

  // Mark store as live
  await Store.findByIdAndUpdate(storeId, { isLive: true });

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

// @desc    Mux live-stream webhook — confirms/cleans up stream status from the
//          real ingest lifecycle (active → live; idle → auto-end if the
//          broadcaster crashed / closed without pressing End). Optional: the
//          app already marks a stream live at createStream, so streaming works
//          without this wired; it just keeps DB state honest.
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
  const streams = await Stream.find({ status: 'live' })
    .populate('storeId', 'name shortName logoUrl category city')
    .sort({ viewerCount: -1 })
    .lean();

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
    .populate('products', 'name price mrp imageUrl images')
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

  res.status(200).json({ status: 'success', data: { streams } });
};
