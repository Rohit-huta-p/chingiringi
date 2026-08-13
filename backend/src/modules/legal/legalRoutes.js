import express from 'express';
import { privacyPage, termsPage, aboutPage } from './legalController.js';

// Public, unauthenticated HTML pages for store listings (Google Play etc.):
//   /privacy-policy   /terms   /terms-and-conditions   /about
const router = express.Router();

router.get('/privacy-policy', privacyPage);
router.get('/terms', termsPage);
router.get('/terms-and-conditions', termsPage);
router.get('/about', aboutPage);

export default router;
