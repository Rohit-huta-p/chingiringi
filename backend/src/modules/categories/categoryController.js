import Category from './categoryModel.js';
import Product from '../products/productModel.js';
import Deal from '../deals/dealModel.js';

// Escape a user-supplied string for safe use inside a RegExp.
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const { name, icon, sortOrder, showOnDealsPage, dealsPageSortOrder } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const category = await Category.create({
    name, slug, icon, sortOrder,
    // showOnDealsPage defaults true in schema — only override when caller
    // explicitly sends a value (admin form). Same for dealsPageSortOrder.
    ...(showOnDealsPage !== undefined ? { showOnDealsPage } : {}),
    ...(dealsPageSortOrder !== undefined ? { dealsPageSortOrder } : {}),
  });

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
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  // How many things reference this category? Products link by free-text name
  // (case-insensitive), deals link by ObjectId.
  const nameRe = new RegExp(`^${escapeRegex(category.name)}$`, 'i');
  const [productCount, dealCount] = await Promise.all([
    Product.countDocuments({ category: nameRe }),
    Deal.countDocuments({ category: category._id }),
  ]);
  const inUse = productCount + dealCount > 0;

  // reassignTo: undefined → block if in use | '' → uncategorised | <id> → target
  const { reassignTo } = req.query;

  // In use and the caller hasn't said what to do → block with the counts so
  // the UI can prompt for reassignment (prevents orphaned products / dangling
  // deal refs).
  if (inUse && reassignTo === undefined) {
    return res.status(409).json({
      status: 'error',
      code: 'CATEGORY_IN_USE',
      message: `"${category.name}" is used by ${productCount} product${productCount === 1 ? '' : 's'} and ${dealCount} deal${dealCount === 1 ? '' : 's'}. Reassign them before deleting.`,
      data: { products: productCount, deals: dealCount },
    });
  }

  // Reassign references, then delete.
  if (inUse) {
    let targetName = ''; // products (string) — '' means uncategorised
    let targetId = null; // deals (ObjectId) — required, so must resolve to a real category
    if (reassignTo) {
      if (String(reassignTo) === String(category._id)) {
        res.status(400);
        throw new Error('Cannot reassign to the category being deleted');
      }
      const target = await Category.findById(reassignTo);
      if (!target) {
        res.status(400);
        throw new Error('Reassignment target category not found');
      }
      targetName = target.name;
      targetId = target._id;
    }
    // Deals must keep a category (schema-required) — refuse to orphan them.
    if (dealCount > 0 && !targetId) {
      res.status(400);
      throw new Error(`Pick a category to move the ${dealCount} deal${dealCount === 1 ? '' : 's'} to — deals must have a category.`);
    }
    if (productCount > 0) {
      await Product.updateMany({ category: nameRe }, { $set: { category: targetName } });
    }
    if (dealCount > 0) {
      await Deal.updateMany({ category: category._id }, { $set: { category: targetId } });
    }
  }

  await Category.findByIdAndDelete(category._id);
  res.status(200).json({ status: 'success', message: 'Category deleted' });
};
