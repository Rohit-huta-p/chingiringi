import express from 'express';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponUsage,
  validateCouponHandler,
  applyCoupon,
} from './couponController.js';
import { protect } from '../../middleware/authMiddleware.js';

// ─── Admin router (mounted at /api/admin/coupons) ──────────────────
// protect + admin are applied at the parent mount in adminRoutes.js
export const couponAdminRouter = express.Router();

couponAdminRouter.get('/', getCoupons);
couponAdminRouter.post('/', createCoupon);
couponAdminRouter.put('/:id', updateCoupon);
couponAdminRouter.delete('/:id', deleteCoupon);
couponAdminRouter.get('/:id/usage', getCouponUsage);

// ─── Customer router (mounted at /api/coupons) ─────────────────────
const couponCustomerRouter = express.Router();

couponCustomerRouter.post('/validate', protect, validateCouponHandler);
couponCustomerRouter.post('/apply', protect, applyCoupon);

export default couponCustomerRouter;
