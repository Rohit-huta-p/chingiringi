import Wallet from '../wallet/walletModel.js';
import User from '../users/userModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import * as razorpay from './razorpayService.js';
import * as cashfree from './cashfreeService.js';

// Provider-agnostic payout seam. razorpayService and cashfreeService expose the
// same three functions (payoutsEnabled / payoutForWithdrawal /
// verifyWebhookSignature); this module picks one per AdminSettings.payoutProvider
// and owns the shared money path (coin hold + refund) so both the user
// (instant) and admin (approval/retry) callers route through one place.

/** The active payout provider module. Defaults to Razorpay for legacy configs. */
export async function getPayoutService() {
  const s = await AdminSettings.get();
  return s.payoutProvider === 'cashfree' ? cashfree : razorpay;
}

/** True when the active provider is configured + enabled. */
export async function payoutsEnabled() {
  const provider = await getPayoutService();
  return provider.payoutsEnabled();
}

/**
 * Fire a real payout for a pending withdrawal `tx` via the active provider.
 * Holds (debits) the coins up front and refunds them if the provider call
 * fails, so a failed payout never costs the user their coins. On success the
 * tx lands at `processing` (the provider webhook flips it to `completed`).
 *
 * Mutates + saves `tx` on success. Throws (with `.statusCode`) on any guard or
 * provider failure — coins already refunded in that case.
 * Returns { payoutId, status }.
 */
export async function firePayout(tx, { actorId } = {}) {
  if (tx.metadata?.payoutId) {
    const e = new Error('This withdrawal already has a payout in flight.');
    e.statusCode = 409; throw e;
  }
  if (tx.status !== 'pending') {
    const e = new Error(`Withdrawal is "${tx.status}", not pending — cannot start a payout.`);
    e.statusCode = 409; throw e;
  }

  const md = tx.metadata || {};
  const coinsRedeemed = Number(md.coinsRedeemed) || 0;
  const rupees = Math.abs(Number(tx.amount) || 0);
  if (coinsRedeemed <= 0 || rupees <= 0) {
    const e = new Error('Withdrawal is missing its coin amount or ₹ value.');
    e.statusCode = 400; throw e;
  }

  // Atomic hold: decrement only if the balance still covers it. Guards against
  // a double-tap / race firing two payouts and driving coins negative.
  // ponytail: this atomic guard IS the double-spend fix — do not simplify to a
  // read-then-save debit.
  const held = await Wallet.updateOne(
    { userId: tx.userId, coins: { $gte: coinsRedeemed } },
    { $inc: { coins: -coinsRedeemed } },
  );
  if (held.modifiedCount === 0) {
    const w = await Wallet.findOne({ userId: tx.userId }).select('coins').lean();
    const e = new Error(`Insufficient coins (${w?.coins ?? 0} available, ${coinsRedeemed} needed).`);
    e.statusCode = 400; throw e;
  }

  const dest = md.method === 'Bank'
    ? { method: 'Bank', accountNumber: md.accountNumber, ifsc: md.ifsc, name: md.accountName }
    : { method: 'UPI', upiId: md.paymentDetails };
  const user = await User.findById(tx.userId).select('name').lean();

  const provider = await getPayoutService();
  let payout;
  try {
    payout = await provider.payoutForWithdrawal({
      userName: user?.name,
      userId: tx.userId,
      txId: tx._id,
      amountRupees: rupees,
      dest,
    });
  } catch (e) {
    // Refund the held coins; leave the withdrawal pending for a retry.
    await Wallet.updateOne({ userId: tx.userId }, { $inc: { coins: coinsRedeemed } });
    const err = new Error(`Payout failed: ${e.message}`);
    err.statusCode = 502; throw err;
  }

  tx.status = 'processing';
  tx.metadata = {
    ...md,
    payoutId: payout.payoutId,
    ...(payout.contactId ? { contactId: payout.contactId } : {}),
    ...(payout.fundAccountId ? { fundAccountId: payout.fundAccountId } : {}),
    payoutStatus: payout.status,
    payoutInitiatedAt: new Date(),
    ...(actorId ? { actionedBy: actorId, actionedAt: new Date() } : {}),
  };
  await tx.save();

  return { payoutId: payout.payoutId, status: payout.status };
}

/**
 * Apply a provider webhook outcome to a withdrawal tx. Shared by both provider
 * webhooks. Guarded on `status==='processing'` so a duplicate/stale event is a
 * safe no-op. Returns true if the tx changed (caller then notifies the user).
 *
 *   'paid'   → completed
 *   'failed' → refund held coins, clear payout ids, back to pending (retryable)
 */
export async function applyPayoutOutcome(tx, outcome, extra = {}) {
  if (tx.status !== 'processing') return false;

  if (outcome === 'paid') {
    tx.status = 'completed';
    tx.metadata = { ...(tx.metadata || {}), payoutStatus: extra.status || 'processed', completedAt: new Date() };
    await tx.save();
    return true;
  }

  if (outcome === 'failed') {
    const coins = Number(tx.metadata?.coinsRedeemed) || 0;
    if (coins > 0) await Wallet.updateOne({ userId: tx.userId }, { $inc: { coins } });
    // Drop payout ids so it's cleanly retryable and a duplicate event can't
    // match it again.
    const { payoutId, contactId, fundAccountId, ...rest } = tx.metadata || {};
    tx.status = 'pending';
    tx.metadata = {
      ...rest,
      payoutStatus: extra.status || 'failed',
      payoutFailureReason: extra.reason || outcome,
    };
    await tx.save();
    return true;
  }

  return false;
}
