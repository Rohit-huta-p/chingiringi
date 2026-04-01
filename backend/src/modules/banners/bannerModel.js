import mongoose from 'mongoose';

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
    linkType: {
      type: String,
      enum: ['deal', 'category', 'url'],
      default: 'url',
    },
    linkValue: {
      type: String,
      default: '',
    },
    position: {
      type: String,
      enum: ['hero', 'sidebar', 'inline'],
      default: 'hero',
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

bannerSchema.index({ isActive: 1, position: 1, sortOrder: 1 });

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
