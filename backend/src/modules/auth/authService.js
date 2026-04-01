import User from '../users/userModel.js';
import Wallet from '../wallet/walletModel.js';
import OTP from '../otp/otpModel.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const createUser = async (userData) => {
  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email: userData.email }, { phone: userData.phone }, { username: userData.username }],
  });

  if (existingUser) {
    throw new Error('User already exists with that email, phone, or username');
  }

  // Create user
  const user = await User.create({
    name: userData.name,
    username: userData.username,
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

export const verifyPassword = async (identifier, password) => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  if (!user || !(await user.matchPassword(password))) {
    throw new Error('Invalid credentials');
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
  
  // If verifying for login and user doesn't exist, we might need to handle it or just return null
  return user;
};
