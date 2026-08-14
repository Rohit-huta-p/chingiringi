import Product from './productModel.js';
import { merchantFromUrl } from '../../utils/merchant.js';

// @desc    Get all products (public — only active)
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    search,
    featured,
    sort = 'newest',
    minPrice,
    maxPrice,
    minCoins,
    maxCoins,
    minRating,
    minDiscount,
  } = req.query;

  const num = (v) => (v === undefined || v === '' ? undefined : Number(v));

  // ── Match (all optional). $text stays in the first stage so the text index
  //    is used; category is an exact case-insensitive match.
  const match = { isActive: true };
  if (category) match.category = { $regex: `^${category}$`, $options: 'i' };
  if (featured === 'true') match.isFeatured = true;
  if (search) match.$text = { $search: search };

  const priceRange = {};
  if (num(minPrice) !== undefined) priceRange.$gte = num(minPrice);
  if (num(maxPrice) !== undefined) priceRange.$lte = num(maxPrice);
  if (Object.keys(priceRange).length) match.price = priceRange;

  const coinsRange = {};
  if (num(minCoins) !== undefined) coinsRange.$gte = num(minCoins);
  if (num(maxCoins) !== undefined) coinsRange.$lte = num(maxCoins);
  if (Object.keys(coinsRange).length) match.coinsPrice = coinsRange;

  if (num(minRating) !== undefined) match.rating = { $gte: num(minRating) };

  // ── Sort: whitelist the client SortKeys (+ legacy mongo strings). 'discount'
  //    sorts on the computed field below. _id is a stable tie-break for paging.
  const SORT = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    best: { sold: -1 },
    discount: { _discount: -1 },
    '-createdAt': { createdAt: -1 },
  };
  const sortSpec = { ...(SORT[sort] || SORT.newest), _id: 1 };

  // Discount % = (mrp − price)/mrp × 100 when mrp is set and above price; else 0.
  const discountExpr = {
    $cond: [
      { $and: [{ $gt: ['$mrp', 0] }, { $gt: ['$mrp', '$price'] }] },
      { $multiply: [{ $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 100] },
      0,
    ],
  };

  const pipeline = [{ $match: match }, { $addFields: { _discount: discountExpr } }];
  if (num(minDiscount) !== undefined && num(minDiscount) > 0) {
    pipeline.push({ $match: { _discount: { $gte: num(minDiscount) } } });
  }
  pipeline.push({ $sort: sortSpec });

  const pageN = Math.max(1, Number(page) || 1);
  const limitN = Math.max(1, Number(limit) || 12);
  pipeline.push({
    $facet: {
      products: [{ $skip: (pageN - 1) * limitN }, { $limit: limitN }, { $project: { _discount: 0 } }],
      total: [{ $count: 'count' }],
    },
  });

  const [result] = await Product.aggregate(pipeline);
  const products = result?.products ?? [];
  const total = result?.total?.[0]?.count ?? 0;

  res.status(200).json({
    status: 'success',
    data: {
      products,
      pagination: {
        page: pageN,
        limit: limitN,
        total,
        pages: Math.ceil(total / limitN),
      },
    },
  });
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
  const products = await Product.find({ isActive: true, isFeatured: true })
    .sort('-createdAt')
    .limit(12)
    .lean();

  res.status(200).json({ status: 'success', data: { products } });
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  const product = await Product.findById(req.params.id).lean();

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({ status: 'success', data: { product } });
};

// @desc    Create product (admin only)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  // Auto-fill the store from the buy link when the admin left it blank.
  if (!req.body.merchant && req.body.affiliateUrl) {
    req.body.merchant = merchantFromUrl(req.body.affiliateUrl);
  }
  const product = await Product.create(req.body);
  res.status(201).json({ status: 'success', data: { product } });
};

// @desc    Bulk-create products (admin only) — CSV/paste import + paste-many links
// @route   POST /api/products/bulk
// @access  Private/Admin
export const bulkCreateProducts = async (req, res) => {
  const items = Array.isArray(req.body?.products) ? req.body.products : [];
  if (!items.length) {
    res.status(400);
    throw new Error('products[] is required');
  }
  if (items.length > 500) {
    res.status(400);
    throw new Error('Max 500 products per import');
  }

  // Validate + normalise each row. Rows that fail (no name / bad price) are
  // reported by index instead of aborting the whole batch. imageUrl/mobileImageUrl
  // mirror gallery[0] exactly like the single-create form does.
  const docs = [];
  const errors = [];
  items.forEach((p, i) => {
    const name = String(p?.name ?? '').trim();
    const price = Number(p?.price);
    if (!name) return errors.push({ row: i, error: 'name is required' });
    if (!Number.isFinite(price) || price < 0) return errors.push({ row: i, error: 'price must be a number ≥ 0' });

    const images = (Array.isArray(p.images) ? p.images : []).map((u) => String(u).trim()).filter(Boolean);
    const mobileImages = (Array.isArray(p.mobileImages) ? p.mobileImages : []).map((u) => String(u).trim()).filter(Boolean);
    const affiliateUrl = String(p.affiliateUrl ?? '').trim();
    const merchant = String(p.merchant ?? '').trim() || merchantFromUrl(affiliateUrl);
    docs.push({
      name,
      description: String(p.description ?? '').trim(),
      category: String(p.category ?? '').trim(),
      price,
      mrp: Number(p.mrp) > 0 ? Number(p.mrp) : 0,
      merchant,
      affiliateUrl,
      images,
      imageUrl: images[0] ?? String(p.imageUrl ?? '').trim(),
      mobileImages,
      mobileImageUrl: mobileImages[0] ?? String(p.mobileImageUrl ?? '').trim(),
      rating: Math.max(0, Math.min(5, Number(p.rating) || 0)),
      ratingCount: Math.max(0, Math.round(Number(p.ratingCount) || 0)),
    });
  });

  let created = 0;
  if (docs.length) {
    const inserted = await Product.insertMany(docs, { ordered: false });
    created = inserted.length;
  }

  res.status(201).json({
    status: 'success',
    data: { received: items.length, created, failed: errors.length, errors },
  });
};

// @desc    Update product (admin only)
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({ status: 'success', data: { product } });
};

// @desc    Delete product (admin only)
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({ status: 'success', message: 'Product deleted' });
};

// @desc    Admin list (all products, including inactive)
// @route   GET /api/admin/products
// @access  Private/Admin
export const getAllProductsAdmin = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';

  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.json({
    status: 'success',
    data: { products, total, page, pages: Math.ceil(total / limit) },
  });
};
