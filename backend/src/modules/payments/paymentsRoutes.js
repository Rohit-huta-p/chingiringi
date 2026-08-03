import express from 'express';
import { razorpayWebhook } from './paymentsController.js';

// Razorpay posts here. Mounted in app.js with a raw body parser (before
// express.json) so the webhook signature can be verified over the raw bytes.
const router = express.Router();

router.post('/', razorpayWebhook);

export default router;
