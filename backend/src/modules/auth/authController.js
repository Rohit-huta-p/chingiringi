import { z } from 'zod';
import { createUser, verifyPassword, generateAndStoreOTP, verifyUserOTP } from './authService.js';
import { generateTokens } from '../../utils/generateToken.js';
import User from '../users/userModel.js';
import jwt from 'jsonwebtoken';

export const signup = async (req, res) => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    username: z.string().min(3),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    password: z.string().min(6),
  }).refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  });

  const validatedData = schema.parse(req.body);
  const user = await createUser(validatedData);

  await generateTokens(res, user);

  res.status(201).json({
    status: 'success',
    message: 'Account created efficiently',
  });
};

export const login = async (req, res) => {
  const schema = z.object({
    identifier: z.string(),
    password: z.string().optional(),
    otp: z.string().optional(),
  }).refine(data => data.password || data.otp, {
    message: "Must provide password for standard login or OTP for phone login",
  });

  const { identifier, password, otp } = schema.parse(req.body);

  let user;

  if (password) {
    user = await verifyPassword(identifier, password);
  } else if (otp) {
    user = await verifyUserOTP(identifier, otp);
    if (!user) {
      throw new Error('Phone number not registered. Please sign up first.');
    }
  }

  await generateTokens(res, user);

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
  });
};

export const sendOtp = async (req, res) => {
  const schema = z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).refine(data => data.phone || data.email, {
    message: "Must provide phone or email",
  });

  const { phone, email } = schema.parse(req.body);
  const otp = await generateAndStoreOTP(phone, email);

  // In production, integrate with SMS/Email provider here
  // For dev, returning it in console
  console.log(`[DEV OTP GENERATED]: ${otp} for ${phone || email}`);

  res.status(200).json({
    status: 'success',
    message: 'OTP sent successfully',
    // data: { otp } // Remove in prod
  });
};

export const verifyOtp = async (req, res) => {
  const schema = z.object({
    identifier: z.string(),
    otp: z.string().length(6),
  });

  const { identifier, otp } = schema.parse(req.body);
  
  const user = await verifyUserOTP(identifier, otp);
  
  if (user) {
    // If it's a login verification
    await generateTokens(res, user);
  }

  res.status(200).json({
    status: 'success',
    message: 'OTP verified successfully',
    data: {
      isLogin: !!user
    }
  });
};

export const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken && req.user) {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
      await user.save({ validateBeforeSave: false });
    }
  }

  res.cookie('accessToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    res.status(401);
    throw new Error('Not authorized, no refresh token');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    // Verify token exists in database (not revoked)
    const tokenExists = user?.refreshTokens.some(rt => rt.token === refreshToken);
    if (!user || !tokenExists) {
      res.status(401);
      throw new Error('Refresh token revoked or invalid');
    }

    // Prune the used token and issue new ones
    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    await generateTokens(res, user);

    res.status(200).json({
      status: 'success',
      message: 'Tokens refreshed'
    });
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, refresh token failed');
  }
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }
    }
  });
};

export const forgotPassword = async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
  });

  const { email } = schema.parse(req.body);
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error('User not found');
  }

  const otp = await generateAndStoreOTP(null, email);
  console.log(`[DEV RESET OTP GENERATED]: ${otp} for ${email}`);

  res.status(200).json({
    status: 'success',
    message: 'Password reset OTP sent to email',
  });
};

export const resetPassword = async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(6),
  });

  const { email, otp, newPassword } = schema.parse(req.body);

  // Throws if invalid
  await verifyUserOTP(email, otp);

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }

  user.passwordHash = newPassword; // Pre-save hook will hash it
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
  });
};
