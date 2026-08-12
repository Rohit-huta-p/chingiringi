import express from 'express';
import { razorpayWebhook, cashfreeWebhook } from './paymentsController.js';

// Payout providers post here. Both are mounted in app.js with a raw body parser
// (before express.json) so each webhook signature verifies over the raw bytes.
const razorpayRouter = express.Router();
razorpayRouter.post('/', razorpayWebhook);

export const cashfreeRouter = express.Router();
cashfreeRouter.post('/', cashfreeWebhook);

export default razorpayRouter;
