import Category from './categoryModel.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort('sortOrder')
    .lean();

  res.status(200).json({ status: 'success', data: { categories } });
};

// @desc    Get single category
// @route   GET /api/categories/:slug
// @access  Public
export const getCategory = async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug }).lean();

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.status(200).json({ status: 'success', data: { category } });
};

// @desc    Create category (admin only)
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  const { name, icon, sortOrder } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const category = await Category.create({ name, slug, icon, sortOrder });

  res.status(201).json({ status: 'success', data: { category } });
};

// @desc    Update category (admin only)
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  const updates = { ...req.body };
  if (updates.name) {
    updates.slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.status(200).json({ status: 'success', data: { category } });
};

// @desc    Delete category (admin only)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  res.status(200).json({ status: 'success', message: 'Category deleted' });
};
