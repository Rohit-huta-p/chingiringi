import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Deal title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Deal description is required'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    cashbackPercent: {
      type: Number,
      required: [true, 'Cashback percentage is required'],
      min: 0,
      max: 100,
    },
    cashbackType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'percentage',
    },
    flatCashback: {
      type: Number,
      min: 0,
      default: 0,
    },
    affiliateUrl: {
      type: String,
      required: [true, 'Affiliate URL is required'],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    lockPeriodDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    termsAndConditions: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    // Surfaces the deal in the "Trending Now" row on the user-facing Deals
    // page. Manually toggled by admin (plan C) — independent of the
    // computed-by-clicks heuristic the list page may also use.
    isTrending: {
      type: Boolean,
      default: false,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    conversionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

dealSchema.index({ brand: 1 });
dealSchema.index({ category: 1 });
dealSchema.index({ isActive: 1, expiresAt: 1 });
dealSchema.index({ isFeatured: 1 });
dealSchema.index({ isTrending: 1 });
dealSchema.index({ title: 'text', brand: 'text', description: 'text' });

const Deal = mongoose.model('Deal', dealSchema);

export default Deal;
