import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { createUser, verifyPassword, generateAndStoreOTP, verifyUserOTP, findOrCreateGoogleUser } from './authService.js';
import { generateTokens, AUTH_COOKIE_OPTS } from '../../utils/generateToken.js';
import { isSmsConfigured, sendOtpSms } from '../../services/sms.js';
import { isEmailConfigured, sendMail } from '../../services/email.js';
import User from '../users/userModel.js';
import jwt from 'jsonwebtoken';

// Google Sign-In: verify the id_token the app obtained via expo-auth-session.
// Any of the Web/iOS/Android client IDs is an acceptable audience.
const googleClient = new OAuth2Client();
// Read at request time (not once at module load) so a newly-set env var is
// picked up after a normal backend restart — no reliance on import ordering.
const googleAudiences = () => [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

export const signup = async (req, res) => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    password: z.string().min(6),
  }).refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  });

  const validatedData = schema.parse(req.body);
  const user = await createUser(validatedData);

  const tokens = await generateTokens(res, user);

  res.status(201).json({
    status: 'success',
    message: 'Account created efficiently',
    tokens,
    isNewUser: true,
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

  const tokens = await generateTokens(res, user);

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
    tokens,
  });
};

export const googleAuth = async (req, res) => {
  const { idToken } = z.object({ idToken: z.string().min(1) }).parse(req.body);

  const audiences = googleAudiences();
  if (audiences.length === 0) {
    res.status(503);
    throw new Error('Google sign-in is not configured on the server.');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch (verifyErr) {
    // Log the real reason so it appears in Render/server logs
    console.error('[googleAuth] verifyIdToken failed:', verifyErr?.message);
    console.error('[googleAuth] audiences used:', audiences);
    console.error('[googleAuth] token prefix (first 40 chars):', idToken?.slice(0, 40));
    res.status(401);
    throw new Error('Invalid Google token');
  }

  if (!payload?.email || !payload.email_verified) {
    res.status(401);
    throw new Error('Google account email is not verified');
  }

  const { user, isNew } = await findOrCreateGoogleUser(payload);
  const tokens = await generateTokens(res, user);

  res.status(200).json({
    status: 'success',
    message: 'Logged in with Google',
    tokens,
    isNewUser: isNew,
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

  // Phone → SMS (MSG91); email → transactional mail. We own the OTP; these
  // services are pure transport. A channel MUST be configured in production;
  // in dev we fall back to logging the code so local flows still work.
  const isProd = process.env.NODE_ENV === 'production';
  const channel = phone ? 'sms' : 'email';
  const ready = channel === 'sms' ? isSmsConfigured() : isEmailConfigured();

  if (!ready && isProd) {
    res.status(503);
    throw new Error(`${channel === 'sms' ? 'SMS' : 'Email'} service is unavailable right now. Please try again later.`);
  }

  const otp = await generateAndStoreOTP(phone, email);

  if (ready) {
    try {
      if (channel === 'sms') {
        await sendOtpSms(phone, otp);
      } else {
        await sendMail({
          to: email,
          subject: 'Your Chingiringi verification code',
          text: `Your Chingiringi verification code is ${otp}. It expires in 5 minutes. If you didn't request this, ignore this message.`,
          html: `<p>Your Chingiringi verification code is <strong style="font-size:20px;letter-spacing:3px">${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
        });
      }
    } catch (err) {
      // Log the provider error (never the OTP) and return a clean client error.
      console.error(`[sendOtp] ${channel} delivery failed:`, err?.message);
      res.status(502);
      throw new Error('Could not send the code right now. Please try again.');
    }
  } else {
    // Dev only, channel unconfigured — surface the code so local testing works.
    console.log(`[DEV OTP] ${otp} → ${phone || email} (${channel} not configured)`);
  }

  res.status(200).json({
    status: 'success',
    message: 'OTP sent successfully',
  });
};

export const verifyOtp = async (req, res) => {
  const schema = z.object({
    identifier: z.string(),
    otp: z.string().length(6),
  });

  const { identifier, otp } = schema.parse(req.body);
  
  const user = await verifyUserOTP(identifier, otp);
  
  let tokens;
  if (user) {
    // If it's a login verification
    tokens = await generateTokens(res, user);
  }

  res.status(200).json({
    status: 'success',
    message: 'OTP verified successfully',
    data: {
      isLogin: !!user
    },
    ...(tokens && { tokens }),
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

  res.cookie('accessToken', '', { ...AUTH_COOKIE_OPTS, expires: new Date(0) });
  res.cookie('refreshToken', '', { ...AUTH_COOKIE_OPTS, expires: new Date(0) });

  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};

export const refresh = async (req, res) => {
  // Accept refresh token from cookie or request body (for native apps)
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

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
    const tokens = await generateTokens(res, user);

    res.status(200).json({
      status: 'success',
      message: 'Tokens refreshed',
      tokens,
    });
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, refresh token failed', { cause: error });
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
        email: user.email,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
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

  // Only send a code when the account exists, but ALWAYS return the same
  // response so this endpoint can't be used to enumerate registered emails.
  if (user) {
    if (isEmailConfigured()) {
      const otp = await generateAndStoreOTP(null, email);
      try {
        await sendMail({
          to: email,
          subject: 'Reset your Chingiringi password',
          text: `Your Chingiringi password reset code is ${otp}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
          html: `<p>Your Chingiringi password reset code is <strong style="font-size:20px;letter-spacing:3px">${otp}</strong>.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
        });
      } catch (err) {
        // Don't leak provider errors to the client — log and fall through to the
        // generic success response.
        console.error('[forgotPassword] email send failed:', err?.message);
      }
    } else if (process.env.NODE_ENV !== 'production') {
      const otp = await generateAndStoreOTP(null, email);
      console.log(`[DEV RESET OTP] ${otp} → ${email} (email not configured)`);
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'If an account exists for that email, a reset code has been sent.',
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
