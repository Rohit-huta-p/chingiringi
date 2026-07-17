import User from './userModel.js';
import Wallet from '../wallet/walletModel.js';

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
export const updateProfile = async (req, res) => {
  const allowedFields = ['name', 'email', 'phone', 'avatarUrl'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error('No valid fields to update');
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select('-passwordHash -refreshTokens');

  res.status(200).json({ status: 'success', data: { user } });
};

// @desc    Get full profile with wallet stats
// @route   GET /api/profile
// @access  Private
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-passwordHash -refreshTokens')
    .lean();

  let wallet = await Wallet.findOne({ userId: req.user._id }).lean();

  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id });
    wallet = wallet.toObject();
  }

  res.status(200).json({
    status: 'success',
    data: { user, wallet },
  });
};

// @desc    Update notification preferences
// @route   PATCH /api/profile/notification-prefs
// @access  Private
export const updateNotificationPrefs = async (req, res) => {
  const allowedFields = ['cashback', 'withdrawals', 'push'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[`notificationPrefs.${field}`] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error('No valid fields to update');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-passwordHash -refreshTokens');

  res.status(200).json({ status: 'success', data: { user } });
};

// @desc    Delete user account
// @route   DELETE /api/profile
// @access  Private
export const deleteAccount = async (req, res) => {
  await User.findByIdAndDelete(req.user._id);

  // Clear auth cookies
  res.cookie('accessToken', '', { maxAge: 0 });
  res.cookie('refreshToken', '', { maxAge: 0 });

  res.status(200).json({ status: 'success', message: 'Account deleted' });
};
