import express from 'express';
import {
  getStores, getStore, createStore, updateStore, deleteStore,
} from './storeController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getStores);
router.get('/:id', getStore);

// Admin routes
router.post('/', protect, admin, createStore);
router.put('/:id', protect, admin, updateStore);
router.delete('/:id', protect, admin, deleteStore);

export default router;
