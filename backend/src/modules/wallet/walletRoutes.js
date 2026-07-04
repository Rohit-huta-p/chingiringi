import express from 'express';
import {
  getWallet,
  getWalletSummary,
  getTransactions,
  getTransaction,
  requestWithdrawal,
} from './walletController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All wallet routes require authentication
router.use(protect);

router.get('/', getWallet);
router.get('/summary', getWalletSummary);
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransaction);
router.post('/withdraw', requestWithdrawal);

export default router;
