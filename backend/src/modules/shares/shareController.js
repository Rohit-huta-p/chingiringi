// backend/src/modules/shares/shareController.js
import mongoose from 'mongoose';
import ShareEvent from './shareModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import Product from '../products/productModel.js';
import Store from '../stores/storeModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import { evaluateShareQuota, istDayBucket } from './shareService.js';

// Object.create(null) — a plain `{...}` lets itemType:'__proto__'/'constructor'
// resolve truthy off Object.prototype and skip the `if (!Model)` 400 guard below.
const MODEL_BY_TYPE = Object.assign(Object.create(null), { product: Product, store: Store });

async function ensureWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

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
  const day = istDayBucket();

  const todayCount = await ShareEvent.countDocuments({ userId, day });
  const quota = evaluateShareQuota({ todayCount, maxSharesPerDay });
  if (!quota.ok) { res.status(429); throw new Error(quota.message); }

  // Insert FIRST — the unique (userId,itemType,itemId,day) index is the
  // idempotency guard. Already shared this item today → E11000 → no double-pay.
  let created;
  try {
    created = await ShareEvent.create({ userId, itemType, itemId, coinsAwarded: coinsPerShare, day });
  } catch (err) {
    if (err?.code === 11000) {
      // Insert failed → nothing written → todayCount from the check above is still accurate.
      return res.json({ status: 'success', data: {
        coinsAwarded: 0, duplicate: true,
        remainingToday: Math.max(0, maxSharesPerDay - todayCount),
      }});
    }
    throw err;
  }

  // ponytail: early check is check-then-act (races past the cap across distinct items), so cap is enforced fail-closed here via a post-insert re-count instead of a transaction/lock — a rare concurrent burst may under-credit by a share or two, never over.
  const after = await ShareEvent.countDocuments({ userId, day });
  if (after > maxSharesPerDay) {
    await ShareEvent.deleteOne({ _id: created._id });
    res.status(429);
    throw new Error('Daily share limit reached');
  }

  // Credit — same primitive as adjustUserWallet. ponytail: non-transactional to
  // match the existing wallet code; worst case on a rare save failure is a
  // ShareEvent with no credit (user short 100 coins), recoverable, not a loss.
  const wallet = await ensureWallet(userId);
  wallet.coins += coinsPerShare;
  await wallet.save();

  await Transaction.create({
    userId, type: 'coin_credit', amount: coinsPerShare, status: 'confirmed',
    description: `Share reward — ${itemType}`,
    metadata: { reason: 'share', itemType, itemId: String(itemId) },
  });

  notify({ userId, type: 'wallet_credited', data: { amount: coinsPerShare, currency: 'coins' } })
    .catch(() => {}); // best-effort; a notif failure must never fail the credit

  res.status(201).json({ status: 'success', data: {
    coinsAwarded: coinsPerShare,
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
    usedToday, remaining: Math.max(0, settings.maxSharesPerDay - usedToday), cap: settings.maxSharesPerDay,
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
