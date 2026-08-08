import express from 'express';
import { handleStreamWebhook } from './videoController.js';

const router = express.Router();
router.post('/', handleStreamWebhook);
export default router;
