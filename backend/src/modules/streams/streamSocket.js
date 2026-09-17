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
    socket.on('join_stream', async ({ streamId, countAsViewer = true } = {}) => {
      if (!streamId) return;
      const room = `stream:${streamId}`;
      socket.join(room);
      socket.data.currentRoom = room;
      socket.data.currentStreamId = streamId;
      // The broadcaster joins to receive hearts/chat/count but must NOT be
      // counted as a viewer of its own stream.
      socket.data.counted = countAsViewer !== false;

      try {
        if (!socket.data.counted) {
          // Non-viewer (broadcaster): don't increment — just send it the current
          // real count so its "watching" number is accurate (0 with no viewers).
          const s = await Stream.findById(streamId).select('viewerCount ownerId').lean();
          // Is this socket the stream's owner (the broadcaster)? Drives the
          // "Author" chat badge and gates message pinning.
          socket.data.isHost = !!(user && s && String(s.ownerId) === String(user._id));
          socket.emit('viewer_count_update', { streamId, count: s?.viewerCount ?? 0 });
          return;
        }
        // Atomic pipeline: close the prior concurrency segment, then bump the
        // live gauge + the monotonic totalViews counter, then refresh peak.
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
          { new: true, updatePipeline: true } // Mongoose 9 requires this for array (aggregation) updates
        );
        if (stream) {
          socket.data.isHost = !!(user && String(stream.ownerId) === String(user._id));
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
      // Emit `user` as an OBJECT { name, avatarUrl } — the client reads
      // msg.user?.name / msg.user?.avatarUrl. (Previously sent as a bare string,
      // which made every message render as "Guest" with no avatar.) Guests → null.
      ns.to(room).emit('new_chat', {
        streamId,
        user: user ? { name: user.name, avatarUrl: user.avatarUrl ?? null } : null,
        text: trimmed,
        timestamp: Date.now(),
        isAuthor: !!socket.data.isHost, // the broadcaster's own messages
      });
    });

    // ── pin_message (host only) ────────────────────────────────────────────
    // The broadcaster pins one message; it persists on the stream (so late
    // joiners see it) and is pushed to everyone in the room.
    socket.on('pin_message', async ({ streamId, message } = {}) => {
      if (!streamId || !socket.data.isHost || !message?.text) return;
      const room = `stream:${streamId}`;
      const pinned = {
        text:      String(message.text).slice(0, 200),
        userName:  message.user?.name ?? null,
        avatarUrl: message.user?.avatarUrl ?? null,
        isAuthor:  message.isAuthor !== false,
        at:        new Date(),
      };
      try {
        await Stream.findByIdAndUpdate(streamId, { $set: { pinnedMessage: pinned } });
      } catch (err) {
        console.warn('[socket] pin_message persist failed:', err.message);
      }
      ns.to(room).emit('message_pinned', { streamId, pinned });
    });

    // ── unpin_message (host only) ──────────────────────────────────────────
    socket.on('unpin_message', async ({ streamId } = {}) => {
      if (!streamId || !socket.data.isHost) return;
      const room = `stream:${streamId}`;
      try {
        await Stream.findByIdAndUpdate(streamId, { $set: { pinnedMessage: null } });
      } catch (err) {
        console.warn('[socket] unpin_message persist failed:', err.message);
      }
      ns.to(room).emit('message_unpinned', { streamId });
    });

    // ── set_spotlight (host only) ──────────────────────────────────────────
    // The broadcaster "shows" one featured product live (or clears it with a
    // null productId). Persisted so viewers who join later still see it.
    socket.on('set_spotlight', async ({ streamId, productId } = {}) => {
      if (!streamId || !socket.data.isHost) return;
      const room = `stream:${streamId}`;
      const pid = productId || null;
      try {
        await Stream.findByIdAndUpdate(streamId, { $set: { currentProductId: pid } });
      } catch (err) {
        console.warn('[socket] set_spotlight persist failed:', err.message);
      }
      ns.to(room).emit('stream_spotlight', { streamId, productId: pid });
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

  // A non-viewer (broadcaster) never incremented the count, so it must not
  // decrement on leave — otherwise the gauge drifts negative-clamped to 0.
  if (socket.data.counted === false) return;

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
      { new: true, updatePipeline: true } // Mongoose 9 requires this for array (aggregation) updates
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
