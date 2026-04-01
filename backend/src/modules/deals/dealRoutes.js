import express from 'express';
import {
  getDeals,
  getDeal,
  getFeaturedDeals,
  getTrendingBrands,
  trackDealClick,
  createDeal,
  updateDeal,
  deleteDeal,
} from './dealController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getDeals);
router.get('/featured', getFeaturedDeals);
router.get('/trending-brands', getTrendingBrands);
router.get('/:id', getDeal);

// Private routes
router.post('/:id/click', protect, trackDealClick);

// Admin routes
router.post('/', protect, admin, createDeal);
router.put('/:id', protect, admin, updateDeal);
router.delete('/:id', protect, admin, deleteDeal);

export default router;
