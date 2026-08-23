import express from 'express';
import {
  createStream,
  viewerToken,
  endStream,
  getActiveStreams,
  getStream,
} from './streamController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/active', getActiveStreams);
router.get('/:id',    getStream);

// Authenticated (broadcaster)
router.post('/',              protect, createStream);
router.post('/:id/viewer-token', protect, viewerToken);
router.post('/:id/end',      protect, endStream);

export default router;
