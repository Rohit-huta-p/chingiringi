import express from 'express';
import { getActiveStreams } from './streamController.js';

const router = express.Router();

// GET /api/streams/active — public
router.get('/active', getActiveStreams);

export default router;
