import express from 'express';
import { getProfile, updateProfile, deleteAccount } from './profileController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.delete('/', deleteAccount);

export default router;
