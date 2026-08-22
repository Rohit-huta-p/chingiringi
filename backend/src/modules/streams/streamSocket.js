import Stream from './streamModel.js';

// Per-room heart burst accumulator (resets every 2 s)
const heartCounters = new Map(); // roomKey → { count, timer }

/**
 * Attach all /stream namespace socket handlers.
 * @param {import('socket.io').Namespace} ns
 */
export function attachStreamSocket(ns) {
  ns.on('connection', (socket) => {
    const user = socket.data.user;

    // ── join_stream ────────────────────────────────────────────────────────
    socket.on('join_stream', async ({ streamId } = {}) => {
      if (!streamId) return;
      const room = `stream:${streamId}`;
      socket.join(room);
      socket.data.currentRoom = room;
      socket.data.currentStreamId = streamId;

      try {
        const stream = await Stream.findByIdAndUpdate(
          streamId,
          { $inc: { viewerCount: 1 } },
          { new: true }
        );
        if (stream) {
          ns.to(room).emit('viewer_count_update', {
            streamId,
            count: stream.viewerCount,
          });
        }
      } catch (err) {
        console.error('[socket] join_stream DB error:', err.message);
      }
    });

    // ── leave_stream ───────────────────────────────────────────────────────
    socket.on('leave_stream', async ({ streamId } = {}) => {
      if (!streamId) return;
      await _leaveStream(socket, ns, streamId);
    });

    // ── heart_reaction ─────────────────────────────────────────────────────
    socket.on('heart_reaction', ({ streamId } = {}) => {
      if (!streamId) return;
      const room = `stream:${streamId}`;
      const key = room;

      if (!heartCounters.has(key)) {
        // Start a burst window: accumulate for 500 ms then broadcast
        const timer = setTimeout(() => {
          const entry = heartCounters.get(key);
          if (entry) {
            ns.to(room).emit('heart_burst', { streamId, count: entry.count });
            heartCounters.delete(key);
          }
        }, 500);
        heartCounters.set(key, { count: 1, timer });
      } else {
        heartCounters.get(key).count += 1;
      }
    });

    // ── chat_message ───────────────────────────────────────────────────────
    socket.on('chat_message', ({ streamId, text } = {}) => {
      if (!streamId || typeof text !== 'string') return;
      const trimmed = text.trim().slice(0, 200);
      if (!trimmed) return;

      const room = `stream:${streamId}`;
      ns.to(room).emit('new_chat', {
        streamId,
        user: user?.name ?? 'Guest',
        text: trimmed,
        timestamp: Date.now(),
      });
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const streamId = socket.data.currentStreamId;
      if (streamId) {
        await _leaveStream(socket, ns, streamId);
      }
    });
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function _leaveStream(socket, ns, streamId) {
  const room = `stream:${streamId}`;
  socket.leave(room);
  socket.data.currentRoom = null;
  socket.data.currentStreamId = null;

  try {
    const stream = await Stream.findByIdAndUpdate(
      streamId,
      [{ $set: { viewerCount: { $max: [0, { $subtract: ['$viewerCount', 1] }] } } }],
      { new: true }
    );
    if (stream) {
      ns.to(room).emit('viewer_count_update', {
        streamId,
        count: stream.viewerCount,
      });
    }
  } catch (err) {
    console.error('[socket] leave_stream DB error:', err.message);
  }
}
