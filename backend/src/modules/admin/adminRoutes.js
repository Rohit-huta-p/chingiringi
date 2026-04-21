import express from 'express';
import { getDashboardStats, getUsers, getAllDeals } from './adminController.js';
import { couponAdminRouter } from '../coupons/couponRoutes.js';
import { getAdminBanners } from '../banners/bannerController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, admin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.get('/deals', getAllDeals);

// Banners (admin — returns all including inactive)
router.get('/banners', getAdminBanners);

// Coupons CRUD + usage analytics
router.use('/coupons', couponAdminRouter);

export default router;
