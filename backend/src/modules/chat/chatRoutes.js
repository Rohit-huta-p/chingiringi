import express from 'express';
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markRead,
  getUnreadTotal,
} from './chatController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Every chat endpoint requires auth — no guest messaging.
router.use(protect);

router.get('/unread', getUnreadTotal);

router.route('/conversations')
  .get(getConversations)
  .post(getOrCreateConversation);

router.route('/conversations/:id/messages')
  .get(getMessages)
  .post(sendMessage);

router.post('/conversations/:id/read', markRead);

export default router;
