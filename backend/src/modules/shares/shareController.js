// backend/src/modules/shares/shareController.js
import mongoose from 'mongoose';
import ShareEvent from './shareModel.js';
import Product from '../products/productModel.js';
import Store from '../stores/storeModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { evaluateShareQuota, istDayBucket } from './shareService.js';

// Object.create(null) — a plain `{...}` lets itemType:'__proto__'/'constructor'
// resolve truthy off Object.prototype and skip the `if (!Model)` 400 guard below.
const MODEL_BY_TYPE = Object.assign(Object.create(null), { product: Product, store: Store });

// POST /api/shares  { itemType:'product'|'store', itemId }
// Called by the app AFTER the OS share sheet reports a completed share.
export const createShare = async (req, res) => {
  const userId = req.user._id;
  const { itemType, itemId } = req.body;

  const Model = MODEL_BY_TYPE[itemType];
  if (!Model) { res.status(400); throw new Error("itemType must be 'product' or 'store'"); }
  if (!mongoose.Types.ObjectId.isValid(itemId)) { res.status(400); throw new Error('Invalid itemId'); }

  const item = await Model.findById(itemId).select('_id').lean();
  if (!item) { res.status(404); throw new Error(`${itemType} not found`); }

  const settings = await AdminSettings.get();
  const { coinsPerShare, maxSharesPerDay } = settings;

  const SHARE_BASE = process.env.SHARE_BASE || 'https://chingiringi-backend.onrender.com';
  const shareUrl = `${SHARE_BASE}/s/${itemType}/${itemId}?ref=cr_${userId}`;

  const day = istDayBucket();
  const todayCount = await ShareEvent.countDocuments({ userId, day });
  const quota = evaluateShareQuota({ todayCount, maxSharesPerDay });
  if (!quota.ok) { res.status(429); throw new Error(quota.message); }

  try {
    await ShareEvent.create({
      userId, itemType, itemId, coinsAwarded: coinsPerShare, day,
      status: 'pending', sharerIp: req.ip, sharerUa: req.headers['user-agent'] || '',
    });
  } catch (err) {
    if (err?.code === 11000) {
      // Already shared this item today — the link is self-describing, so hand
      // back the same URL to re-share; no new pending row, no double-anything.
      return res.json({ status: 'success', data: {
        status: 'pending', shareUrl, duplicate: true,
        remainingToday: Math.max(0, maxSharesPerDay - todayCount),
      }});
    }
    throw err;
  }

  const after = await ShareEvent.countDocuments({ userId, day });
  if (after > maxSharesPerDay) {
    await ShareEvent.deleteOne({ userId, itemType, itemId, day });
    res.status(429);
    throw new Error('Daily share limit reached');
  }

  res.status(201).json({ status: 'success', data: {
    status: 'pending', shareUrl,
    remainingToday: Math.max(0, maxSharesPerDay - after),
  }});
};

// GET /api/shares/quota
export const getShareQuota = async (req, res) => {
  const userId = req.user._id;
  const settings = await AdminSettings.get();
  const day = istDayBucket();
  const usedToday = await ShareEvent.countDocuments({ userId, day });
  res.json({ status: 'success', data: {
    usedToday, remaining: Math.max(0, settings.maxSharesPerDay - usedToday),
    cap: settings.maxSharesPerDay, coinsPerShare: settings.coinsPerShare,
  }});
};

// GET /api/shares/stats?itemType=product&itemId=X
// Social proof for the detail page. The unique (userId,itemType,itemId,day)
// index means one ShareEvent per user per item per day, so a plain count of
// today's events = distinct users who shared this item today.
export const getShareStats = async (req, res) => {
  const { itemType, itemId } = req.query;
  if (!MODEL_BY_TYPE[itemType]) { res.status(400); throw new Error("itemType must be 'product' or 'store'"); }
  if (!mongoose.Types.ObjectId.isValid(itemId)) { res.status(400); throw new Error('Invalid itemId'); }
  const day = istDayBucket();
  const todayCount = await ShareEvent.countDocuments({ itemType, itemId, day });
  res.json({ status: 'success', data: { todayCount } });
};
