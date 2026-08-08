import express from 'express';
import { createUploadUrl, createVideo } from './videoController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Admin authoring
router.post('/upload-url', protect, admin, createUploadUrl);
router.post('/', protect, admin, createVideo);

export default router;
