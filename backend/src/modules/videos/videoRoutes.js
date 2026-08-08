import express from 'express';
import {
  createUploadUrl, createVideo, getFeed, getVideo, getStoreVideos,
  trackView, toggleLike, toggleSave, trackShare,
} from './videoController.js';
import { protect, optionalProtect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Admin authoring
router.post('/upload-url', protect, admin, createUploadUrl);
router.post('/', protect, admin, createVideo);

// public reads
router.get('/feed', getFeed);
router.get('/store/:storeId', getStoreVideos);

// engagement
router.post('/:id/view', optionalProtect, trackView);
router.post('/:id/share', optionalProtect, trackShare);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/save', protect, toggleSave);

router.get('/:id', getVideo);

export default router;
