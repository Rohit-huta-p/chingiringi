import express from 'express';
import {
  getProfile,
  updateProfile,
  updateNotificationPrefs,
  deleteAccount,
} from './profileController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getProfile);
router.put('/', updateProfile);
router.patch('/notification-prefs', updateNotificationPrefs);
router.delete('/', deleteAccount);

export default router;
