import express from 'express';
import {
  createUploadUrl, createVideo, getFeed, getVideo, getStoreVideos,
  trackView, toggleLike, toggleSave, trackShare,
  listPending, moderateVideo, deleteVideo,
} from './videoController.js';
import { protect, optionalProtect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Admin authoring
router.post('/upload-url', protect, admin, createUploadUrl);
router.post('/', protect, admin, createVideo);

// public reads (optional auth → so we can flag `likedByMe` for signed-in users)
router.get('/feed', optionalProtect, getFeed);
router.get('/store/:storeId', optionalProtect, getStoreVideos);

// admin moderation — must be declared before /:id so /admin/queue isn't captured by getVideo
router.get('/admin/queue', protect, admin, listPending);
router.patch('/admin/:id', protect, admin, moderateVideo);

// engagement
router.post('/:id/view', optionalProtect, trackView);
router.post('/:id/share', optionalProtect, trackShare);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/save', protect, toggleSave);

// bare /:id routes LAST — a bare :id above would swallow /feed, /store/..., /admin/...
router.get('/:id', optionalProtect, getVideo);
router.delete('/:id', protect, admin, deleteVideo);

export default router;
