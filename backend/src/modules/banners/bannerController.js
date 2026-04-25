import Banner from './bannerModel.js';

// @desc    Get ALL banners (admin view — no active/date filter)
// @route   GET /api/admin/banners
// @access  Private/Admin
export const getAdminBanners = async (req, res) => {
  const banners = await Banner.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean();
  res.status(200).json({ status: 'success', data: { banners } });
};

// @desc    Get active banners
// @route   GET /api/banners
// @access  Public
// Filters supported:
//   ?slot=hero|flash-strip|dual-left|dual-right|earn-coins|refer-earn|inline-1|inline-2
//   ?position=hero|sidebar|inline (legacy — kept for BC)
export const getBanners = async (req, res) => {
  const { position, slot } = req.query;

  const filter = {
    isActive: true,
    startsAt: { $lte: new Date() },
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
  };

  if (slot) filter.slot = slot;
  else if (position) filter.position = position;

  const banners = await Banner.find(filter).sort('sortOrder').lean();

  res.status(200).json({ status: 'success', data: { banners } });
};

// @desc    Create banner (admin only)
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = async (req, res) => {
  const banner = await Banner.create(req.body);

  res.status(201).json({ status: 'success', data: { banner } });
};

// @desc    Update banner (admin only)
// @route   PUT /api/banners/:id
// @access  Private/Admin
export const updateBanner = async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!banner) {
    res.status(404);
    throw new Error('Banner not found');
  }

  res.status(200).json({ status: 'success', data: { banner } });
};

// @desc    Delete banner (admin only)
// @route   DELETE /api/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);

  if (!banner) {
    res.status(404);
    throw new Error('Banner not found');
  }

  res.status(200).json({ status: 'success', message: 'Banner deleted' });
};
