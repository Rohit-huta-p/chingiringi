import mongoose from 'mongoose';

/**
 * A shopper's review of a store (parallel to the product Review model). Store
 * rating/reviewsCount aggregates are recomputed from these on each write.
 */
const storeReviewSchema = new mongoose.Schema(
  {
    store:  { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text:   { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// One review per user per store.
storeReviewSchema.index({ store: 1, user: 1 }, { unique: true });
// List a store's reviews newest-first.
storeReviewSchema.index({ store: 1, createdAt: -1 });

const StoreReview = mongoose.model('StoreReview', storeReviewSchema);

export default StoreReview;
