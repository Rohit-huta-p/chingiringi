import express from 'express';
import { featureStatus } from '../../services/featureGate.js';

const router = express.Router();

// @desc   Public runtime config — the feature pause-switches the app reads on
//         load so it can proactively disable Go Live / upload before a user taps
//         (the server gate in the controllers stays the hard backstop).
// @route  GET /api/config
// @access public (no auth, no DB)
router.get('/', (req, res) => {
  res.status(200).json({ status: 'success', data: { features: featureStatus() } });
});

export default router;
