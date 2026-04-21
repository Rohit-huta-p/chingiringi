import Coupon from './couponModel.js';
import CouponRedemption from './couponRedemptionModel.js';

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Returns the discount amount for a given coupon + order value.
 * Caps percent discounts at maxDiscount when set.
 * Caps flat discounts at orderValue to avoid negative totals.
 */
function computeDiscount(coupon, orderValue) {
  if (coupon.discountType === 'percent') {
    let discount = (orderValue * coupon.discountValue) / 100;
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    return Math.round(discount);
  }
  // flat
  return Math.min(coupon.discountValue, orderValue);
}

/**
 * Runs all validity checks for a coupon code + user + order value.
 * Throws Error with a readable message on any failure.
 * Returns the validated coupon doc on success.
 */
async function validateCoupon({ code, userId, orderValue }) {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Coupon code is required');

  const coupon = await Coupon.findOne({ code: normalized });
  if (!coupon) throw new Error('Invalid coupon code');

  if (!coupon.isActive) throw new Error('This coupon is not active');

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) {
    throw new Error('This coupon is not yet available');
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new Error('This coupon has expired');
  }

  if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
    throw new Error(
      `Minimum order value is ₹${coupon.minOrderValue} for this coupon`
    );
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('This coupon has reached its usage limit');
  }

  if (coupon.perUserLimit > 0 && userId) {
    const userUses = await CouponRedemption.countDocuments({
      coupon: coupon._id,
      user: userId,
    });
    if (userUses >= coupon.perUserLimit) {
      throw new Error('You have already used this coupon the maximum number of times');
    }
  }

  return coupon;
}

// ─── Admin: CRUD ───────────────────────────────────────────────────

// @desc    List all coupons (admin)
// @route   GET /api/admin/coupons
// @access  Private/Admin
export const getCoupons = async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;

  const filter = {};
  if (search) {
    const q = String(search).trim();
    filter.$or = [
      { code: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      coupons,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// @desc    Create coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
export const createCoupon = async (req, res) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    maxDiscount,
    minOrderValue,
    startDate,
    expiresAt,
    usageLimit,
    perUserLimit,
    isActive,
  } = req.body;

  const coupon = await Coupon.create({
    code,
    description,
    discountType,
    discountValue,
    maxDiscount: maxDiscount || null,
    minOrderValue: minOrderValue || 0,
    startDate: startDate || Date.now(),
    expiresAt,
    usageLimit: usageLimit || 0,
    perUserLimit: perUserLimit ?? 1,
    isActive: isActive ?? true,
    createdBy: req.user?._id || null,
  });

  res.status(201).json({ status: 'success', data: { coupon } });
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:id
// @access  Private/Admin
export const updateCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  res.status(200).json({ status: 'success', data: { coupon } });
};

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
export const deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);

  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  res.status(200).json({ status: 'success', message: 'Coupon deleted' });
};

// ─── Admin: Usage Analytics ────────────────────────────────────────

// @desc    Get usage analytics for a coupon
// @route   GET /api/admin/coupons/:id/usage
// @access  Private/Admin
export const getCouponUsage = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id).lean();
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }

  const couponId = coupon._id;

  const [facets] = await CouponRedemption.aggregate([
    { $match: { coupon: couponId } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              redemptions: { $sum: 1 },
              uniqueUsers: { $addToSet: '$user' },
              discountGiven: { $sum: '$discountApplied' },
              revenueFromRedemptions: { $sum: '$orderValue' },
              avgOrderValue: { $avg: '$orderValue' },
            },
          },
          {
            $project: {
              _id: 0,
              redemptions: 1,
              uniqueUsers: { $size: '$uniqueUsers' },
              discountGiven: 1,
              revenueFromRedemptions: 1,
              avgOrderValue: { $round: ['$avgOrderValue', 2] },
            },
          },
        ],
        timeline: [
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$redeemedAt' },
              },
              count: { $sum: 1 },
              discount: { $sum: '$discountApplied' },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 30 },
          { $project: { _id: 0, date: '$_id', count: 1, discount: 1 } },
        ],
        topUsers: [
          {
            $group: {
              _id: '$user',
              count: { $sum: 1 },
              totalDiscount: { $sum: '$discountApplied' },
            },
          },
          { $sort: { count: -1, totalDiscount: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'userInfo',
            },
          },
          {
            $project: {
              _id: 0,
              userId: '$_id',
              name: { $arrayElemAt: ['$userInfo.name', 0] },
              username: { $arrayElemAt: ['$userInfo.username', 0] },
              count: 1,
              totalDiscount: 1,
            },
          },
        ],
      },
    },
  ]);

  const totals = facets?.totals?.[0] || {
    redemptions: 0,
    uniqueUsers: 0,
    discountGiven: 0,
    revenueFromRedemptions: 0,
    avgOrderValue: 0,
  };

  res.status(200).json({
    status: 'success',
    data: {
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        perUserLimit: coupon.perUserLimit,
      },
      totals,
      timeline: facets?.timeline || [],
      topUsers: facets?.topUsers || [],
    },
  });
};

// ─── Customer: Validate + Apply ────────────────────────────────────

// @desc    Dry-run validate a coupon (no redemption)
// @route   POST /api/coupons/validate
// @access  Private (user)
export const validateCouponHandler = async (req, res) => {
  const { code, orderValue } = req.body;
  const value = Number(orderValue);
  if (!value || value <= 0) {
    res.status(400);
    throw new Error('Order value is required');
  }

  const coupon = await validateCoupon({
    code,
    userId: req.user?._id,
    orderValue: value,
  });

  const discount = computeDiscount(coupon, value);

  res.status(200).json({
    status: 'success',
    data: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      discount,
      finalAmount: value - discount,
    },
  });
};

// @desc    Apply coupon — validate, increment usedCount atomically, log redemption
// @route   POST /api/coupons/apply
// @access  Private (user)
export const applyCoupon = async (req, res) => {
  const { code, orderValue, orderId } = req.body;
  const value = Number(orderValue);
  if (!value || value <= 0) {
    res.status(400);
    throw new Error('Order value is required');
  }

  const coupon = await validateCoupon({
    code,
    userId: req.user._id,
    orderValue: value,
  });

  // Atomic counter increment — prevents race past usageLimit
  const incFilter = { _id: coupon._id };
  if (coupon.usageLimit > 0) {
    incFilter.usedCount = { $lt: coupon.usageLimit };
  }
  const updated = await Coupon.findOneAndUpdate(
    incFilter,
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  if (!updated) {
    res.status(409);
    throw new Error('This coupon has just reached its usage limit');
  }

  const discount = computeDiscount(coupon, value);

  const redemption = await CouponRedemption.create({
    coupon: coupon._id,
    user: req.user._id,
    order: orderId || null,
    orderValue: value,
    discountApplied: discount,
  });

  res.status(200).json({
    status: 'success',
    data: {
      code: coupon.code,
      discount,
      finalAmount: value - discount,
      redemptionId: redemption._id,
    },
  });
};
