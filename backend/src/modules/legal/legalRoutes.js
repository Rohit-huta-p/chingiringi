import express from 'express';
import {
  privacyPage, termsPage, aboutPage,
  deleteAccountPage, deleteAccountRequest, deleteAccountConfirm,
} from './legalController.js';

// Public, unauthenticated HTML pages for store listings (Google Play etc.):
//   /privacy-policy   /terms   /terms-and-conditions   /about   /delete-account
const router = express.Router();

router.get('/privacy-policy', privacyPage);
router.get('/terms', termsPage);
router.get('/terms-and-conditions', termsPage);
router.get('/about', aboutPage);

// Google Play requires a web-accessible account-deletion flow. Email-verified:
//   POST /delete-account/request  { email }       → emails a 6-digit code
//   POST /delete-account/confirm  { email, otp }  → verifies the code + deletes
router.get('/delete-account', deleteAccountPage);
router.post('/delete-account/request', deleteAccountRequest);
router.post('/delete-account/confirm', deleteAccountConfirm);

export default router;
