import { z } from 'zod';
import Video from './videoModel.js';
import { videoProvider, activeProvider, providerFor } from '../../services/videoProvider.js';
import { buildFeedQuery, nextCursor, clampWatchSec } from './videoRanking.js';
import VideoInteraction from './videoInteractionModel.js';
import { notify } from '../notifications/notificationService.js';

// @desc  Mint a direct-upload URL (Cloudflare or Mux)  @route POST /api/videos/upload-url  @access admin
export const createUploadUrl = async (req, res) => {
  const { storeName } = req.body;
  const { uid, uploadURL, uploadMethod } = await videoProvider().createDirectUpload({
    maxDurationSeconds: 30, // 30s cap — provider rejects anything longer
    meta: { storeName: String(storeName || ''), createdBy: String(req.user._id) },
  });
  res.status(201).json({ status: 'success', data: { streamUid: uid, uploadURL, uploadMethod, provider: activeProvider() } });
};

const createSchema = z.object({
  streamUid: z.string().min(1),
  // Free-text store (not linked to the offline-stores catalog).
  store: z.object({
    name: z.string().min(1, 'store name is required'),
    logoUrl: z.string().optional().default(''),
    website: z.string().optional().default(''),
  }),
  caption: z.string().max(300).optional().default(''),
  hashtags: z.array(z.string()).optional().default([]),
  // Inline products (not linked to the products catalog).
  taggedProducts: z.array(z.object({
    title: z.string().min(1, 'product title is required'),
    description: z.string().optional().default(''),
    price: z.number().nonnegative().optional().default(0),
    url: z.string().optional().default(''),
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
  const isAdmin = req.user.role === 'admin';
  const video = await Video.create({
    store: d.store,
    createdBy: req.user._id,
    creatorRole: isAdmin ? 'admin' : 'user',
    ...(isAdmin ? { createdByAdmin: req.user._id } : {}),
    streamUid: d.streamUid,
    provider: activeProvider(),
    caption: d.caption,
    hashtags: d.hashtags,
    taggedProducts: d.taggedProducts,
    cta: d.cta || { type: 'shop' },
    status: 'processing',
    // Admins are trusted publishers → auto-approve. User (UGC) posts go to the
    // moderation queue (pending) and enter the feed only once an admin approves.
    moderation: isAdmin
      ? { state: 'approved', reviewedBy: req.user._id, at: new Date() }
      : { state: 'pending' },
  });
  res.status(201).json({ status: 'success', data: { video } });
};

// @desc  Video-provider status callback (Cloudflare or Mux)  @route POST /api/webhooks/video  @access signed
export const handleStreamWebhook = async (req, res) => {
  const p = videoProvider();
  const raw = req.body; // Buffer (mounted with express.raw)
  if (!p.verifyWebhook(raw, req.headers)) {
    res.status(401);
    throw new Error('Invalid webhook signature');
  }
  const payload = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  const ev = p.parseWebhook(payload);
  if (!ev || !ev.matchUid) return res.status(200).json({ status: 'success', data: { ignored: true } });

  const video = await Video.findOne({ streamUid: ev.matchUid });
  if (!video) return res.status(200).json({ status: 'success', data: { ignored: true } });

  if (ev.state === 'ready') {
    video.status = 'ready';
    video.hlsUrl = ev.hlsUrl || video.hlsUrl;
    video.thumbnailUrl = ev.thumbnailUrl || video.thumbnailUrl;
    video.durationSec = Math.round(ev.durationSec || video.durationSec);
    if (ev.assetId) video.providerAssetId = ev.assetId;
    if (!video.publishedAt) video.publishedAt = new Date();
  } else if (ev.state === 'error') {
    video.status = 'error';
  }
  await video.save();
  res.status(200).json({ status: 'success', data: { status: video.status } });
};

// Attach `likedByMe` for the authenticated user (all false when anonymous / no likes).
async function withLikedByMe(videos, userId) {
  if (!userId || !videos.length) return videos.map((v) => ({ ...v, likedByMe: false }));
  const likes = await VideoInteraction.find({
    user: userId, video: { $in: videos.map((v) => v._id) }, type: 'like',
  }).select('video').lean();
  const liked = new Set(likes.map((l) => String(l.video)));
  return videos.map((v) => ({ ...v, likedByMe: liked.has(String(v._id)) }));
}

// @desc  Ranked shoppable feed  @route GET /api/videos/feed  @access public (optional auth)
export const getFeed = async (req, res) => {
  const { filter, sort, limit } = buildFeedQuery(req.query);
  const videos = await Video.find(filter)
    .sort(sort)
    .limit(limit)
    .lean();
  const withLikes = await withLikedByMe(videos, req.user?._id);
  res.status(200).json({ status: 'success', data: { videos: withLikes, nextCursor: nextCursor(withLikes) } });
};

// @desc  Single video  @route GET /api/videos/:id  @access public (optional auth)
export const getVideo = async (req, res) => {
  const video = await Video.findById(req.params.id).lean();
  if (!video) { res.status(404); throw new Error('Video not found'); }
  const [withLike] = await withLikedByMe([video], req.user?._id);
  res.status(200).json({ status: 'success', data: { video: withLike } });
};

// @desc  A store's ready videos, by store name  @route GET /api/videos/store/:storeId  @access public (optional auth)
export const getStoreVideos = async (req, res) => {
  const videos = await Video.find({
    'store.name': req.params.storeId, status: 'ready', 'moderation.state': 'approved',
  }).sort({ _id: -1 }).limit(60).lean();
  const withLikes = await withLikedByMe(videos, req.user?._id);
  res.status(200).json({ status: 'success', data: { videos: withLikes } });
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

// @desc  All posted videos for admin management (every status, newest first)
// @route GET /api/videos/admin/all  @access admin
export const listAll = async (req, res) => {
  const videos = await Video.find({}).sort({ _id: -1 }).limit(200).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};

// @desc  The signed-in user's own posted clips (any status, newest first)
// @route GET /api/videos/mine  @access protect
export const getMine = async (req, res) => {
  const videos = await Video.find({ createdBy: req.user._id }).sort({ _id: -1 }).limit(100).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};

// @desc  Edit a clip's metadata (store, caption, products, cta) — not the video file
// @route PATCH /api/videos/:id  @access admin
// Owner (createdBy) or any admin may manage a clip.
const canManage = (video, user) => user?.role === 'admin' || String(video.createdBy || '') === String(user?._id);

export const updateVideo = async (req, res) => {
  const { store, caption, taggedProducts, cta } = req.body;
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  if (!canManage(video, req.user)) { res.status(403); throw new Error('Not your video'); }
  if (store?.name != null) video.store.name = String(store.name).trim();
  if (store?.website != null) video.store.website = String(store.website).trim();
  if (typeof caption === 'string') video.caption = caption.trim();
  if (Array.isArray(taggedProducts)) video.taggedProducts = taggedProducts;
  if (cta?.type) video.cta = { type: cta.type, url: cta.url || '' };
  await video.save();
  res.status(200).json({ status: 'success', data: { video } });
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

  // Tell the uploader (user posts only) — best-effort, never blocks the response.
  if (video.createdBy && video.creatorRole !== 'admin' && (action === 'approve' || action === 'reject')) {
    try {
      await notify({
        userId: video.createdBy,
        type: action === 'approve' ? 'video_approved' : 'video_rejected',
        data: { store: video.store?.name || '', reason: video.moderation.reason || '' },
      });
    } catch { /* notification is best-effort */ }
  }

  res.status(200).json({ status: 'success', data: { video } });
};

// @desc  Hard remove (also best-effort delete from Cloudflare)  @route DELETE /api/videos/:id  @access admin
export const deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  if (!canManage(video, req.user)) { res.status(403); throw new Error('Not your video'); }
  // Delete on the host the clip ACTUALLY lives on (video.provider), so retiring an
  // old Mux clip after switching VIDEO_PROVIDER=cloudflare still removes the Mux asset.
  try { await providerFor(video.provider).deleteAsset(video); } catch { /* best effort */ }
  await video.deleteOne();
  res.status(200).json({ status: 'success', data: { deleted: true } });
};
