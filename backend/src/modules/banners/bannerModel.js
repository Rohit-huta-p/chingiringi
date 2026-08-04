import mongoose from 'mongoose';

// Legacy coarse position values — kept for backwards compatibility
const LEGACY_POSITIONS = ['hero', 'sidebar', 'inline'];

// Fine-grained placement slots on the dashboard (source of truth for new banners)
const SLOT_VALUES = [
  'hero',           // Top hero banner (split-color taco style)
  'flash-strip',    // Thin gradient strip with badges (between product rows)
  'dual-left',      // Left half of the paired dual banner
  'dual-right',     // Right half of the paired dual banner
  'earn-coins',     // Yellow gradient coins promo
  'refer-earn',     // Blue gradient refer-and-earn promo
  'inline-1',       // Flexible inline slot #1
  'inline-2',       // Flexible inline slot #2
];

const badgeSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    color: { type: String, trim: true }, // hex
  },
  { _id: false }
);

// Right half of a "dual" banner. The banner's top-level fields are the left
// half; this sub-doc mirrors them for the right half. Empty/ignored for hero.
const sideSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: '' },
    mobileImageUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    ctaLabel: { type: String, default: '' },
    linkType: { type: String, enum: ['deal', 'category', 'url'], default: 'url' },
    linkValue: { type: String, default: '' },
  },
  { _id: false }
);

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    // Mobile-specific banner image. Falls back to imageUrl on mobile when empty.
    mobileImageUrl: {
      type: String,
      default: '',
    },
    // Optional secondary image (e.g. foreground hero art, overlaid product)
    overlayImage: {
      type: String,
      default: '',
    },
    linkType: {
      type: String,
      enum: ['deal', 'category', 'url'],
      default: 'url',
    },
    linkValue: {
      type: String,
      default: '',
    },
    ctaLabel: {
      type: String,
      default: '',
    },

    // Fine-grained slot (preferred)
    slot: {
      type: String,
      enum: SLOT_VALUES,
      default: 'hero',
    },

    // Legacy coarse position — kept so existing records keep working
    position: {
      type: String,
      enum: LEGACY_POSITIONS,
      default: 'hero',
    },

    // New placement model (replaces the 8-slot taxonomy for new banners).
    // `type` picks the shape; `rowIndex` is the 0-based home row-gap it sits in.
    type: {
      type: String,
      enum: ['hero', 'dual'],
      default: 'hero',
    },
    rowIndex: {
      type: Number,
      default: 0,
    },

    // Visual customisation
    gradientColors: {
      type: [String],
      default: [],
    },
    textColor: {
      type: String,
      default: '',
    },
    badges: {
      type: [badgeSchema],
      default: [],
    },

    // Right half for a dual banner (see sideSchema). Undefined for hero.
    right: sideSchema,

    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Keep the slot and legacy position loosely in sync. If a caller only set `slot`
// we derive a sensible legacy `position` so old clients querying by position
// keep receiving data.
// Synchronous pre-save hook — no `next` callback. The previous `function(next)`
// form threw "next is not a function" (Mongoose isn't passing a next here), which
// made every Banner.create() fail. A sync hook with no `next` param is the
// modern, robust pattern: Mongoose continues once it returns.
bannerSchema.pre('save', function () {
  if (this.slot && (!this.position || (this.position === 'hero' && this.slot !== 'hero'))) {
    if (this.slot === 'hero') this.position = 'hero';
    else if (this.slot.startsWith('dual-')) this.position = 'inline';
    else if (this.slot.startsWith('inline-')) this.position = 'inline';
    else this.position = 'inline';
  }
});

bannerSchema.index({ isActive: 1, slot: 1, sortOrder: 1 });
bannerSchema.index({ isActive: 1, position: 1, sortOrder: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export { SLOT_VALUES, LEGACY_POSITIONS };
export default Banner;
