import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  watchSec: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  productTaps: { type: Number, default: 0 },
  storeTaps: { type: Number, default: 0 },
}, { _id: false });

const videoSchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  streamUid: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error', 'flagged', 'removed'],
    default: 'processing',
    index: true,
  },
  hlsUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  durationSec: { type: Number, default: 0 },
  caption: { type: String, default: '', maxlength: 300 },
  hashtags: [{ type: String }],
  taggedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  cta: {
    type: { type: String, enum: ['shop', 'store', 'none'], default: 'shop' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    url: { type: String, default: '' },
  },
  stats: { type: statsSchema, default: () => ({}) },
  moderation: {
    state: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    at: { type: Date },
  },
  isFeatured: { type: Boolean, default: false },
  publishedAt: { type: Date },
}, { timestamps: true });

// Feed reads: ready + approved, newest first.
videoSchema.index({ status: 1, 'moderation.state': 1, _id: -1 });
videoSchema.index({ store: 1, status: 1 });

export default mongoose.model('Video', videoSchema);
