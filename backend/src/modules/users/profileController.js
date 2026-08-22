import User from './userModel.js';
import Wallet from '../wallet/walletModel.js';
import { deleteUserAndData } from './accountDeletion.js';
import { generateAndStoreOTP, verifyUserOTP } from '../auth/authService.js';
import { sendMail, isEmailConfigured } from '../../services/email.js';
import { AUTH_COOKIE_OPTS } from '../../utils/generateToken.js';

// @desc    Set role for the authenticated user (buyer | seller only)
// @route   PATCH /api/profile/role
// @access  Private
export const updateRole = async (req, res) => {
  const { role } = req.body;
  const ALLOWED = ['buyer', 'seller'];

  if (!role || !ALLOWED.includes(role)) {
    res.status(400);
    throw new Error(`role must be one of: ${ALLOWED.join(', ')}`);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { role },
    { new: true, runValidators: true }
  ).select('-passwordHash -refreshTokens');

  res.status(200).json({ status: 'success', data: { user } });
};

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

  // Changing the email invalidates verification — the new address must be re-verified.
  if (updates.email !== undefined) {
    const current = await User.findById(req.user._id).select('email').lean();
    if ((current?.email || '') !== String(updates.email).toLowerCase()) {
      updates.isEmailVerified = false;
    }
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
  await deleteUserAndData(req.user._id);

  // Clear auth cookies — must carry the same secure/sameSite attrs as login
  // or prod browsers drop the clearing Set-Cookie (cross-site).
  res.cookie('accessToken', '', { ...AUTH_COOKIE_OPTS, maxAge: 0 });
  res.cookie('refreshToken', '', { ...AUTH_COOKIE_OPTS, maxAge: 0 });

  res.status(200).json({ status: 'success', message: 'Account deleted' });
};

// @desc    Email a 6-digit code to verify the account's email
// @route   POST /api/profile/email/send-otp
// @access  Private
export const sendEmailOtp = async (req, res) => {
  const user = await User.findById(req.user._id).select('email isEmailVerified');
  if (!user?.email) {
    res.status(400);
    throw new Error('Add an email to your profile first.');
  }
  if (user.isEmailVerified) {
    return res.status(200).json({ status: 'success', message: 'Email already verified', data: { isEmailVerified: true } });
  }
  if (!isEmailConfigured()) {
    res.status(503);
    throw new Error('Email service is unavailable right now. Please try again later.');
  }

  const otp = await generateAndStoreOTP(null, user.email);
  await sendMail({
    to: user.email,
    subject: 'Verify your email — Chingiringi',
    text: `Your Chingiringi verification code is ${otp}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Your Chingiringi verification code is <strong style="font-size:20px;letter-spacing:3px">${otp}</strong>.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
  });

  res.status(200).json({ status: 'success', message: 'Verification code sent' });
};

// @desc    Verify the account's email with the 6-digit code
// @route   POST /api/profile/email/verify   { otp }
// @access  Private
export const verifyEmailOtp = async (req, res) => {
  const otp = String(req.body?.otp ?? '').trim();
  if (!/^\d{6}$/.test(otp)) {
    res.status(400);
    throw new Error('Enter the 6-digit code.');
  }

  const user = await User.findById(req.user._id).select('email isEmailVerified');
  if (!user?.email) {
    res.status(400);
    throw new Error('Add an email to your profile first.');
  }
  if (user.isEmailVerified) {
    return res.status(200).json({ status: 'success', data: { isEmailVerified: true } });
  }

  try {
    // Throws on an invalid/expired code or too many attempts.
    await verifyUserOTP(user.email, otp);
  } catch (e) {
    res.status(400);
    throw new Error(e?.message || 'Invalid or expired code.');
  }

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ status: 'success', message: 'Email verified', data: { isEmailVerified: true } });
};
