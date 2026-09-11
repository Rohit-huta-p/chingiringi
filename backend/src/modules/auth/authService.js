import User from '../users/userModel.js';
import Wallet from '../wallet/walletModel.js';
import OTP from '../otp/otpModel.js';
import bcrypt from 'bcrypt';

export const createUser = async (userData) => {
  // Check if user exists — only match on identifiers that were actually
  // provided. A clause like { phone: undefined } would otherwise match any
  // user missing that field and wrongly report a duplicate on email-only signup.
  const orClauses = [];
  if (userData.email) orClauses.push({ email: userData.email });
  if (userData.phone) orClauses.push({ phone: userData.phone });

  const existingUser = orClauses.length ? await User.findOne({ $or: orClauses }) : null;

  if (existingUser) {
    const err = new Error('User already exists with that email or phone');
    err.statusCode = 409;
    throw err;
  }

  // Create user
  const user = await User.create({
    name: userData.name,
    email: userData.email,
    phone: userData.phone,
    passwordHash: userData.password,
  });

  // Create associated wallet
  const wallet = await Wallet.create({
    userId: user._id,
  });

  // Update user with wallet ID
  user.walletId = wallet._id;
  await user.save();

  return user;
};

export const findOrCreateGoogleUser = async ({ sub, email, name, picture }) => {
  // Match by googleId first; otherwise link Google to an existing email account.
  let user = await User.findOne({ $or: [{ googleId: sub }, { email }] });

  if (user) {
    let dirty = false;
    if (!user.googleId) { user.googleId = sub; dirty = true; }        // link on first Google login
    if (!user.isEmailVerified) { user.isEmailVerified = true; dirty = true; }
    if (!user.avatarUrl && picture) { user.avatarUrl = picture; dirty = true; }
    if (dirty) await user.save({ validateBeforeSave: false });
    return { user, isNew: false };
  }

  // New Google user — no password.
  user = await User.create({
    name: name || 'User',
    email,
    googleId: sub,
    isEmailVerified: true,
    avatarUrl: picture || '',
  });

  const wallet = await Wallet.create({ userId: user._id });
  user.walletId = wallet._id;
  await user.save();

  return { user, isNew: true };
};

export const verifyPassword = async (identifier, password) => {
  // `identifier` is the email address (username login was removed). Phone
  // numbers authenticate via OTP, not password.
  const user = await User.findOne({ email: identifier }).select('+passwordHash');

  if (!user || !(await user.matchPassword(password))) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  return user;
};

export const generateAndStoreOTP = async (phone, email = null) => {
  // 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
  
  // Upsert or Create new OTP entry
  const filter = phone ? { phone } : { email };
  
  await OTP.findOneAndUpdate(
    filter,
    { otpHash, expiresAt, attempts: 0 },
    { upsert: true, new: true }
  );

  return otp;
};

export const verifyUserOTP = async (identifier, otpCode) => {
  const otpEntry = await OTP.findOne({ $or: [{ phone: identifier }, { email: identifier }] });
  
  if (!otpEntry) {
    throw new Error('OTP not found or expired');
  }

  if (otpEntry.attempts >= 3) {
    throw new Error('Too many failed attempts. Request a new OTP.');
  }

  const isMatch = await otpEntry.matchOtp(otpCode);
  
  if (!isMatch) {
    otpEntry.attempts += 1;
    await otpEntry.save();
    throw new Error('Invalid OTP');
  }

  // Delete after successful verification
  await OTP.deleteOne({ _id: otpEntry._id });

  let user = await User.findOne({ $or: [{ phone: identifier }, { email: identifier }] });

  // Auto-create account if phone verified but no user exists
  if (!user && identifier.match(/^\d{10,15}$/)) {
    user = await User.create({
      name: 'User',
      phone: identifier,
      isPhoneVerified: true,
    });
    // Create associated wallet
    const wallet = await Wallet.create({ userId: user._id });
    user.walletId = wallet._id;
    await user.save();
  } else if (user && identifier.match(/^\d/)) {
    // Mark phone as verified on existing user
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }
  }

  return user;
};
