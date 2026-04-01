import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  login,
  sendOtp,
  verifyOtp,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
  getMe,
} from './authController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Rate limiting (5 requests per 1 minute)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5,
  message: 'Too many requests from this IP, please try again in a minute',
});

router.post('/signup', signup);
router.post('/login', authLimiter, login);
router.post('/send-otp', authLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/logout', protect, logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

export default router;
