import express from 'express';
import { muxLiveWebhook } from './streamController.js';

// Mounted at /api/webhooks/mux-live with express.raw() (the RAW request body is
// needed to verify the Mux HMAC signature). Point a Mux webhook at this URL and
// subscribe it to the video.live_stream.* events.
const router = express.Router();

router.post('/', muxLiveWebhook);

export default router;
