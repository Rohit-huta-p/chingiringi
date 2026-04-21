import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percent', 'flat'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: 0,
    },
    // Cap for percent-type coupons (optional for flat)
    maxDiscount: {
      type: Number,
      min: 0,
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    // 0 = unlimited total redemptions
    usageLimit: {
      type: Number,
      min: 0,
      default: 0,
    },
    // 0 = unlimited per-user redemptions
    perUserLimit: {
      type: Number,
      min: 0,
      default: 1,
    },
    usedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Percent cannot exceed 100 — async hook (no next callback; Mongoose 9+)
couponSchema.pre('validate', async function () {
  if (this.discountType === 'percent' && this.discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100');
  }
});

couponSchema.index({ isActive: 1, expiresAt: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
