import express from 'express';
import { applyReferral, claimReferral, getReferralStats } from './referralController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // all referral API routes require auth

router.post('/apply', applyReferral);
router.post('/claim', claimReferral);
router.get('/stats', getReferralStats);

export default router;
