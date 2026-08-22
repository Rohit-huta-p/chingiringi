import express from 'express';
import { followStore, unfollowStore, getFollowing } from './followController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

// GET /api/users/me/following
router.get('/me/following', protect, getFollowing);

export default router;

// ── Store-scoped follow routes (mounted on /api/stores) ────────────────────
// These are exported separately so storeRoutes.js (or app.js) can attach them.
export const storeFollowRouter = express.Router({ mergeParams: true });
storeFollowRouter.post('/:id/follow',   protect, followStore);
storeFollowRouter.delete('/:id/follow', protect, unfollowStore);
