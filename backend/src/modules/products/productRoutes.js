import express from 'express';
import {
  getProducts,
  getFeaturedProducts,
  getProduct,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  deleteProduct,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct,
} from './productController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Public
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id', getProduct);

// Seller — own store only (ownership enforced in the controller)
router.post('/mine',       protect, createMyProduct);
router.put('/mine/:id',    protect, updateMyProduct);
router.delete('/mine/:id', protect, deleteMyProduct);

// Admin
router.post('/', protect, admin, createProduct);
router.post('/bulk', protect, admin, bulkCreateProducts);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

export default router;
