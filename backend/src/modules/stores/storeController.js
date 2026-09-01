import Store from './storeModel.js';
import StoreReview from './storeReviewModel.js';
import Stream from '../streams/streamModel.js';
import { formatTime, isOpenNow } from './storeHours.js';
import { resolveGoogleMapsCoords } from './googleMapsCoords.js';
import { uploadKycImage, signedKycUrl, kycConfigured } from '../../services/cloudinaryKyc.js';

// Fields that must never reach a public (non-admin) client.
// Public responses must never leak the seller's private review docs — the store
// verification document and (especially) the personal identity ID + selfie.
const PUBLIC_EXCLUDE = '-platformCommissionPercent -payoutAccount -verificationDoc -identityDoc';

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

  const { name, category, address, area, city, logoUrl, phone, website } = req.body;

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
    website:            website?.trim() || '',
    ownerId:            req.user._id,
    verificationStatus: 'unverified',
  });

  res.status(201).json({ status: 'success', data: { store } });
};

// Fields a seller may edit on their own store — excludes deal terms,
// verification, ownership, flags and ratings (admin-controlled or computed).
const SELLER_STORE_FIELDS = [
  'name', 'shortName', 'category', 'description',
  'logoUrl', 'images', 'phone', 'website',
  'address', 'area', 'city', 'mapsUrl',
  'openTime', 'closeTime', 'openDays',
];

// @desc    Seller updates their own store
// @route   PATCH /api/stores/mine
// @access  Private (seller)
export const updateMyStore = async (req, res) => {
  const store = await Store.findOne({ ownerId: req.user._id });
  if (!store) {
    res.status(404);
    throw new Error('No store found for this account.');
  }
  for (const k of SELLER_STORE_FIELDS) if (k in req.body) store[k] = req.body[k];
  if ('mapsUrl' in req.body) await applyMapsCoords(store, req.body.mapsUrl); // re-resolve pin
  await store.save(); // re-runs pre-save (slug)
  res.status(200).json({ status: 'success', data: { store: decorate(store.toObject()) } });
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
  // No .populate('products'): Store has no `products` path, and Mongoose 9
  // strictPopulate throws on an unknown path → 500. Sellers load their products
  // separately via GET /api/products?storeId=.
  const store = await Store.findOne({ ownerId: req.user._id }).lean();
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

// @desc    Admin review queue — stores awaiting verification, WITH the private
//          store + identity docs so the admin can actually review them.
// @route   GET /api/stores/admin/verifications?status=pending,rejected
// @access  Private/Admin
export const getVerificationQueue = async (req, res) => {
  const statuses = String(req.query.status || 'pending,rejected')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const filter = statuses.length ? { verificationStatus: { $in: statuses } } : {};
  // Populate the owner account so the admin can match the person to the govt ID
  // (admin-only endpoint). ownerId stays a plain id in the response; the owner
  // identity is surfaced under a separate `owner` field.
  const stores = await Store.find(filter)
    .populate('ownerId', 'name email phone avatarUrl')
    .sort('-updatedAt')
    .limit(200)
    .lean();
  const shaped = stores.map((s) => {
    const o = s.ownerId && typeof s.ownerId === 'object' ? s.ownerId : null;
    const owner = o
      ? { _id: o._id, name: o.name, email: o.email, phone: o.phone, avatarUrl: o.avatarUrl }
      : null;
    return { ...decorate(s), ownerId: o?._id ?? s.ownerId, owner };
  });
  res.status(200).json({ status: 'success', data: { stores: shaped } });
};

// @desc    Upload one KYC image (store doc / ID / selfie) as a PRIVATE asset.
//          Returns identifiers to rebuild a signed URL later — never a public URL.
// @route   POST /api/stores/kyc/upload   (multipart, field "file")
// @access  Private (any authenticated user submitting their own verification)
export const uploadKyc = async (req, res) => {
  if (!kycConfigured()) {
    res.status(503);
    throw new Error('Secure document upload is not configured on the server yet.');
  }
  if (!req.file?.buffer) {
    res.status(400);
    throw new Error('No image file received.');
  }
  // Fold under the CALLER'S OWN store (derived server-side, never a client-
  // supplied id — so a seller can't write into another store's KYC folder).
  // No store yet (onboarding) → the service uses a staging folder.
  const own = await Store.findOne({ ownerId: req.user._id }).select('_id').lean();
  const out = await uploadKycImage(req.file.buffer, {
    storeId: own?._id ? own._id.toString() : undefined,
    kind: req.body?.kind,
  });
  res.status(201).json({ status: 'success', data: out }); // { publicId, format, version }
};

// @desc    Freshly-signed, inline-renderable URLs for a store's KYC media.
//          Minted on demand; never stored. Owner (own store) or admin only.
// @route   GET /api/stores/:id/kyc
// @access  Private (owner or admin)
export const getStoreKyc = async (req, res) => {
  const store = await Store.findById(req.params.id).lean();
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  const isAdmin = req.user.role === 'admin';
  const isOwner = store.ownerId?.toString() === req.user._id.toString();
  if (!isAdmin && !isOwner) {
    res.status(403);
    throw new Error('Not authorised to view this store’s documents');
  }

  const vd = store.verificationDoc || {};
  const idd = store.identityDoc || {};
  // Prefer a signed private URL; fall back to a legacy public URL for old rows.
  const resolve = (publicId, format, legacyUrl) =>
    (publicId && signedKycUrl(publicId, { format })) || legacyUrl || null;

  res.status(200).json({
    status: 'success',
    data: {
      doc:    resolve(vd.publicId, vd.format, vd.url),
      id:     resolve(idd.docPublicId, idd.docFormat, idd.docUrl),
      selfie: resolve(idd.selfiePublicId, idd.selfieFormat, idd.selfieUrl),
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
    // Approve-guard: can't verify a store that hasn't submitted BOTH the store
    // document and personal identity (ID + selfie).
    if (status === 'verified') {
      const hasStoreDoc = !!(store.verificationDoc?.url || store.verificationDoc?.publicId);
      const hasIdentity = !!(store.identityDoc?.docUrl || store.identityDoc?.docPublicId)
        && !!(store.identityDoc?.selfieUrl || store.identityDoc?.selfiePublicId);
      if (!hasStoreDoc || !hasIdentity) {
        res.status(400);
        throw new Error('Cannot verify: the store document and identity (ID + selfie) must both be submitted.');
      }
    }
    store.verificationStatus = status;
    // Keep the public `isVerified` badge in lockstep with the status so a revoke
    // (verified → pending) actually drops the badge, not just the queue state.
    store.isVerified = status === 'verified';
    if (status === 'rejected') {
      if (rejectionReason && store.verificationDoc) store.verificationDoc.rejectionReason = rejectionReason;
    } else if (store.verificationDoc) {
      // Clear any stale rejection note when re-opening or approving.
      store.verificationDoc.rejectionReason = '';
    }
  } else {
    // Seller submits the store document and/or personal identity. Either part
    // can arrive alone (onboarding sends identity; the verification screen sends
    // both) — the store flips to 'pending' only once BOTH are on file.
    // New clients send private Cloudinary publicIds (+ format); older ones may
    // still send public *Url values, which we keep accepting for back-compat.
    const {
      docType, docUrl, docPublicId, docFormat,
      identityType, identityDocUrl, identityDocPublicId, identityDocFormat,
      selfieUrl, selfiePublicId, selfieFormat,
    } = req.body;

    if (docUrl || docPublicId) {
      store.verificationDoc = {
        type:            docType || store.verificationDoc?.type || '',
        url:             docUrl || '',
        publicId:        docPublicId || '',
        format:          docFormat || '',
        submittedAt:     new Date(),
        rejectionReason: '',
      };
    }
    if (identityDocUrl || identityDocPublicId || selfieUrl || selfiePublicId) {
      store.identityDoc = {
        type:           identityType || store.identityDoc?.type || '',
        docUrl:         identityDocUrl || store.identityDoc?.docUrl || '',
        docPublicId:    identityDocPublicId || store.identityDoc?.docPublicId || '',
        docFormat:      identityDocFormat || store.identityDoc?.docFormat || '',
        selfieUrl:      selfieUrl || store.identityDoc?.selfieUrl || '',
        selfiePublicId: selfiePublicId || store.identityDoc?.selfiePublicId || '',
        selfieFormat:   selfieFormat || store.identityDoc?.selfieFormat || '',
        submittedAt:    new Date(),
      };
    }

    const hasDoc    = !!(store.verificationDoc?.url || store.verificationDoc?.publicId);
    const hasIdDoc  = !!(store.identityDoc?.docUrl || store.identityDoc?.docPublicId);
    const hasSelfie = !!(store.identityDoc?.selfieUrl || store.identityDoc?.selfiePublicId);

    if (!hasDoc && !hasIdDoc && !hasSelfie) {
      res.status(400);
      throw new Error('Provide a store document and/or identity (ID + selfie).');
    }

    // Full submission = store document + identity (ID + selfie), all present.
    store.verificationStatus = hasDoc && hasIdDoc && hasSelfie ? 'pending' : 'unverified';
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

// ── Store reviews ─────────────────────────────────────────────────────────────

/**
 * GET /api/stores/:id/reviews  (public)
 * A store's reviews, newest-first, with count + average rating.
 */
export const getStoreReviews = async (req, res) => {
  const reviews = await StoreReview.find({ store: req.params.id })
    .populate('user', 'name avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  const count = reviews.length;
  const averageRating = count
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
    : 0;

  res.status(200).json({ status: 'success', data: { reviews, count, averageRating } });
};

/**
 * POST /api/stores/:id/reviews  (auth)
 * Create the caller's review (one per store), then recompute + persist the
 * store's rating/reviewsCount aggregate from the full review set.
 */
export const createStoreReview = async (req, res) => {
  const storeId = req.params.id;
  const rating = Number(req.body?.rating);
  const text = (req.body?.text ?? '').toString().trim();

  if (!(rating >= 1 && rating <= 5)) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  const store = await Store.findById(storeId).select('_id');
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  let doc;
  try {
    doc = await StoreReview.create({
      store: storeId,
      user:  req.user._id,
      rating,
      text:  text.slice(0, 500),
    });
  } catch (err) {
    if (err?.code === 11000) {
      res.status(409);
      throw new Error('You have already reviewed this store');
    }
    throw err;
  }

  // Recompute aggregates from the full set and persist onto the store doc.
  const all = await StoreReview.find({ store: storeId }).select('rating').lean();
  const reviewsCount = all.length;
  const averageRating = reviewsCount
    ? Math.round((all.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 10) / 10
    : 0;
  await Store.findByIdAndUpdate(storeId, { rating: averageRating, reviewsCount });

  await doc.populate('user', 'name avatarUrl');
  res.status(201).json({ status: 'success', data: { review: doc, averageRating, reviewsCount } });
};
