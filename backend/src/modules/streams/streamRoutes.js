import express from 'express';
import {
  createStream,
  viewerToken,
  endStream,
  getActiveStreams,
  getStream,
  getMyStreams,
} from './streamController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/active', getActiveStreams);

// Authenticated — caller's own stream history. Declared before '/:id' so the
// router doesn't treat "mine" as a stream id.
router.get('/mine',   protect, getMyStreams);

// Public
router.get('/:id',    getStream);

// Authenticated (broadcaster)
router.post('/',              protect, createStream);
router.post('/:id/viewer-token', protect, viewerToken);
router.post('/:id/end',      protect, endStream);

export default router;
