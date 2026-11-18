import express from 'express';
import {
  createStream,
  viewerToken,
  endStream,
  markStreamLive,
  abortStream,
  updateStreamProducts,
  getActiveStreams,
  getStream,
  getMyStreams,
  reportStream,
} from './streamController.js';
import rateLimit from 'express-rate-limit';
import { protect, optionalProtect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Anti-spam cap on reporting (per user) — mirrors the video report limiter.
const reportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { status: 'error', message: 'Too many reports at once — give it a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public (optional auth → signed-in viewers get blocked broadcasters filtered out)
router.get('/active', optionalProtect, getActiveStreams);

// Authenticated — caller's own stream history. Declared before '/:id' so the
// router doesn't treat "mine" as a stream id.
router.get('/mine',   protect, getMyStreams);

// Public
router.get('/:id',    getStream);

// Authenticated (broadcaster)
router.post('/',              protect, createStream);
router.post('/:id/viewer-token', protect, viewerToken);
router.post('/:id/live',     protect, markStreamLive);
router.post('/:id/abort',    protect, abortStream);
router.patch('/:id/products', protect, updateStreamProducts);
router.post('/:id/end',      protect, endStream);

// Viewer reports a live stream (reason + optional note) — rate-limited per user.
router.post('/:id/reports',  protect, reportLimiter, reportStream);

export default router;
