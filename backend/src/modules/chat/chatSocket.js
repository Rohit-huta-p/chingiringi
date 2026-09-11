import { Conversation } from './chatModel.js';

/**
 * Attach all /chat namespace socket handlers.
 *
 * Auth is required (the namespace middleware sets socket.data.user); a socket
 * with no user is dropped. On connect the socket joins its personal room
 * `user:<id>` (inbox / badge notifications), and joins `conv:<id>` rooms on
 * demand after a membership check. Message *sending* goes through the REST
 * endpoint (which persists then emits `new_message`); sockets only receive.
 *
 * @param {import('socket.io').Namespace} ns
 */
export function attachChatSocket(ns) {
  ns.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user?._id) {
      // Unauthenticated — messaging is not available to guests.
      socket.disconnect(true);
      return;
    }

    // Personal room: receives new_message for any of the user's threads even
    // when the specific conversation isn't open (drives inbox + badge updates).
    socket.join(`user:${user._id}`);

    // ── join_conversation ──────────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      try {
        const conv = await Conversation.findById(conversationId)
          .select('buyerId sellerId')
          .lean();
        if (!conv) return;
        const uid = String(user._id);
        if (String(conv.buyerId) !== uid && String(conv.sellerId) !== uid) return; // not a participant
        socket.join(`conv:${conversationId}`);
        socket.data.currentConv = conversationId;
      } catch (err) {
        console.error('[chat] join_conversation error:', err.message);
      }
    });

    // ── leave_conversation ─────────────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId } = {}) => {
      const id = conversationId || socket.data.currentConv;
      if (id) socket.leave(`conv:${id}`);
      if (socket.data.currentConv === id) socket.data.currentConv = null;
    });

    // ── typing indicators (cosmetic, not persisted) ─────────────────────────
    socket.on('typing', ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing', { conversationId });
    });
    socket.on('stop_typing', ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('stop_typing', { conversationId });
    });
  });
}
