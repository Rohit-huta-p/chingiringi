import express from 'express';
import { createShare, getShareQuota, getShareStats } from './shareController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // all share routes require auth

router.post('/', createShare);
router.get('/quota', getShareQuota);
router.get('/stats', getShareStats); // { itemType, itemId } → { todayCount }

export default router;
