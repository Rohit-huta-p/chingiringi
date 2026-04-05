import express from 'express';
import { getDashboardStats, getUsers, getAllDeals } from './adminController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, admin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.get('/deals', getAllDeals);

export default router;
