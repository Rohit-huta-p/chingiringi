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

const MODEL_BY_TYPE = { product: Product, store: Store };

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
  try {
    await ShareEvent.create({ userId, itemType, itemId, coinsAwarded: coinsPerShare, day });
  } catch (err) {
    if (err?.code === 11000) {
      const usedToday = await ShareEvent.countDocuments({ userId, day });
      return res.json({ status: 'success', data: {
        coinsAwarded: 0, duplicate: true,
        remainingToday: Math.max(0, maxSharesPerDay - usedToday),
      }});
    }
    throw err;
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

  const usedToday = await ShareEvent.countDocuments({ userId, day });
  res.status(201).json({ status: 'success', data: {
    coinsAwarded: coinsPerShare,
    remainingToday: Math.max(0, maxSharesPerDay - usedToday),
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
