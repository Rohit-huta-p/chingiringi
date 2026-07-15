import mongoose from 'mongoose';

/**
 * Singleton config document that controls the coin economy.
 *
 *  passThroughPercent — fraction of every ₹ of commission we give the user
 *                       back as coins. 0.25 = 25%.
 *  coinsPerRupee      — how many coins equal ₹1 both at credit AND redemption.
 *                       10 = 10 coins per ₹1.
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
    coinsPerRupee:      { type: Number, default: 10,   min: 1 },
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
    razorpayEnabled:       { type: Boolean, default: false },
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
