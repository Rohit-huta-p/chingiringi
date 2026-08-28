import { Conversation, Message } from './chatModel.js';
import Store from '../stores/storeModel.js';

// ── Socket emit helper ───────────────────────────────────────────────────────
// Emits to the /chat namespace. Multiple rooms in one call de-dupe recipients,
// so a socket that's in both the conversation room and its personal room gets
// the event once. `io` is imported lazily to avoid a circular import at load.
async function emitToChat(event, rooms, payload) {
  try {
    const { io } = await import('../../server.js');
    let target = io.of('/chat');
    for (const room of rooms) target = target.to(room);
    target.emit(event, payload);
  } catch (err) {
    console.warn(`[chat] emit ${event} failed:`, err.message);
  }
}

// ── Shapers ──────────────────────────────────────────────────────────────────

function shapeMessage(m) {
  return {
    _id:            String(m._id),
    conversationId: String(m.conversationId),
    senderId:       String(m.senderId),
    senderRole:     m.senderRole,
    text:           m.text,
    createdAt:      m.createdAt,
    readAt:         m.readAt ?? null,
  };
}

/**
 * Client shape for an inbox row. `role` is the CALLER's side in this thread;
 * `otherParty` is whoever they're talking to (the store for a buyer, the buyer
 * for a seller). `unread` is the caller's own badge.
 */
function shapeConversation(conv, userId) {
  const uid = String(userId);
  const buyer = conv.buyerId; // populated { _id, name, avatarUrl }
  const store = conv.storeId; // populated { _id, name, shortName, logoUrl }
  const buyerId = String(buyer?._id ?? buyer);
  const storeId = String(store?._id ?? store);
  const isBuyer = buyerId === uid;

  const otherParty = isBuyer
    ? { kind: 'store', id: storeId, name: store?.name ?? 'Store', avatarUrl: store?.logoUrl ?? '', storeId }
    : { kind: 'user',  id: buyerId, name: buyer?.name ?? 'Buyer', avatarUrl: buyer?.avatarUrl ?? '' };

  return {
    _id:           String(conv._id),
    role:          isBuyer ? 'buyer' : 'seller',
    otherParty,
    storeId,
    lastMessage:   conv.lastMessage ?? '',
    lastMessageAt: conv.lastMessageAt ?? null,
    lastSenderId:  conv.lastSenderId ? String(conv.lastSenderId) : null,
    unread:        isBuyer ? (conv.unreadBuyer ?? 0) : (conv.unreadSeller ?? 0),
  };
}

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/chat/conversations   body: { storeId }
 * Buyer-initiated: find or create the caller's thread with a store. The seller
 * side never creates threads — they only ever reply to existing ones.
 */
export const getOrCreateConversation = async (req, res) => {
  const { storeId } = req.body;
  if (!storeId) { res.status(400); throw new Error('storeId is required'); }

  const store = await Store.findById(storeId).select('_id name shortName logoUrl ownerId');
  if (!store) { res.status(404); throw new Error('Store not found'); }
  if (!store.ownerId) { res.status(409); throw new Error('This store is not set up to receive messages yet'); }

  const buyerId = req.user._id;
  if (String(store.ownerId) === String(buyerId)) {
    res.status(400);
    throw new Error("You can't start a chat with your own store");
  }

  let conv = await Conversation.findOne({ buyerId, storeId });
  if (!conv) {
    conv = await Conversation.create({ buyerId, storeId, sellerId: store.ownerId });
  }

  res.status(200).json({
    status: 'success',
    data: {
      conversation: {
        _id:           String(conv._id),
        role:          'buyer',
        otherParty:    { kind: 'store', id: String(store._id), name: store.name, avatarUrl: store.logoUrl ?? '', storeId: String(store._id) },
        storeId:       String(store._id),
        lastMessage:   conv.lastMessage ?? '',
        lastMessageAt: conv.lastMessageAt ?? null,
        lastSenderId:  conv.lastSenderId ? String(conv.lastSenderId) : null,
        unread:        conv.unreadBuyer ?? 0,
      },
    },
  });
};

/**
 * GET /api/chat/conversations
 * The caller's inbox — every thread where they're the buyer or the seller,
 * newest activity first. Empty threads (created but never messaged) are hidden.
 */
export const getConversations = async (req, res) => {
  const userId = req.user._id;

  const convs = await Conversation.find({
    $or: [{ buyerId: userId }, { sellerId: userId }],
    lastMessageAt: { $ne: null },
  })
    .populate('buyerId', 'name avatarUrl')
    .populate('storeId', 'name shortName logoUrl')
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();

  const conversations = convs.map((c) => shapeConversation(c, userId));
  res.status(200).json({ status: 'success', data: { conversations } });
};

/**
 * GET /api/chat/conversations/:id/messages
 * Thread history (oldest → newest), and marks the caller's side as read.
 */
export const getMessages = async (req, res) => {
  const userId = req.user._id;

  const conv = await Conversation.findById(req.params.id);
  if (!conv) { res.status(404); throw new Error('Conversation not found'); }

  const isBuyer  = String(conv.buyerId) === String(userId);
  const isSeller = String(conv.sellerId) === String(userId);
  if (!isBuyer && !isSeller) { res.status(403); throw new Error('Not a participant in this conversation'); }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const rows = await Message.find({ conversationId: conv._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  rows.reverse(); // render oldest → newest

  // Mark the other side's messages read + clear the caller's unread badge.
  const otherRole = isBuyer ? 'seller' : 'buyer';
  const now = new Date();
  await Message.updateMany(
    { conversationId: conv._id, senderRole: otherRole, readAt: null },
    { $set: { readAt: now } },
  );
  const unreadField = isBuyer ? 'unreadBuyer' : 'unreadSeller';
  if ((conv[unreadField] ?? 0) > 0) {
    conv[unreadField] = 0;
    await conv.save();
  }
  emitToChat('messages_read', [`conv:${conv._id}`], {
    conversationId: String(conv._id),
    readerRole:     isBuyer ? 'buyer' : 'seller',
    at:             now.getTime(),
  });

  res.status(200).json({ status: 'success', data: { messages: rows.map(shapeMessage) } });
};

/**
 * POST /api/chat/conversations/:id/messages   body: { text }
 * Persists the message, updates the thread preview, bumps the recipient's
 * unread, and broadcasts `new_message` to the thread + the recipient's inbox.
 */
export const sendMessage = async (req, res) => {
  const userId = req.user._id;
  const text = (req.body?.text ?? '').trim();
  if (!text) { res.status(400); throw new Error('Message text is required'); }

  const conv = await Conversation.findById(req.params.id);
  if (!conv) { res.status(404); throw new Error('Conversation not found'); }

  const isBuyer  = String(conv.buyerId) === String(userId);
  const isSeller = String(conv.sellerId) === String(userId);
  if (!isBuyer && !isSeller) { res.status(403); throw new Error('Not a participant in this conversation'); }

  const msg = await Message.create({
    conversationId: conv._id,
    senderId:       userId,
    senderRole:     isBuyer ? 'buyer' : 'seller',
    text:           text.slice(0, 2000),
  });

  conv.lastMessage   = msg.text;
  conv.lastSenderId  = userId;
  conv.lastMessageAt = msg.createdAt;
  if (isBuyer) conv.unreadSeller += 1; else conv.unreadBuyer += 1;
  await conv.save();

  const shaped = shapeMessage(msg);
  const recipientId = isBuyer ? conv.sellerId : conv.buyerId;
  emitToChat('new_message', [`conv:${conv._id}`, `user:${recipientId}`], {
    conversationId: String(conv._id),
    message:        shaped,
  });

  res.status(201).json({ status: 'success', data: { message: shaped } });
};

/**
 * GET /api/chat/unread
 * Total unread across all the caller's threads — powers the header badge.
 */
export const getUnreadTotal = async (req, res) => {
  const userId = req.user._id;

  const [buyerAgg, sellerAgg] = await Promise.all([
    Conversation.aggregate([
      { $match: { buyerId: userId } },
      { $group: { _id: null, total: { $sum: '$unreadBuyer' } } },
    ]),
    Conversation.aggregate([
      { $match: { sellerId: userId } },
      { $group: { _id: null, total: { $sum: '$unreadSeller' } } },
    ]),
  ]);

  const count = (buyerAgg[0]?.total ?? 0) + (sellerAgg[0]?.total ?? 0);
  res.status(200).json({ status: 'success', data: { count } });
};
