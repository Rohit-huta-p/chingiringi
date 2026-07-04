import express from 'express';
import { logClick, redirectAndLog, getUserClicks } from './clickController.js';
import { protect, optionalProtect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Anonymous OR authed — anonymous still logs (anon subid) for later backfill.
router.post('/log', optionalProtect, logClick);
router.get('/redirect', optionalProtect, redirectAndLog);

// Admin-only — feeds the User Wallet timeline. Role gating happens in the
// admin router; we just require auth here. Tighten when admin middleware lands.
router.get('/user/:userId', protect, getUserClicks);

export default router;
