// backend/src/modules/shares/shareRedirectRoutes.js
import express from 'express';
import { shareRedirect } from './shareRedirectController.js';

const router = express.Router();
router.get('/:type/:id', shareRedirect); // public, no auth — the opener is a friend
export default router;
