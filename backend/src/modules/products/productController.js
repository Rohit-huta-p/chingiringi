import Product from './productModel.js';
import { merchantFromUrl } from '../../utils/merchant.js';
import { buildSearchPipeline } from './searchPipeline.js';

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
    sort = null,          // null → relevance when searching, newest otherwise
    minPrice,
    maxPrice,
    minCoins,
    maxCoins,
    minRating,
    minDiscount,
  } = req.query;

  const num = (v) => (v === undefined || v === '' ? undefined : Number(v));

  const opts = {
    search: search?.trim() || undefined,
    category: category || undefined,
    featured: featured === 'true',
    sort: sort || null,
    minPrice:    num(minPrice),
    maxPrice:    num(maxPrice),
    minCoins:    num(minCoins),
    maxCoins:    num(maxCoins),
    minRating:   num(minRating),
    minDiscount: num(minDiscount),
    page:  Math.max(1, Number(page) || 1),
    limit: Math.max(1, Number(limit) || 12),
  };

  const pipeline = buildSearchPipeline(opts);

  let result;
  try {
    [result] = await Product.aggregate(pipeline);
  } catch (err) {
    // Atlas Search index missing or unavailable — degrade to $text search.
    // The $text index is kept on the schema specifically for this fallback.
    if (opts.search && err.message?.includes('$search')) {
      console.error('[search] Atlas Search unavailable, degrading to $text:', err.message);
      const degradedOpts = { ...opts, search: undefined };
      const degradedPipeline = buildSearchPipeline(degradedOpts);
      // Add $text match manually at the front
      const textMatch = { isActive: true, $text: { $search: opts.search } };
      degradedPipeline.unshift({ $match: textMatch });
      [result] = await Product.aggregate(degradedPipeline);
    } else {
      throw err;
    }
  }

  const products = result?.products ?? [];
  const total    = result?.total?.[0]?.count ?? 0;

  // Near-miss: if the filtered search returned nothing, run the same Atlas query
  // WITHOUT the non-search filters (drop category, price, coins, rating, discount).
  // Returns up to 6 products so the user sees something instead of a blank page.
  // Runs server-side in the same request — no second round-trip from the client.
  let nearMisses = [];
  if (total === 0 && opts.search) {
    try {
      const nearPipeline = buildSearchPipeline({
        search: opts.search,
        sort: null,     // relevance order
        page: 1,
        limit: 6,
        // intentionally no category / price / coins / rating / discount
      });
      const [nearResult] = await Product.aggregate(nearPipeline);
      nearMisses = nearResult?.products ?? [];
    } catch {
      // near-miss failure is non-fatal; empty array is fine
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      products,
      nearMisses,
      pagination: {
        page:  opts.page,
        limit: opts.limit,
        total,
        pages: Math.ceil(total / opts.limit),
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
