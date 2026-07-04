import mongoose from 'mongoose';

/**
 * Every affiliate-link click made through Chingiringi. Foundation for matching
 * merchant reports back to users:
 *
 *  - Primary attribution: subid in the rewritten URL → merchant report row has
 *    the same subid → exact match (95% of orders).
 *  - Fallback attribution: when subid is missing from the report (some merchants
 *    strip params), match by merchant + click timestamp window + amount range.
 *  - Audit trail: who clicked what, when, from where in the app.
 *
 * userId is optional — anonymous users can click affiliate links too; we still
 * log them (with subid = anon tag) so the data is there if they sign in later
 * and we can backfill via IP / device fingerprint.
 */
const clickEventSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    index: true },
    dealId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Deal',    index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },

    merchant: { type: String, trim: true, lowercase: true, index: true },
    source:   { type: String, trim: true }, // 'home' | 'deals' | 'product_detail' | 'admin' | ...

    originalUrl:  { type: String, required: true }, // affiliate URL as stored in DB
    redirectedTo: { type: String, required: true }, // URL after subid append
    subid:        { type: String, trim: true, index: true },

    ip:        { type: String },
    userAgent: { type: String },
    referer:   { type: String },
  },
  { timestamps: true },
);

// Compound indexes — the two queries we'll actually run:
//   1. "show me this user's last 50 clicks" (User Wallet timeline)
//   2. "find clicks on amazon between Mar 1 and Mar 31" (report matching fallback)
clickEventSchema.index({ userId: 1, createdAt: -1 });
clickEventSchema.index({ merchant: 1, createdAt: -1 });

const ClickEvent = mongoose.model('ClickEvent', clickEventSchema);

export default ClickEvent;
