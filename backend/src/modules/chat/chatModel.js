import mongoose from 'mongoose';

/**
 * Chat data model — 1:1 conversations between a buyer and a store.
 *
 * A Conversation is keyed by (buyerId, storeId): a buyer has at most one thread
 * per store. `sellerId` is the store's owner, denormalized so the seller side
 * can list its inbox without a Store join. Unread counts are tracked per side
 * so each participant sees their own badge.
 */
const conversationSchema = new mongoose.Schema(
  {
    buyerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    storeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    // Store owner at creation time — denormalized for the seller-side inbox query.
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },

    // Denormalized preview of the newest message (powers the inbox row).
    lastMessage:   { type: String, default: '' },
    lastSenderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessageAt: { type: Date },

    // Per-side unread counters — reset to 0 when that side opens the thread.
    unreadBuyer:  { type: Number, default: 0, min: 0 },
    unreadSeller: { type: Number, default: 0, min: 0 },

    // Snapshot of the product/offer this thread is currently about — powers the
    // inbox-row thumbnail. Persists across later plain-text messages (a thread
    // stays "about" its product); refreshed whenever a product/offer is sent.
    lastProduct: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:      { type: String, default: '' },
      imageUrl:  { type: String, default: '' },
      price:     { type: Number },
      _id:       false,
    },
  },
  { timestamps: true }
);

// One thread per (buyer, store).
conversationSchema.index({ buyerId: 1, storeId: 1 }, { unique: true });
// Inbox queries: newest-first for each side.
conversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Which side sent it — stored so the client can render alignment without
    // re-deriving from ids.
    senderRole:     { type: String, enum: ['buyer', 'seller'], required: true },
    text:           { type: String, required: true, trim: true, maxlength: 2000 },
    readAt:         { type: Date },
    // Optional product context — set when the message is sent about a product
    // (e.g. from a product page's "Chat to buy"). Embedded snapshot so the card
    // survives the product changing later.
    product: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:      { type: String, default: '' },
      imageUrl:  { type: String, default: '' },
      price:     { type: Number },
      _id:       false,
    },
    // Optional seller offer — a custom price on a product. Only the seller may
    // attach one; the buyer accepts/declines, flipping `status`. `listPrice` is
    // the product's price at offer time (the strike-through reference).
    offer: {
      productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:        { type: String, default: '' },
      imageUrl:    { type: String, default: '' },
      listPrice:   { type: Number },
      offerPrice:  { type: Number },
      status:      { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      respondedAt: { type: Date },
      _id:         false,
    },
  },
  { timestamps: true }
);

// Thread history, oldest → newest.
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
