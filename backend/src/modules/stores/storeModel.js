import mongoose from 'mongoose';

// Canonical *suggested* store categories (mirrors the app taxonomy in
// chingiring-app/src/data/offlineStores.ts). Sellers may also enter a custom
// category via the "Other" option, so `category` below is a validated string,
// NOT a hard enum — an unrecognised value must not 400.
export const STORE_CATEGORIES = [
  'Beauty', 'Electronics', "Women's Fashion", 'Sneakers & Shoes',
  'Home & Garden', 'Video Games', 'Toys', 'Sports', 'Baby & Kids',
  'Rocks & Crystals', 'Outdoors', "Men's Fashion", 'Arts & Handmade',
  'Jewellery & Watches', 'Bags & Accessories', 'Antiques & Vintage Decor',
  'Wholesale & Deals',
];

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const storeSchema = new mongoose.Schema(
  {
    // ── Profile ──────────────────────────────────────────────
    name: { type: String, required: [true, 'Store name is required'], trim: true },
    shortName: { type: String, required: [true, 'Short name is required'], trim: true },
    slug: { type: String, unique: true, sparse: true },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [40, 'Category is too long'],
    },
    // 'physical' = a shop buyers can visit; 'online' = no storefront (home-based,
    // D2C, social, marketplace); 'both'. Drives the conditional address rule below
    // and the verification document set. Default 'physical' → every existing store
    // and the buyer Live/Offline tabs are unchanged.
    storeType: {
      type: String,
      enum: ['physical', 'online', 'both'],
      default: 'physical',
    },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    images: [{ type: String }],
    phone: { type: String, default: '' },
    website: { type: String, default: '', trim: true },

    // ── Location ─────────────────────────────────────────────
    // Required for physical/both (a visitable shop); optional for online-only
    // stores. Function-form `required` evaluates on document .save() — the
    // seller-create path uses Store.create(), so `this` is the new document.
    address: {
      type: String,
      required: [function requireAddress() { return this.storeType !== 'online'; }, 'Address is required'],
      trim: true,
      default: '',
    },
    area: { type: String, default: '' },
    city: { type: String, default: 'Bengaluru' },
    // Admin pastes a Google Maps link; lat/lng are parsed from it on save
    // (see googleMapsCoords.js) — the admin never types coordinates.
    mapsUrl: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    // ── Hours ("HH:mm" 24h) ──────────────────────────────────
    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '22:00' },
    openDays: [{ type: Number, min: 0, max: 6 }], // empty = every day

    // ── Deal terms (admin-only; stripped from public responses) ──
    // Admin-configured deal fields — not required at seller onboarding (default 0).
    // Admin sets these later when activating the store's cashback deal.
    userDiscountPercent: {
      type: Number, default: 0, min: 0, max: 100,
    },
    platformCommissionPercent: {
      type: Number, default: 0, min: 0, max: 100,
    },
    maxDiscountCap: { type: Number, default: 0, min: 0 }, // 0 = no cap
    minBillAmount: { type: Number, default: 0, min: 0 },
    settlementCycle: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },
    payoutAccount: {
      method: { type: String, default: '' },
      upiId: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountLast4: { type: String, default: '' },
    },

    // ── Live commerce ownership ──────────────────────────────
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
    followerCount: { type: Number, default: 0, min: 0 },
    isLive: { type: Boolean, default: false },

    // ── Seller verification ──────────────────────────────────
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    verificationDoc: {
      type:            { type: String, default: '' },
      url:             { type: String, default: '' },   // legacy public URL (pre-private-KYC)
      publicId:        { type: String, default: '' },   // private (authenticated) Cloudinary asset
      format:          { type: String, default: '' },
      submittedAt:     { type: Date },
      rejectionReason: { type: String, default: '' },
    },
    // Personal identity of the store owner (govt ID + selfie), reviewed together
    // with the store document — the store is only 'verified' when both pass.
    // New submissions store a private Cloudinary publicId (+ format) instead of a
    // public URL; the *Url fields remain for legacy rows and are never populated
    // for new secure uploads.
    identityDoc: {
      type:           { type: String, default: '' },  // aadhaar | pan | dl | passport
      docUrl:         { type: String, default: '' },   // legacy public URL
      docPublicId:    { type: String, default: '' },   // private ID document asset
      docFormat:      { type: String, default: '' },
      selfieUrl:      { type: String, default: '' },   // legacy public URL
      selfiePublicId: { type: String, default: '' },   // private selfie asset
      selfieFormat:   { type: String, default: '' },
      submittedAt:    { type: Date },
    },

    // ── Flags ────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    // ── Ratings/reviews: admin-seeded for now (Tier 3 will auto-compute) ──
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    totalGmv: { type: Number, default: 0 },
    totalTxns: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Derive the slug from the store name before saving.
// Sync pre-save hook — no `next` (same modern pattern as bannerModel; a
// `function(next)` form throws "next is not a function" under this Mongoose version).
storeSchema.pre('save', function preSave() {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name);
});

storeSchema.index({ category: 1 });
storeSchema.index({ city: 1 });
storeSchema.index({ isActive: 1 });
storeSchema.index({ isFeatured: 1 });
storeSchema.index({ name: 'text', address: 'text' });

const Store = mongoose.model('Store', storeSchema);

export default Store;
