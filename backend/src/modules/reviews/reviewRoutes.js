import express from 'express';
import { getProductReviews, createReview } from './reviewController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Mounted at /api/products, so these resolve to /api/products/:productId/reviews.
router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', protect, createReview);

export default router;
