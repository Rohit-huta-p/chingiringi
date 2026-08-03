import express from 'express';
import { getDashboardStats, getUsers, getAllDeals } from './adminController.js';
import {
  getQueueSummary,
  getUserTimeline,
  adjustUserWallet,
  updateUserStatus,
  getWithdrawals,
  updateWithdrawal,
  importReport,
  listReportImports,
  getReportImport,
} from './walletOpsController.js';
import { getSettings, updateSettings } from './adminSettingsController.js';
import { fetchUrlMeta } from './urlMetaController.js';
import { couponAdminRouter } from '../coupons/couponRoutes.js';
import { getAdminBanners } from '../banners/bannerController.js';
import { getAllProductsAdmin } from '../products/productController.js';
import { getAllStoresAdmin } from '../stores/storeController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, admin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.get('/deals', getAllDeals);
router.get('/products', getAllProductsAdmin);
router.post('/fetch-url-meta', fetchUrlMeta); // prefill product image/title from a buy link
router.get('/stores', getAllStoresAdmin);

// Banners (admin — returns all including inactive)
router.get('/banners', getAdminBanners);

// Coupons CRUD + usage analytics
router.use('/coupons', couponAdminRouter);

// ── Wallet Operations hub ─────────────────────────────────────────────
// Coin-economy settings — passThroughPercent, coinsPerRupee, lock days,
// Cuelinks publisher ID, Amazon associate tag. Used by the importer + URL
// wrappers.
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

// Pending Queue tab
router.get('/queue', getQueueSummary);

// User Wallet tab
router.get('/users/:id/timeline', getUserTimeline);
router.post('/users/:id/wallet-adjust', adjustUserWallet);
router.patch('/users/:id/status', updateUserStatus);

// Withdrawals (lives inline in the User Wallet timeline + as its own list)
router.get('/withdrawals', getWithdrawals);
router.patch('/withdrawals/:id', updateWithdrawal);

// Reports Inbox tab
router.post('/reports/import', importReport);
router.get('/reports/imports', listReportImports);
router.get('/reports/imports/:id', getReportImport);

export default router;
