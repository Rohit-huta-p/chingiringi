import express from 'express';
import { createShare, getShareQuota } from './shareController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // all share routes require auth

router.post('/', createShare);
router.get('/quota', getShareQuota);

export default router;
