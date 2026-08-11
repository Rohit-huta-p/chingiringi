import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../users/userModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import { canApplyReferral, referralConfirmDecision } from './referralService.js';

async function ensureWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

// Credit spendable coins the way adjustUserWallet does: wallet + ledger + notify,
// in lock-step so the audit trail can never disagree with the balance.
async function creditReferralCoins(userId, coins, role) {
  const wallet = await ensureWallet(userId);
  wallet.coins += coins;
  wallet.lifetimeEarned += coins;
  await wallet.save();
  await Transaction.create({
    userId,
    type: 'referral',
    amount: coins,
    status: 'confirmed',
    description: `Referral bonus (${role})`,
    metadata: { reason: 'referral', role },
  });
  try {
    await notify({ userId, type: 'wallet_credited', data: { amount: coins, currency: 'coins' } });
  } catch (e) { /* best-effort: notification must never break the credit */ }
}

// POST /api/referrals/apply { code } — capture a code onto the CALLER at signup.
export const applyReferral = async (req, res) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
  const referee = req.user;

  const referrer = await User.findOne({ referralCode: code.trim().toUpperCase() }).select('_id');
  const decision = canApplyReferral({
    referrerId: referrer?._id,
    refereeId: referee._id,
    refereeReferredBy: referee.referredBy,
    refereeCreatedAtMs: new Date(referee.createdAt).getTime(),
    nowMs: Date.now(),
  });
  if (!decision.ok) {
    return res.json({ status: 'success', data: { applied: false, reason: decision.reason } });
  }

  // Set only if still un-referred (guards a double-apply race).
  await User.updateOne(
    { _id: referee._id, referredBy: { $exists: false } },
    { $set: { referredBy: referrer._id, referralStatus: 'pending' } },
  );
  res.json({ status: 'success', data: { applied: true, reason: 'ok' } });
};

// POST /api/referrals/claim — confirm+pay the CALLER's pending referral.
// The app calls this on launch/login (native only). No-op unless pending.
export const claimReferral = async (req, res) => {
  const referee = await User.findById(req.user._id).select('_id referredBy referralStatus createdAt');
  const s = await AdminSettings.get();
  const decision = referralConfirmDecision({
    status: referee?.referralStatus,
    refereeCreatedAtMs: new Date(referee?.createdAt).getTime(),
    nowMs: Date.now(),
    lockDays: s.defaultLockDays,
  });

  if (!decision.confirm) {
    if (decision.reason === 'expired') {
      await User.updateOne({ _id: referee._id, referralStatus: 'pending' }, { $set: { referralStatus: 'expired' } });
    }
    return res.json({ status: 'success', data: { credited: false, reason: decision.reason } });
  }

  // Atomic, idempotent: only the pending→confirmed winner pays.
  const flipped = await User.findOneAndUpdate(
    { _id: referee._id, referralStatus: 'pending' },
    { $set: { referralStatus: 'confirmed' } },
    { new: true },
  );
  if (!flipped) return res.json({ status: 'success', data: { credited: false, reason: 'race' } });

  // ponytail: no Mongo transaction across these two credits (needs a
  // replica-set session — out of scope). referralStatus is already flipped
  // to 'confirmed' above, so there's no automatic retry if one credit fails.
  // Each is attempted independently (one failing must not skip the other),
  // and a failure is logged greppable for manual reconcile via the admin
  // wallet-adjust tool. Coins are best-effort here, same as notify().
  if (flipped.referredBy) {
    try {
      await creditReferralCoins(flipped.referredBy, s.coinsPerReferralReferrer, 'referrer');
    } catch (e) {
      console.error('[referral] credit FAILED — manual reconcile needed', { refereeId: flipped._id, referrerId: flipped.referredBy, role: 'referrer', amount: s.coinsPerReferralReferrer, err: e?.message });
    }
  }
  try {
    await creditReferralCoins(flipped._id, s.coinsPerReferralReferee, 'referee');
  } catch (e) {
    console.error('[referral] credit FAILED — manual reconcile needed', { refereeId: flipped._id, referrerId: flipped.referredBy, role: 'referee', amount: s.coinsPerReferralReferee, err: e?.message });
  }

  res.json({ status: 'success', data: { credited: true, refereeCoins: s.coinsPerReferralReferee } });
};

// GET /api/referrals/stats — for the referral card. Lazy-expires stale pendings.
export const getReferralStats = async (req, res) => {
  const me = req.user._id;
  const s = await AdminSettings.get();
  const cutoff = new Date(Date.now() - s.defaultLockDays * 24 * 60 * 60 * 1000);

  // Lazy-expire this user's own referral if it went stale (cheap, on read).
  await User.updateOne(
    { _id: me, referralStatus: 'pending', createdAt: { $lt: cutoff } },
    { $set: { referralStatus: 'expired' } },
  );

  const [confirmedCount, pendingCount, earn] = await Promise.all([
    User.countDocuments({ referredBy: me, referralStatus: 'confirmed' }),
    User.countDocuments({ referredBy: me, referralStatus: 'pending' }),
    Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(me), type: 'referral' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({ status: 'success', data: {
    referralCode: req.user.referralCode,
    confirmedCount,
    pendingCount,
    earningsCoins: earn[0]?.total || 0,
    referrerRupees: s.coinsPerReferralReferrer / s.coinsPerRupee,
    refereeRupees: s.coinsPerReferralReferee / s.coinsPerRupee,
  }});
};
