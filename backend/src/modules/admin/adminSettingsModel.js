import mongoose from 'mongoose';

/**
 * Singleton config document that controls the coin economy.
 *
 *  passThroughPercent — fraction of every ₹ of commission we give the user
 *                       back as coins. 0.25 = 25%.
 *  coinsPerRupee      — how many coins equal ₹1 both at credit AND redemption.
 *                       1000 = 1000 coins per ₹1 (100 coins = 10 paise).
 *  coinsPerShare      — flat coins awarded per completed product/store share.
 *  maxSharesPerDay    — daily cap on credited shares per user, products+stores
 *                       combined.
 *  defaultLockDays    — how long pending coins sit before confirming. Matches
 *                       typical merchant return window (30d).
 *  cuelinksPublisherId— our Cuelinks pub ID; used by the URL wrapper (Phase C).
 *  amazonAssociateTag — our Amazon tag; used by the URL wrapper (Phase C).
 *
 * Single document only. Use AdminSettings.get() everywhere — it upserts on
 * first call so the app always has a settings row.
 */
const adminSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },

    passThroughPercent: { type: Number, default: 0.25, min: 0, max: 1 },
    coinsPerRupee:      { type: Number, default: 1000, min: 1 }, // 100 coins = 10 paise
    // Share-to-earn economy.
    coinsPerShare:      { type: Number, default: 50,   min: 0 },
    maxSharesPerDay:    { type: Number, default: 100,  min: 0 }, // per user, products+stores combined
    defaultLockDays:    { type: Number, default: 30,   min: 0 },

    cuelinksPublisherId: { type: String, default: '', trim: true },
    amazonAssociateTag:  { type: String, default: '', trim: true },

    // ── RazorpayX payouts (config + status only for now) ──────────────────
    // Keys are stored here so the admin can manage them from the profile
    // screen; the actual payout API wiring comes later. The secret is never
    // returned to the client verbatim — the controller masks it.
    razorpayKeyId:         { type: String, default: '', trim: true },
    razorpayKeySecret:     { type: String, default: '', trim: true },
    razorpayAccountNumber: { type: String, default: '', trim: true }, // RazorpayX payout account
    razorpayWebhookSecret: { type: String, default: '', trim: true }, // verifies inbound payout webhooks
    razorpayEnabled:       { type: Boolean, default: false },

    // ── Cashfree Payouts (active provider) ────────────────────────────────
    // Same masking rules as Razorpay (see adminSettingsController). V2 uses
    // header auth: client id + secret + env, no separate account number.
    cashfreeClientId:      { type: String, default: '', trim: true },
    cashfreeClientSecret:  { type: String, default: '', trim: true },
    cashfreeEnv:           { type: String, enum: ['sandbox', 'prod'], default: 'sandbox' },
    cashfreeWebhookSecret: { type: String, default: '', trim: true }, // verifies inbound payout webhooks
    cashfreeEnabled:       { type: Boolean, default: false },

    // Which provider disburses withdrawals. Razorpay stays wired as a fallback;
    // flip this to roll back without touching code.
    payoutProvider: { type: String, enum: ['razorpay', 'cashfree'], default: 'cashfree' },

    // ── Instant-on-tap payout cap ─────────────────────────────────────────
    // A user's Withdraw tap pays out instantly while their running total for
    // the day stays within the cap (soft fraud limit); over-cap requests fall
    // to the admin approval queue.
    instantPayoutEnabled:   { type: Boolean, default: true },
    instantPayoutCapRupees: { type: Number, default: 500, min: 0 },
  },
  { timestamps: true },
);

adminSettingsSchema.statics.get = async function get() {
  let doc = await this.findOne({ key: 'default' });
  if (!doc) doc = await this.create({ key: 'default' });
  return doc;
};

const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);

export default AdminSettings;
