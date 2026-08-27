import { randomUUID } from 'crypto';
import Stream from './streamModel.js';
import Store from '../stores/storeModel.js';

// ── Daily.co helpers ─────────────────────────────────────────────────────────

const DAILY_BASE = 'https://api.daily.co/v1';

async function dailyFetch(path, options = {}) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error('DAILY_API_KEY is not configured');

  const res = await fetch(`${DAILY_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily.co API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function createDailyRoom(roomName) {
  const exp = Math.floor(Date.now() / 1000) + 7200; // 2 h
  return dailyFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: roomName,
      privacy: 'public',
      properties: { exp },
    }),
  });
}

async function createMeetingToken(roomName, isOwner = false) {
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const data = await dailyFetch('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: { room_name: roomName, is_owner: isOwner, exp },
    }),
  });
  return data.token;
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/streams
 * Broadcaster creates a new live stream room.
 * Requires: auth, store must be owned by user and verified.
 */
export const createStream = async (req, res) => {
  const { storeId, title = '', productIds } = req.body;

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

  // Create a Daily.co room
  const roomName = `chingiringi-${randomUUID()}`;
  const room = await createDailyRoom(roomName);
  const broadcasterToken = await createMeetingToken(roomName, true);

  // Persist the stream doc
  // productIds (from GoLiveModal's "Feature Products" picker) — cap matches
  // the picker's own fetch limit (30) so a malformed payload can't grow this
  // unbounded.
  const stream = await Stream.create({
    storeId,
    ownerId:       req.user._id,
    dailyRoomName: room.name,
    dailyRoomUrl:  room.url,
    title:         title.slice(0, 120),
    status:        'live',
    startedAt:     new Date(),
    products:      Array.isArray(productIds) ? productIds.slice(0, 30) : [],
  });

  // Mark store as live
  await Store.findByIdAndUpdate(storeId, { isLive: true });

  res.status(201).json({
    status: 'success',
    data: {
      streamId:         stream._id,
      broadcasterToken,
      roomUrl:          room.url,
      dailyRoomName:    room.name,
    },
  });
};

/**
 * POST /api/streams/:id/viewer-token
 * Viewer requests a token to join an active stream.
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

  const token = await createMeetingToken(stream.dailyRoomName, false);

  res.status(200).json({
    status: 'success',
    data: {
      viewerToken: token,
      roomUrl:     stream.dailyRoomUrl,
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
