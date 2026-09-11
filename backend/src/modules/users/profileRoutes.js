import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getProfile,
  updateProfile,
  updateNotificationPrefs,
  updateRole,
  deleteAccount,
  sendEmailOtp,
  verifyEmailOtp,
} from './profileController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Email verification — modest rate limit (each code costs an email send).
const emailOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  message: 'Too many requests, please try again in a minute',
});

router.get('/', getProfile);
router.put('/', updateProfile);
router.patch('/role', updateRole);
router.patch('/notification-prefs', updateNotificationPrefs);
router.post('/email/send-otp', emailOtpLimiter, sendEmailOtp);
router.post('/email/verify', emailOtpLimiter, verifyEmailOtp);
router.delete('/', deleteAccount);

export default router;
