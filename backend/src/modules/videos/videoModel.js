import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  watchSec: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  productTaps: { type: Number, default: 0 },
  storeTaps: { type: Number, default: 0 },
}, { _id: false });

// Products are entered inline per video (not linked to the products catalog).
const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, default: 0 },
  url: { type: String, default: '' }, // optional buy link
}, { _id: false });

const videoSchema = new mongoose.Schema({
  // Store is free-text per video (not linked to the offline-stores catalog).
  store: {
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: '' },
    website: { type: String, default: '' }, // optional — store name links here + shown at caption end
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // owner (admin OR user)
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },         // legacy — set only for admin posts
  creatorRole: { type: String, enum: ['admin', 'user'], default: 'admin' },
  streamUid: { type: String, required: true, unique: true, index: true },
  provider: { type: String, enum: ['cloudflare', 'mux'], default: 'cloudflare' },
  providerAssetId: { type: String, default: '' }, // provider's asset id for delete/poll (Mux: set on ready)
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
  taggedProducts: [productSchema],
  cta: {
    type: { type: String, enum: ['shop', 'store', 'none'], default: 'shop' },
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
videoSchema.index({ 'store.name': 1, status: 1 });

export default mongoose.model('Video', videoSchema);
