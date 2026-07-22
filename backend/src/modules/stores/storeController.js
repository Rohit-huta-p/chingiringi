import Store from './storeModel.js';
import { formatTime, isOpenNow } from './storeHours.js';

// Fields that must never reach a public (non-admin) client.
const PUBLIC_EXCLUDE = '-platformCommissionPercent -payoutAccount';

// Attach computed display/status fields to a lean store object.
const decorate = (s) => ({
  ...s,
  isOpen: isOpenNow(s.openTime, s.closeTime, s.openDays),
  opensAt: formatTime(s.openTime),
});

// @desc    Get active stores (public — deal terms stripped)
// @route   GET /api/stores
// @access  Public
export const getStores = async (req, res) => {
  const { page = 1, limit = 50, category, search, featured, sort = '-createdAt' } = req.query;

  const filter = { isActive: true };
  if (category && category !== 'All') filter.category = category;
  if (featured === 'true') filter.isFeatured = true;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [stores, total] = await Promise.all([
    Store.find(filter).select(PUBLIC_EXCLUDE).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Store.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stores: stores.map(decorate),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// @desc    Get single store (public)
// @route   GET /api/stores/:id
// @access  Public
export const getStore = async (req, res) => {
  const store = await Store.findById(req.params.id).select(PUBLIC_EXCLUDE).lean();
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  res.status(200).json({ status: 'success', data: { store: decorate(store) } });
};

// @desc    Create store (admin only)
// @route   POST /api/stores
// @access  Private/Admin
export const createStore = async (req, res) => {
  const store = await Store.create(req.body);
  res.status(201).json({ status: 'success', data: { store } });
};

// @desc    Update store (admin only)
// @route   PUT /api/stores/:id
// @access  Private/Admin
export const updateStore = async (req, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  Object.assign(store, req.body);
  await store.save(); // re-runs pre-save (slug + geo point)
  res.status(200).json({ status: 'success', data: { store } });
};

// @desc    Delete store (admin only)
// @route   DELETE /api/stores/:id
// @access  Private/Admin
export const deleteStore = async (req, res) => {
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  res.status(200).json({ status: 'success', message: 'Store deleted' });
};

// @desc    Admin list (all stores incl. inactive, WITH deal terms)
// @route   GET /api/admin/stores
// @access  Private/Admin
export const getAllStoresAdmin = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = req.query.search || '';

  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const [stores, total] = await Promise.all([
    Store.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Store.countDocuments(query),
  ]);

  res.json({
    status: 'success',
    data: { stores: stores.map(decorate), total, page, pages: Math.ceil(total / limit) },
  });
};
