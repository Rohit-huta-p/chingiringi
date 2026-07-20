import mongoose from 'mongoose';

export const STORE_CATEGORIES = [
  'Fashion', 'Electronics', 'Grocery', 'Food & Cafe',
  'Health', 'Jewellery', 'Sports', 'Beauty',
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
      enum: STORE_CATEGORIES,
    },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    images: [{ type: String }],
    phone: { type: String, default: '' },

    // ── Location ─────────────────────────────────────────────
    address: { type: String, required: [true, 'Address is required'], trim: true },
    area: { type: String, default: '' },
    city: { type: String, default: 'Bengaluru' },
    lat: { type: Number, required: [true, 'Latitude is required'] },
    lng: { type: Number, required: [true, 'Longitude is required'] },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    // ── Hours ("HH:mm" 24h) ──────────────────────────────────
    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '22:00' },
    openDays: [{ type: Number, min: 0, max: 6 }], // empty = every day

    // ── Deal terms (admin-only; stripped from public responses) ──
    userDiscountPercent: {
      type: Number, required: [true, 'User discount % is required'], min: 0, max: 100,
    },
    platformCommissionPercent: {
      type: Number, required: [true, 'Commission % is required'], min: 0, max: 100,
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

    // ── Flags ────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    // ── Denormalised stats (Tier 3 fills these) ──────────────
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    totalGmv: { type: Number, default: 0 },
    totalTxns: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Derive slug + GeoJSON point from name/lat/lng before saving.
// Sync pre-save hook — no `next` (same modern pattern as bannerModel; a
// `function(next)` form throws "next is not a function" under this Mongoose version).
storeSchema.pre('save', function preSave() {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name);
  if (typeof this.lat === 'number' && typeof this.lng === 'number') {
    this.location = { type: 'Point', coordinates: [this.lng, this.lat] };
  }
});

storeSchema.index({ category: 1 });
storeSchema.index({ city: 1 });
storeSchema.index({ isActive: 1 });
storeSchema.index({ isFeatured: 1 });
storeSchema.index({ location: '2dsphere' });
storeSchema.index({ name: 'text', address: 'text' });

const Store = mongoose.model('Store', storeSchema);

export default Store;
