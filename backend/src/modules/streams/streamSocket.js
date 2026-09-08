import Stream from './streamModel.js';

// Per-room heart burst accumulator (resets every 2 s)
const heartCounters = new Map(); // roomKey → { count, timer }

// One Riemann segment of the concurrency curve: add
// (current viewerCount × seconds since the last join/leave) to viewerSeconds,
// so the time-weighted average concurrency can be derived when the stream ends.
// Runs as the FIRST stage of the join/leave pipeline update — it reads the OLD
// viewerCount (the concurrency that held over the segment) before the next stage
// changes it. `$$NOW` + date subtraction keeps the whole update atomic and
// avoids a read-modify-write race under concurrent joins.
const accrueViewerSecondsStage = {
  $set: {
    viewerSeconds: {
      $add: [
        { $ifNull: ['$viewerSeconds', 0] },
        {
          $multiply: [
            { $ifNull: ['$viewerCount', 0] },
            {
              $divide: [
                {
                  $subtract: [
                    '$$NOW',
                    { $ifNull: ['$lastViewerChangeAt', { $ifNull: ['$startedAt', '$$NOW'] }] },
                  ],
                },
                1000,
              ],
            },
          ],
        },
      ],
    },
  },
};

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
        // Atomic pipeline: close the prior concurrency segment, then bump the
        // live gauge + the monotonic totalViews counter, then refresh peak.
        // Stages run in order and each sees the previous stage's output, so
        // peakViewers compares against the ALREADY-incremented viewerCount.
        const stream = await Stream.findByIdAndUpdate(
          streamId,
          [
            accrueViewerSecondsStage,
            {
              $set: {
                viewerCount: { $add: [{ $ifNull: ['$viewerCount', 0] }, 1] },
                totalViews: { $add: [{ $ifNull: ['$totalViews', 0] }, 1] },
                lastViewerChangeAt: '$$NOW',
              },
            },
            { $set: { peakViewers: { $max: [{ $ifNull: ['$peakViewers', 0] }, '$viewerCount'] } } },
          ],
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
    // Close the prior concurrency segment, then drop the live gauge by one
    // (clamped ≥ 0). totalViews/peakViewers are untouched — a leave never
    // reduces cumulative tune-ins or the peak.
    const stream = await Stream.findByIdAndUpdate(
      streamId,
      [
        accrueViewerSecondsStage,
        {
          $set: {
            viewerCount: { $max: [0, { $subtract: [{ $ifNull: ['$viewerCount', 0] }, 1] }] },
            lastViewerChangeAt: '$$NOW',
          },
        },
      ],
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
