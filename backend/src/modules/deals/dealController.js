import Deal from './dealModel.js';
import Category from '../categories/categoryModel.js';

// @desc    Get all deals (with filters, search, pagination)
// @route   GET /api/deals
// @access  Public
export const getDeals = async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    search,
    brand,
    featured,
    sort = '-createdAt',
  } = req.query;

  const filter = { isActive: true, expiresAt: { $gt: new Date() } };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) filter.category = cat._id;
  }

  if (brand) filter.brand = { $regex: brand, $options: 'i' };
  if (featured === 'true') filter.isFeatured = true;

  if (search) {
    filter.$text = { $search: search };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [deals, total] = await Promise.all([
    Deal.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Deal.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      deals,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// @desc    Get single deal
// @route   GET /api/deals/:id
// @access  Public
export const getDeal = async (req, res) => {
  const deal = await Deal.findById(req.params.id)
    .populate('category', 'name slug')
    .lean();

  if (!deal) {
    res.status(404);
    throw new Error('Deal not found');
  }

  res.status(200).json({ status: 'success', data: { deal } });
};

// @desc    Get featured deals
// @route   GET /api/deals/featured
// @access  Public
export const getFeaturedDeals = async (req, res) => {
  const deals = await Deal.find({
    isActive: true,
    isFeatured: true,
    expiresAt: { $gt: new Date() },
  })
    .populate('category', 'name slug')
    .sort('-createdAt')
    .limit(6)
    .lean();

  res.status(200).json({ status: 'success', data: { deals } });
};

// @desc    Get trending brands (top brands by click count)
// @route   GET /api/deals/trending-brands
// @access  Public
export const getTrendingBrands = async (req, res) => {
  const brands = await Deal.aggregate([
    { $match: { isActive: true, expiresAt: { $gt: new Date() } } },
    {
      $group: {
        _id: '$brand',
        totalClicks: { $sum: '$clickCount' },
        maxCashback: { $max: '$cashbackPercent' },
        dealCount: { $sum: 1 },
        category: { $first: '$category' },
      },
    },
    { $sort: { totalClicks: -1 } },
    { $limit: 8 },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo',
      },
    },
    {
      $project: {
        brand: '$_id',
        totalClicks: 1,
        maxCashback: 1,
        dealCount: 1,
        category: { $arrayElemAt: ['$categoryInfo.name', 0] },
      },
    },
  ]);

  res.status(200).json({ status: 'success', data: { brands } });
};

// @desc    Track deal click (increment count + return affiliate URL)
// @route   POST /api/deals/:id/click
// @access  Private
export const trackDealClick = async (req, res) => {
  const deal = await Deal.findByIdAndUpdate(
    req.params.id,
    { $inc: { clickCount: 1 } },
    { new: true }
  );

  if (!deal) {
    res.status(404);
    throw new Error('Deal not found');
  }

  res.status(200).json({
    status: 'success',
    data: { affiliateUrl: deal.affiliateUrl },
  });
};

// @desc    Create deal (admin only)
// @route   POST /api/deals
// @access  Private/Admin
export const createDeal = async (req, res) => {
  const deal = await Deal.create(req.body);
  await deal.populate('category', 'name slug');

  res.status(201).json({ status: 'success', data: { deal } });
};

// @desc    Update deal (admin only)
// @route   PUT /api/deals/:id
// @access  Private/Admin
export const updateDeal = async (req, res) => {
  const deal = await Deal.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('category', 'name slug');

  if (!deal) {
    res.status(404);
    throw new Error('Deal not found');
  }

  res.status(200).json({ status: 'success', data: { deal } });
};

// @desc    Delete deal (admin only)
// @route   DELETE /api/deals/:id
// @access  Private/Admin
export const deleteDeal = async (req, res) => {
  const deal = await Deal.findByIdAndDelete(req.params.id);

  if (!deal) {
    res.status(404);
    throw new Error('Deal not found');
  }

  res.status(200).json({ status: 'success', message: 'Deal deleted' });
};
