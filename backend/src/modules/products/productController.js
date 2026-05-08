import Product from './productModel.js';

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
    sort = '-createdAt',
  } = req.query;

  const filter = { isActive: true };

  if (category) filter.category = { $regex: `^${category}$`, $options: 'i' };
  if (featured === 'true') filter.isFeatured = true;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
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
  const product = await Product.create(req.body);
  res.status(201).json({ status: 'success', data: { product } });
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
