import Review from './reviewModel.js';
import Product from '../products/productModel.js';

// @desc    List a product's reviews (newest-first) + count + average rating
// @route   GET /api/products/:productId/reviews
// @access  Public
export const getProductReviews = async (req, res) => {
  const { productId } = req.params;

  const reviews = await Review.find({ product: productId })
    .sort({ createdAt: -1 })
    .populate('user', 'name avatarUrl')
    .lean();

  const count = reviews.length;
  const averageRating =
    count > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : 0;

  res.status(200).json({
    status: 'success',
    data: { reviews, count, averageRating },
  });
};

// @desc    Create a review for a product (one per user per product)
// @route   POST /api/products/:productId/reviews
// @access  Private
export const createReview = async (req, res) => {
  const { productId } = req.params;
  const { rating, text } = req.body;
  const userId = req.user._id;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('rating must be between 1 and 5');
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const existing = await Review.findOne({ product: productId, user: userId }).lean();
  if (existing) {
    res.status(409);
    throw new Error('You have already reviewed this product');
  }

  const created = await Review.create({
    product: productId,
    user: userId,
    rating,
    text: (text || '').trim(),
  });

  const review = await Review.findById(created._id)
    .populate('user', 'name avatarUrl')
    .lean();

  res.status(201).json({ status: 'success', data: { review } });
};
