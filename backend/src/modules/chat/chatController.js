import { Conversation, Message } from './chatModel.js';
import Store from '../stores/storeModel.js';
import Follow from '../follows/followModel.js';

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
  const p = m.product;
  const hasProduct = p && (p.productId || p.name);
  const o = m.offer;
  const hasOffer = o && typeof o.offerPrice === 'number';
  return {
    _id:            String(m._id),
    conversationId: String(m.conversationId),
    senderId:       String(m.senderId),
    senderRole:     m.senderRole,
    text:           m.text,
    createdAt:      m.createdAt,
    readAt:         m.readAt ?? null,
    product: hasProduct ? {
      productId: p.productId ? String(p.productId) : undefined,
      name:      p.name ?? '',
      imageUrl:  p.imageUrl ?? '',
      price:     typeof p.price === 'number' ? p.price : undefined,
    } : undefined,
    offer: hasOffer ? {
      productId:   o.productId ? String(o.productId) : undefined,
      name:        o.name ?? '',
      imageUrl:    o.imageUrl ?? '',
      listPrice:   typeof o.listPrice === 'number' ? o.listPrice : undefined,
      offerPrice:  o.offerPrice,
      status:      o.status ?? 'pending',
      respondedAt: o.respondedAt ?? null,
    } : undefined,
  };
}

/** Normalize a client-sent product attachment into the stored snapshot shape. */
function pickProduct(raw) {
  if (!raw || (!raw.productId && !raw.name)) return undefined;
  const price = typeof raw.price === 'number' ? raw.price : Number(raw.price);
  return {
    productId: raw.productId || undefined,
    name:      String(raw.name ?? '').slice(0, 200),
    imageUrl:  String(raw.imageUrl ?? '').slice(0, 600),
    price:     Number.isFinite(price) ? price : undefined,
  };
}

/**
 * Normalize a client-sent offer into the stored snapshot shape. Requires a
 * positive numeric offerPrice and a product (id or name); returns undefined
 * otherwise so a malformed offer is simply dropped (the message still sends).
 */
function pickOffer(raw) {
  if (!raw) return undefined;
  const offerPrice = typeof raw.offerPrice === 'number' ? raw.offerPrice : Number(raw.offerPrice);
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) return undefined;
  if (!raw.productId && !raw.name) return undefined;
  const listPrice = typeof raw.listPrice === 'number' ? raw.listPrice : Number(raw.listPrice);
  return {
    productId:  raw.productId || undefined,
    name:       String(raw.name ?? '').slice(0, 200),
    imageUrl:   String(raw.imageUrl ?? '').slice(0, 600),
    listPrice:  Number.isFinite(listPrice) ? listPrice : undefined,
    offerPrice,
    status:     'pending',
  };
}

/** The inbox-row product snapshot from a message's product or offer, if any. */
function productSnapshotFrom(product, offer) {
  const src = product || offer;
  if (!src) return undefined;
  return {
    productId: src.productId || undefined,
    name:      src.name ?? '',
    imageUrl:  src.imageUrl ?? '',
    price:     typeof (offer ? offer.offerPrice : product.price) === 'number'
      ? (offer ? offer.offerPrice : product.price)
      : undefined,
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

  const lp = conv.lastProduct;
  const hasLastProduct = lp && (lp.productId || lp.name);

  return {
    _id:           String(conv._id),
    role:          isBuyer ? 'buyer' : 'seller',
    otherParty,
    storeId,
    lastMessage:   conv.lastMessage ?? '',
    lastMessageAt: conv.lastMessageAt ?? null,
    lastSenderId:  conv.lastSenderId ? String(conv.lastSenderId) : null,
    unread:        isBuyer ? (conv.unreadBuyer ?? 0) : (conv.unreadSeller ?? 0),
    lastProduct: hasLastProduct ? {
      productId: lp.productId ? String(lp.productId) : undefined,
      name:      lp.name ?? '',
      imageUrl:  lp.imageUrl ?? '',
      price:     typeof lp.price === 'number' ? lp.price : undefined,
    } : undefined,
  };
}

/**
 * Mark the caller's side of a thread read: stamp the other side's unread
 * messages, zero the caller's unread counter, and let the other party's open
 * thread update its read receipts.
 */
async function markConversationRead(conv, isBuyer) {
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

  await markConversationRead(conv, isBuyer);

  res.status(200).json({ status: 'success', data: { messages: rows.map(shapeMessage) } });
};

/**
 * POST /api/chat/conversations/:id/read
 * Clears the caller's unread for a thread. Used when a message arrives while
 * the thread is already open (so the inbox badge doesn't drift).
 */
export const markRead = async (req, res) => {
  const userId = req.user._id;

  const conv = await Conversation.findById(req.params.id);
  if (!conv) { res.status(404); throw new Error('Conversation not found'); }

  const isBuyer  = String(conv.buyerId) === String(userId);
  const isSeller = String(conv.sellerId) === String(userId);
  if (!isBuyer && !isSeller) { res.status(403); throw new Error('Not a participant in this conversation'); }

  await markConversationRead(conv, isBuyer);
  res.status(200).json({ status: 'success', data: { ok: true } });
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

  const product = pickProduct(req.body?.product);
  // Only the seller may attach a price offer; a buyer-sent offer is ignored.
  const offer = isSeller ? pickOffer(req.body?.offer) : undefined;
  const msg = await Message.create({
    conversationId: conv._id,
    senderId:       userId,
    senderRole:     isBuyer ? 'buyer' : 'seller',
    text:           text.slice(0, 2000),
    ...(product ? { product } : {}),
    ...(offer ? { offer } : {}),
  });

  conv.lastMessage   = msg.text;
  conv.lastSenderId  = userId;
  conv.lastMessageAt = msg.createdAt;
  // Keep the thread's product context fresh for the inbox thumbnail.
  const snapshot = productSnapshotFrom(product, offer);
  if (snapshot) conv.lastProduct = snapshot;
  if (isBuyer) conv.unreadSeller += 1; else conv.unreadBuyer += 1;
  await conv.save();

  const shaped = shapeMessage(msg);
  const recipientId = isBuyer ? conv.sellerId : conv.buyerId;
  // Emit to both participants' personal rooms (all their devices + inboxes).
  // The sender's own client already has the message from this response, so it
  // dedupes the echo by _id.
  emitToChat('new_message', [`user:${userId}`, `user:${recipientId}`], {
    conversationId: String(conv._id),
    message:        shaped,
  });

  res.status(201).json({ status: 'success', data: { message: shaped } });
};

/**
 * POST /api/chat/conversations/:id/offers/:messageId/respond   body: { action }
 * The BUYER accepts or declines a seller's pending offer. Flips the offer's
 * status in place and broadcasts `offer_updated` so both open threads live-patch
 * the card. There is no checkout/stock side — an accepted offer is a soft
 * agreement the two carry on in chat.
 */
export const respondToOffer = async (req, res) => {
  const userId = req.user._id;
  const action = req.body?.action;
  if (action !== 'accept' && action !== 'decline') {
    res.status(400); throw new Error("action must be 'accept' or 'decline'");
  }

  const conv = await Conversation.findById(req.params.id);
  if (!conv) { res.status(404); throw new Error('Conversation not found'); }
  const isBuyer  = String(conv.buyerId) === String(userId);
  const isSeller = String(conv.sellerId) === String(userId);
  if (!isBuyer && !isSeller) { res.status(403); throw new Error('Not a participant in this conversation'); }
  // Only the recipient of the offer (the buyer) may accept/decline it.
  if (!isBuyer) { res.status(403); throw new Error('Only the buyer can respond to an offer'); }

  const msg = await Message.findOne({ _id: req.params.messageId, conversationId: conv._id });
  if (!msg || !msg.offer || typeof msg.offer.offerPrice !== 'number') {
    res.status(404); throw new Error('Offer not found');
  }
  if (msg.offer.status !== 'pending') {
    res.status(409); throw new Error('This offer has already been answered');
  }

  msg.offer.status = action === 'accept' ? 'accepted' : 'declined';
  msg.offer.respondedAt = new Date();
  await msg.save();

  const shaped = shapeMessage(msg);
  emitToChat(
    'offer_updated',
    [`conv:${conv._id}`, `user:${conv.buyerId}`, `user:${conv.sellerId}`],
    { conversationId: String(conv._id), messageId: shaped._id, offer: shaped.offer },
  );

  res.status(200).json({ status: 'success', data: { message: shaped } });
};

/**
 * GET /api/chat/conversations/:id/context
 * Lightweight thread context for the header — currently whether the buyer
 * follows the store (drives the seller's "Follows you" chip). One indexed
 * lookup; fetched once when a thread opens.
 */
export const getConversationContext = async (req, res) => {
  const userId = req.user._id;

  const conv = await Conversation.findById(req.params.id).select('buyerId sellerId storeId').lean();
  if (!conv) { res.status(404); throw new Error('Conversation not found'); }
  const isBuyer  = String(conv.buyerId) === String(userId);
  const isSeller = String(conv.sellerId) === String(userId);
  if (!isBuyer && !isSeller) { res.status(403); throw new Error('Not a participant in this conversation'); }

  const buyerFollows = !!(await Follow.exists({ userId: conv.buyerId, storeId: conv.storeId }));
  res.status(200).json({ status: 'success', data: { buyerFollows } });
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
