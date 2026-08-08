import { z } from 'zod';
import Video from './videoModel.js';
import { createDirectUpload, verifyWebhookSignature, deleteStreamVideo } from '../../services/cloudflareStream.js';
import { buildFeedQuery, nextCursor, clampWatchSec } from './videoRanking.js';
import VideoInteraction from './videoInteractionModel.js';

// @desc  Mint a Cloudflare direct-upload URL   @route POST /api/videos/upload-url  @access admin
export const createUploadUrl = async (req, res) => {
  const { storeName } = req.body;
  const { uid, uploadURL } = await createDirectUpload({
    maxDurationSeconds: 120,
    meta: { storeName: String(storeName || ''), createdBy: String(req.user._id) },
  });
  res.status(201).json({ status: 'success', data: { streamUid: uid, uploadURL } });
};

const createSchema = z.object({
  streamUid: z.string().min(1),
  // Free-text store (not linked to the offline-stores catalog).
  store: z.object({
    name: z.string().min(1, 'store name is required'),
    logoUrl: z.string().optional().default(''),
  }),
  caption: z.string().max(300).optional().default(''),
  hashtags: z.array(z.string()).optional().default([]),
  // Inline products (not linked to the products catalog).
  taggedProducts: z.array(z.object({
    title: z.string().min(1, 'product title is required'),
    description: z.string().optional().default(''),
    price: z.number().nonnegative().optional().default(0),
  })).optional().default([]),
  cta: z.object({
    type: z.enum(['shop', 'store', 'none']).default('shop'),
    url: z.string().optional().default(''),
  }).optional(),
});

// @desc  Create video metadata after the client uploads  @route POST /api/videos  @access admin
export const createVideo = async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const d = parsed.data;
  const video = await Video.create({
    store: d.store,
    createdByAdmin: req.user._id,
    streamUid: d.streamUid,
    caption: d.caption,
    hashtags: d.hashtags,
    taggedProducts: d.taggedProducts,
    cta: d.cta || { type: 'shop' },
    status: 'processing',
  });
  res.status(201).json({ status: 'success', data: { video } });
};

// @desc  Cloudflare Stream status callback  @route POST /api/webhooks/cloudflare-stream  @access signed
export const handleStreamWebhook = async (req, res) => {
  const raw = req.body; // Buffer (mounted with express.raw)
  const ok = verifyWebhookSignature(
    raw,
    req.headers['webhook-signature'],
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
  );
  if (!ok) {
    res.status(401);
    throw new Error('Invalid webhook signature');
  }
  const payload = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  const video = await Video.findOne({ streamUid: payload.uid });
  if (!video) return res.status(200).json({ status: 'success', data: { ignored: true } });

  const state = payload.status?.state;
  if (state === 'ready' || payload.readyToStream) {
    video.status = 'ready';
    video.hlsUrl = payload.playback?.hls || video.hlsUrl;
    video.thumbnailUrl = payload.thumbnail || video.thumbnailUrl;
    video.durationSec = Math.round(payload.duration || video.durationSec);
    if (!video.publishedAt) video.publishedAt = new Date();
  } else if (state === 'error') {
    video.status = 'error';
  }
  await video.save();
  res.status(200).json({ status: 'success', data: { uid: payload.uid, status: video.status } });
};

// @desc  Ranked shoppable feed  @route GET /api/videos/feed  @access public
export const getFeed = async (req, res) => {
  const { filter, sort, limit } = buildFeedQuery(req.query);
  const videos = await Video.find(filter)
    .sort(sort)
    .limit(limit)
    .lean();
  res.status(200).json({ status: 'success', data: { videos, nextCursor: nextCursor(videos) } });
};

// @desc  Single video  @route GET /api/videos/:id  @access public
export const getVideo = async (req, res) => {
  const video = await Video.findById(req.params.id).lean();
  if (!video) { res.status(404); throw new Error('Video not found'); }
  res.status(200).json({ status: 'success', data: { video } });
};

// @desc  A store's ready videos, by store name  @route GET /api/videos/store/:storeId  @access public
export const getStoreVideos = async (req, res) => {
  const videos = await Video.find({
    'store.name': req.params.storeId, status: 'ready', 'moderation.state': 'approved',
  }).sort({ _id: -1 }).limit(60).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};

// @desc  Count a view + add watch seconds  @route POST /:id/view  @access optional
export const trackView = async (req, res) => {
  const video = await Video.findById(req.params.id).select('durationSec');
  if (!video) { res.status(404); throw new Error('Video not found'); }
  const watch = clampWatchSec(req.body?.watchSec, video.durationSec);
  await Video.updateOne({ _id: video._id }, { $inc: { 'stats.views': 1, 'stats.watchSec': watch } });
  res.status(200).json({ status: 'success', data: { ok: true } });
};

// Shared like/save toggle. delta +1 on create, -1 on remove; keeps stats counter in sync.
async function toggle(req, res, type, counter) {
  const videoId = req.params.id;
  const existing = await VideoInteraction.findOne({ user: req.user._id, video: videoId, type });
  let active;
  if (existing) {
    await existing.deleteOne();
    await Video.updateOne({ _id: videoId }, { $inc: { [counter]: -1 } });
    active = false;
  } else {
    await VideoInteraction.create({ user: req.user._id, video: videoId, type });
    await Video.updateOne({ _id: videoId }, { $inc: { [counter]: 1 } });
    active = true;
  }
  res.status(200).json({ status: 'success', data: { active } });
}

export const toggleLike = (req, res) => toggle(req, res, 'like', 'stats.likes');
export const toggleSave = (req, res) => toggle(req, res, 'save', 'stats.saves');

// @desc  Count a share  @route POST /:id/share  @access optional
export const trackShare = async (req, res) => {
  const r = await Video.updateOne({ _id: req.params.id }, { $inc: { 'stats.shares': 1 } });
  if (r.matchedCount === 0) { res.status(404); throw new Error('Video not found'); }
  res.status(200).json({ status: 'success', data: { ok: true } });
};

// @desc  Moderation queue (pending, newest first)  @route GET /api/videos/admin/queue  @access admin
export const listPending = async (req, res) => {
  const videos = await Video.find({ 'moderation.state': 'pending' })
    .sort({ _id: -1 }).limit(100).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};

// @desc  Approve/reject/feature  @route PATCH /api/videos/admin/:id  @access admin
export const moderateVideo = async (req, res) => {
  const { action, reason, featured } = req.body;
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  if (action === 'approve') {
    video.moderation = { state: 'approved', reviewedBy: req.user._id, reason: '', at: new Date() };
    if (video.status === 'ready' && !video.publishedAt) video.publishedAt = new Date();
  } else if (action === 'reject') {
    video.moderation = { state: 'rejected', reviewedBy: req.user._id, reason: reason || '', at: new Date() };
    video.status = 'removed';
  }
  if (typeof featured === 'boolean') video.isFeatured = featured;
  await video.save();
  res.status(200).json({ status: 'success', data: { video } });
};

// @desc  Hard remove (also best-effort delete from Cloudflare)  @route DELETE /api/videos/:id  @access admin
export const deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  try { await deleteStreamVideo(video.streamUid); } catch { /* best effort */ }
  await video.deleteOne();
  res.status(200).json({ status: 'success', data: { deleted: true } });
};
