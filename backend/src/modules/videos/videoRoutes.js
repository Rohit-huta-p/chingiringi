import express from 'express';
import { createUploadUrl, createVideo, getFeed, getVideo, getStoreVideos } from './videoController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Admin authoring
router.post('/upload-url', protect, admin, createUploadUrl);
router.post('/', protect, admin, createVideo);

// public reads
router.get('/feed', getFeed);
router.get('/store/:storeId', getStoreVideos);
router.get('/:id', getVideo);

export default router;
