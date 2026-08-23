import Store from './storeModel.js';
import Stream from '../streams/streamModel.js';
import { formatTime, isOpenNow } from './storeHours.js';
import { resolveGoogleMapsCoords } from './googleMapsCoords.js';

// Fields that must never reach a public (non-admin) client.
const PUBLIC_EXCLUDE = '-platformCommissionPercent -payoutAccount';

// Parse coords from a pasted Google Maps link and write lat/lng onto `target`
// (a plain body object or a Mongoose doc). An empty link clears the pin; an
// unparseable/failed link leaves existing coords untouched (avoids wiping a
// good pin on a transient network hiccup).
const applyMapsCoords = async (target, mapsUrl) => {
  if (typeof mapsUrl !== 'string') return;
  if (!mapsUrl.trim()) {
    target.lat = null;
    target.lng = null;
    return;
  }
  const coords = await resolveGoogleMapsCoords(mapsUrl);
  if (coords) {
    target.lat = coords.lat;
    target.lng = coords.lng;
  }
};

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
  const { page = 1, limit = 50, category, search, featured, sort = '-createdAt', verificationStatus } = req.query;

  // When filtering by verificationStatus (admin use), don't restrict to isActive
  // so we catch stores in any lifecycle state.
  const filter = verificationStatus ? {} : { isActive: true };
  if (category && category !== 'All') filter.category = category;
  if (featured === 'true') filter.isFeatured = true;
  if (search) filter.$text = { $search: search };
  if (verificationStatus) {
    const statuses = String(verificationStatus).split(',').map((s) => s.trim()).filter(Boolean);
    filter.verificationStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }

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
  const body = { ...req.body };
  await applyMapsCoords(body, body.mapsUrl); // maps link → lat/lng
  const store = await Store.create(body);
  res.status(201).json({ status: 'success', data: { store } });
};

// @desc    Seller self-creates their own store
// @route   POST /api/stores/seller
// @access  Private (any authenticated user with role === 'seller')
export const createSellerStore = async (req, res) => {
  // Prevent duplicate stores — one store per seller account.
  const existing = await Store.findOne({ ownerId: req.user._id });
  if (existing) {
    // Return the existing store so the frontend can navigate to verification.
    return res.status(200).json({
      status: 'success',
      message: 'Store already exists for this account.',
      data: { store: existing },
    });
  }

  const { name, category, address, area, city, logoUrl, phone } = req.body;

  if (!name || !category || !address) {
    res.status(400);
    throw new Error('name, category, and address are required.');
  }

  // shortName = first 2 words of the store name (truncated display label).
  const shortName = req.body.shortName
    || name.trim().split(/\s+/).slice(0, 2).join(' ');

  const store = await Store.create({
    name:               name.trim(),
    shortName,
    category,
    address:            address.trim(),
    area:               area?.trim()    || '',
    city:               city?.trim()    || 'Bengaluru',
    logoUrl:            logoUrl         || '',
    phone:              phone           || '',
    ownerId:            req.user._id,
    verificationStatus: 'unverified',
  });

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
  if ('mapsUrl' in req.body) await applyMapsCoords(store, req.body.mapsUrl); // re-resolve pin
  await store.save(); // re-runs pre-save (slug)
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

// @desc    Get the store owned by the authenticated user
// @route   GET /api/stores/mine
// @access  Private
export const getMyStore = async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id })
    .populate('products')
    .lean();
  if (!store) {
    res.status(404);
    throw new Error('No store found for this account');
  }
  res.status(200).json({ status: 'success', data: { store: decorate(store) } });
};

// @desc    Get live-commerce stats for a store
// @route   GET /api/stores/:id/stats
// @access  Public
export const getStoreStats = async (req, res) => {
  const store = await Store.findById(req.params.id).select('followerCount').lean();
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [streamStats, totalProducts] = await Promise.all([
    Stream.aggregate([
      { $match: { storeId: store._id } },
      {
        $group: {
          _id: null,
          totalStreams: { $sum: 1 },
          viewsLast7Days: {
            $sum: {
              $cond: [{ $gte: ['$startedAt', sevenDaysAgo] }, '$viewerCount', 0],
            },
          },
        },
      },
    ]),
    // Count products via the products module (avoid circular dep — use mongoose directly)
    (async () => {
      try {
        const mongoose = await import('mongoose');
        return mongoose.default.model('Product').countDocuments({ storeId: req.params.id });
      } catch {
        return 0;
      }
    })(),
  ]);

  const stats = streamStats[0] || { totalStreams: 0, viewsLast7Days: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      followerCount: store.followerCount,
      totalStreams: stats.totalStreams,
      viewsLast7Days: stats.viewsLast7Days,
      totalProducts,
    },
  });
};

// @desc    Submit / update verification doc; admin can approve/reject
// @route   PATCH /api/stores/:id/verification
// @access  Private (seller = submit; admin = approve/reject)
export const updateVerification = async (req, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = store.ownerId?.toString() === req.user._id.toString();

  if (!isAdmin && !isOwner) {
    res.status(403);
    throw new Error('Not authorised to update verification for this store');
  }

  if (isAdmin) {
    // Admin approves or rejects
    const { status, rejectionReason } = req.body;
    const allowed = ['verified', 'rejected', 'pending', 'unverified'];
    if (!allowed.includes(status)) {
      res.status(400);
      throw new Error(`status must be one of: ${allowed.join(', ')}`);
    }
    store.verificationStatus = status;
    if (status === 'rejected' && rejectionReason) {
      store.verificationDoc.rejectionReason = rejectionReason;
    }
    if (status === 'verified') store.isVerified = true;
    if (status === 'rejected' || status === 'unverified') store.isVerified = false;
  } else {
    // Seller submits a doc
    const { docType, docUrl } = req.body;
    if (!docType || !docUrl) {
      res.status(400);
      throw new Error('docType and docUrl are required');
    }
    store.verificationStatus = 'pending';
    store.verificationDoc = {
      type: docType,
      url: docUrl,
      submittedAt: new Date(),
      rejectionReason: '',
    };
  }

  await store.save();
  res.status(200).json({ status: 'success', data: { verificationStatus: store.verificationStatus } });
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
