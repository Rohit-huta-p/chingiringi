import express from 'express';
import {
  getStores, getStore, createStore, createSellerStore, updateStore, deleteStore,
  getMyStore, getStoreStats, updateVerification,
} from './storeController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';
import { storeFollowRouter } from '../follows/followRoutes.js';

const router = express.Router();

// ── Seller / authenticated routes (must come BEFORE /:id to avoid shadowing) ──
router.get('/mine',   protect, getMyStore);
// Sellers self-create their own store (no admin middleware — any authenticated user).
router.post('/seller', protect, createSellerStore);

// ── Follow / unfollow (merged from followRoutes) ─────────────────────────────
router.use('/', storeFollowRouter);

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', getStores);
router.get('/:id', getStore);
router.get('/:id/stats', getStoreStats);

// ── Verification (seller submits; admin approves) ────────────────────────────
router.patch('/:id/verification', protect, updateVerification);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post('/', protect, admin, createStore);
router.put('/:id', protect, admin, updateStore);
router.delete('/:id', protect, admin, deleteStore);

export default router;
