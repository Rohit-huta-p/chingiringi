import express from 'express';
import multer from 'multer';
import {
  getStores, getStore, createStore, createSellerStore, updateStore, updateMyStore, deleteStore,
  getMyStore, getStoreStats, updateVerification, getStoreReviews, createStoreReview,
  getVerificationQueue, uploadKyc, getStoreKyc,
} from './storeController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';
import { storeFollowRouter } from '../follows/followRoutes.js';

const router = express.Router();

// In-memory upload for KYC images (buffer is streamed straight to Cloudinary).
const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per image
});

// ── Seller / authenticated routes (must come BEFORE /:id to avoid shadowing) ──
router.get('/mine',   protect, getMyStore);
// Sellers self-create their own store (no admin middleware — any authenticated user).
router.post('/seller', protect, createSellerStore);
router.patch('/mine',  protect, updateMyStore);

// Admin verification review queue (includes private docs — admin only).
router.get('/admin/verifications', protect, admin, getVerificationQueue);

// Upload a private KYC image (store doc / ID / selfie); returns a publicId.
router.post('/kyc/upload', protect, kycUpload.single('file'), uploadKyc);

// ── Follow / unfollow (merged from followRoutes) ─────────────────────────────
router.use('/', storeFollowRouter);

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', getStores);
router.get('/:id', getStore);
router.get('/:id/stats', getStoreStats);
router.get('/:id/reviews', getStoreReviews);

// Signed, on-demand KYC media URLs (owner or admin only — enforced in controller).
router.get('/:id/kyc', protect, getStoreKyc);

// A shopper posts a review of a store (one per user).
router.post('/:id/reviews', protect, createStoreReview);

// ── Verification (seller submits; admin approves) ────────────────────────────
router.patch('/:id/verification', protect, updateVerification);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post('/', protect, admin, createStore);
router.put('/:id', protect, admin, updateStore);
router.delete('/:id', protect, admin, deleteStore);

export default router;
