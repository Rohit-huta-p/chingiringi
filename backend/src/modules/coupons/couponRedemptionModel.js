import mongoose from 'mongoose';

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional link to the order that consumed this coupon
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    orderValue: {
      type: Number,
      min: 0,
      required: true,
    },
    discountApplied: {
      type: Number,
      min: 0,
      required: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup for perUserLimit enforcement
couponRedemptionSchema.index({ coupon: 1, user: 1 });
// Timeline queries
couponRedemptionSchema.index({ coupon: 1, redeemedAt: -1 });

const CouponRedemption = mongoose.model(
  'CouponRedemption',
  couponRedemptionSchema
);

export default CouponRedemption;
