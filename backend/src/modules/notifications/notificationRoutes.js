import express from 'express';
import {
  list,
  unreadCount,
  markRead,
  markAllRead,
  registerPushToken,
  unregisterPushToken,
} from './notificationController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', list);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.post('/push-token', registerPushToken);
router.delete('/push-token', unregisterPushToken);

export default router;
