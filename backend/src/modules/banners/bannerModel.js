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
bannerSchema.pre('save', function (next) {
  if (this.slot && (!this.position || this.position === 'hero' && this.slot !== 'hero')) {
    if (this.slot === 'hero') this.position = 'hero';
    else if (this.slot.startsWith('dual-')) this.position = 'inline';
    else if (this.slot.startsWith('inline-')) this.position = 'inline';
    else this.position = 'inline';
  }
  next();
});

bannerSchema.index({ isActive: 1, slot: 1, sortOrder: 1 });
bannerSchema.index({ isActive: 1, position: 1, sortOrder: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export { SLOT_VALUES, LEGACY_POSITIONS };
export default Banner;
