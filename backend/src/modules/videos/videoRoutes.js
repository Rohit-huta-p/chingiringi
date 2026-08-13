import express from 'express';
import {
  createUploadUrl, createVideo, getFeed, getVideo, getStoreVideos,
  trackView, toggleLike, toggleSave, trackShare,
  addComment, listComments, deleteComment,
  listPending, listAll, getMine, moderateVideo, updateVideo, deleteVideo,
} from './videoController.js';
import rateLimit from 'express-rate-limit';
import { protect, optionalProtect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Per-user daily posting cap (keyed by user id, not IP).
const uploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: 10,                        // 10 new clips / user / day
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { status: 'error', message: 'Daily upload limit reached — try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Anti-spam cap on comment posting (per user).
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { status: 'error', message: 'You’re commenting too fast — slow down a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authoring — any signed-in user. Admins auto-approve; user (UGC) posts go to
// the moderation queue (see createVideo).
router.post('/upload-url', protect, uploadLimiter, createUploadUrl);
router.post('/', protect, uploadLimiter, createVideo);

// The signed-in user's own clips (declared before /:id so it isn't captured)
router.get('/mine', protect, getMine);

// public reads (optional auth → so we can flag `likedByMe` for signed-in users)
router.get('/feed', optionalProtect, getFeed);
router.get('/store/:storeId', optionalProtect, getStoreVideos);

// admin moderation — must be declared before /:id so /admin/* isn't captured by getVideo
router.get('/admin/queue', protect, admin, listPending);
router.get('/admin/all', protect, admin, listAll);
router.patch('/admin/:id', protect, admin, moderateVideo);

// engagement
router.post('/:id/view', optionalProtect, trackView);
router.post('/:id/share', optionalProtect, trackShare);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/save', protect, toggleSave);

// comments (flat) — /:id/comments and /comments/:commentId sit above the bare /:id routes
router.get('/:id/comments', optionalProtect, listComments);
router.post('/:id/comments', protect, commentLimiter, addComment);
router.delete('/comments/:commentId', protect, deleteComment);

// bare /:id routes LAST — a bare :id above would swallow /feed, /store/..., /admin/...
router.get('/:id', optionalProtect, getVideo);
router.patch('/:id', protect, updateVideo);       // owner-or-admin (enforced in controller)
router.delete('/:id', protect, deleteVideo);      // owner-or-admin (enforced in controller)

export default router;
