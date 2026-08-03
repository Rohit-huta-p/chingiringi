import mongoose from 'mongoose';
import User from '../users/userModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import ClickEvent from '../clicks/clickModel.js';
import ReportImport from './reportImportModel.js';
import AdminSettings from './adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import { payoutsEnabled, payoutForWithdrawal } from '../payments/razorpayService.js';

// ─────────────────────────────────────────────────────────────────────────
// Coin economy — configurable via AdminSettings singleton.
//
// The formula for a merchant report row is:
//   coins = commission × passThroughPercent × coinsPerRupee
//
// `Deal.coinsReward` becomes an OPTIONAL PROMOTIONAL OVERRIDE — used only
// when the click-log ties a report row back to a specific deal AND the deal
// admin explicitly set a non-zero reward. Everything else uses the formula.
//
// Withdrawals use the SAME coinsPerRupee for the conversion, locked in on the
// Transaction at request time (so a later rate change doesn't retroactively
// change what a queued payout is worth).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extracts the userId from a subid string.
 *
 *   "cr_64f8a2b9c1d2e3f4a5b6c7d8" → "64f8a2b9c1d2e3f4a5b6c7d8"
 *   "cr_anon_171..."              → null (anonymous click)
 *   anything else                  → null
 */
function userIdFromSubid(subid) {
  if (!subid || typeof subid !== 'string') return null;
  if (!subid.startsWith('cr_')) return null;
  const rest = subid.slice(3);
  if (rest.startsWith('anon_')) return null;
  if (!mongoose.Types.ObjectId.isValid(rest)) return null;
  return rest;
}

async function ensureWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

/**
 * GET /api/admin/queue
 *
 * One-shot summary of "what needs my action right now" — drives the Pending
 * Queue tab in the Wallet Operations hub. Returns counts + sample items so
 * the dashboard can render badge counts AND a preview list per category.
 */
export const getQueueSummary = async (req, res) => {
  const now = new Date();

  const [pendingWithdrawals, expiringLocks, recentImports] = await Promise.all([
    Transaction.find({ type: 'withdrawal', status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(10)
      .populate('userId', 'name phone email')
      .lean(),
    Transaction.find({
      // coin_credit is the dominant type in the coin-only economy; include
      // cashback/referral/bonus for legacy data + any hand-issued credits.
      type: { $in: ['coin_credit', 'cashback', 'referral', 'bonus'] },
      status: 'pending',
      'metadata.lockExpiresAt': { $lte: now },
    })
      .sort({ 'metadata.lockExpiresAt': 1 })
      .limit(10)
      .populate('userId', 'name phone')
      .lean(),
    ReportImport.find({})
      .sort({ importedAt: -1 })
      .limit(5)
      .select('merchant periodStart periodEnd totalRows matchedRows unmatchedRows totalCommissionCredited importedAt')
      .lean(),
  ]);

  res.json({
    status: 'success',
    data: {
      pendingWithdrawals: {
        count: pendingWithdrawals.length,
        items: pendingWithdrawals,
      },
      readyToConfirm: {
        count: expiringLocks.length,
        items: expiringLocks,
      },
      recentImports,
    },
  });
};

/**
 * GET /api/admin/users/:id/timeline
 *
 * Interleaved user history: clicks + transactions + withdrawals on one sorted
 * timeline. Powers the User Wallet drill-down so admin sees the full story:
 *
 *   Mar 4  👆 Click       Myntra · /myntra/jeans
 *   Mar 5  💰 Pending     +₹75   Amazon · order AMZ123
 *   Apr 4  ✅ Confirmed   +₹75   Amazon · order AMZ123
 *   Apr 4  📥 Withdrawal  ₹500   Completed · TXN-XYZ
 */
export const getUserTimeline = async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  const [user, wallet, transactions, clicks] = await Promise.all([
    User.findById(id).select('-passwordHash -refreshTokens').lean(),
    Wallet.findOne({ userId: id }).lean(),
    Transaction.find({ userId: id }).sort({ createdAt: -1 }).limit(limit).lean(),
    ClickEvent.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('dealId', 'title brand')
      .lean(),
  ]);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Tag each event with a kind discriminator + a sortable timestamp, merge,
  // sort desc, and trim to `limit`. Cheaper than a $unionWith aggregation for
  // a per-user view of this size.
  const events = [
    ...transactions.map((t) => ({
      kind: 'transaction',
      timestamp: t.createdAt,
      data: t,
    })),
    ...clicks.map((c) => ({
      kind: 'click',
      timestamp: c.createdAt,
      data: c,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);

  res.json({
    status: 'success',
    data: { user, wallet: wallet ?? null, events },
  });
};

/**
 * POST /api/admin/users/:id/wallet-adjust
 *
 * Manual credit / debit by admin. Creates a Transaction AND mutates the
 * wallet in lock-step so the audit trail and the running balance can never
 * disagree. Use the `note` field for the why.
 */
export const adjustUserWallet = async (req, res) => {
  const { id } = req.params;
  const { type, amount, currency = 'cashback', note } = req.body;

  if (!['credit', 'debit'].includes(type)) {
    res.status(400);
    throw new Error('type must be credit or debit');
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    res.status(400);
    throw new Error('amount must be a positive number');
  }
  if (!['cashback', 'coins'].includes(currency)) {
    res.status(400);
    throw new Error('currency must be cashback or coins');
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const wallet = await ensureWallet(id);
  const sign = type === 'credit' ? 1 : -1;
  const delta = sign * amt;

  // For debits, prevent overdraft.
  if (currency === 'cashback' && type === 'debit' && wallet.confirmedCashback < amt) {
    res.status(400);
    throw new Error('Insufficient confirmed cashback');
  }
  if (currency === 'coins' && type === 'debit' && wallet.coins < amt) {
    res.status(400);
    throw new Error('Insufficient coins');
  }

  if (currency === 'cashback') {
    wallet.confirmedCashback += delta;
    if (type === 'credit') wallet.lifetimeEarned += amt;
  } else {
    wallet.coins += delta;
  }
  await wallet.save();

  const transaction = await Transaction.create({
    userId: id,
    type: currency === 'cashback' ? (type === 'credit' ? 'bonus' : 'withdrawal') : (type === 'credit' ? 'coin_credit' : 'coin_debit'),
    amount: delta,
    status: 'confirmed',
    description: `Admin ${type} (${currency})${note ? ` — ${note}` : ''}`,
    metadata: {
      // The admin who actioned this — for audit. Stored loosely in metadata
      // so we don't have to extend the Transaction schema.
      adminId: req.user?._id?.toString(),
      adjustReason: note,
    },
  });

  // Notify the user of an admin credit (best-effort; debits stay silent).
  if (type === 'credit') {
    try {
      await notify({ userId: id, type: 'wallet_credited', data: { amount: amt, currency } });
    } catch (e) { /* best-effort: a notification failure must never break the adjustment */ }
  }

  res.json({
    status: 'success',
    data: { wallet, transaction },
  });
};

/**
 * PATCH /api/admin/users/:id/status
 *
 * Block / unblock a user. The User schema doesn't currently have a status
 * field — store on `isBlocked` (boolean) and let the frontend derive
 * status: 'active' | 'blocked' from it.
 */
export const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { action, reason } = req.body;

  if (!['block', 'unblock'].includes(action)) {
    res.status(400);
    throw new Error('action must be block or unblock');
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  const user = await User.findByIdAndUpdate(
    id,
    {
      isBlocked: action === 'block',
      ...(action === 'block' && reason ? { blockedReason: reason, blockedAt: new Date() } : {}),
      ...(action === 'unblock' ? { blockedReason: null, blockedAt: null } : {}),
    },
    { new: true },
  ).select('-passwordHash -refreshTokens');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({ status: 'success', data: { user } });
};

/**
 * GET /api/admin/withdrawals?status=pending&search=...
 *
 * Withdrawal queue. We don't have a separate Withdrawal model — a withdrawal
 * IS a Transaction(type='withdrawal') with statuses pending → processing →
 * completed/rejected. Returns rows joined with user info so the admin doesn't
 * have to drill in just to see who requested.
 */
export const getWithdrawals = async (req, res) => {
  const { status = 'all', search = '' } = req.query;

  const filter = { type: 'withdrawal' };
  if (status !== 'all') filter.status = status;

  let rows = await Transaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('userId', 'name phone email')
    .lean();

  // Server-side search across populated user.name / phone / payment details.
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((r) => {
      const u = r.userId || {};
      const m = r.metadata || {};
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (m.paymentDetails || '').toLowerCase().includes(q)
      );
    });
  }

  // Shape rows for the admin queue. In the coin-only model, every withdrawal
  // carries BOTH the coin amount the user redeemed AND the ₹ payout we owe
  // them — admin sees both so there's no confusion at payout time.
  const withdrawals = rows.map((r) => ({
    _id: r._id,
    userId: r.userId?._id || r.userId,
    userName: r.userId?.name || 'Unknown',
    userPhone: r.userId?.phone,
    userEmail: r.userId?.email,
    amount: Math.abs(r.amount), // ₹ the admin pays out
    coinsRedeemed: r.metadata?.coinsRedeemed ?? null, // coins the user spent
    coinRate: r.metadata?.coinRate ?? null, // rate locked at request time (null for legacy rows without it)
    method: r.metadata?.method || 'UPI',
    paymentDetails: r.metadata?.paymentDetails || '',
    accountNumber: r.metadata?.accountNumber,
    ifsc: r.metadata?.ifsc,
    requestedAt: r.createdAt,
    completedAt: r.metadata?.completedAt,
    txnId: r.metadata?.payoutId || r.metadata?.txnId,
    status: r.status,
    note: r.metadata?.note,
  }));

  res.json({ status: 'success', data: { withdrawals } });
};

/**
 * Fire a RazorpayX payout for a pending withdrawal. Holds (debits) the coins up
 * front and refunds them if the payout call fails, so a failed payout never
 * costs the user their coins. Status lands at 'processing'; the payout webhook
 * flips it to 'completed' (or refunds again on failure/reversal).
 */
async function runRazorpayPayout({ req, res, tx }) {
  if (tx.metadata?.payoutId) {
    res.status(409);
    throw new Error('This withdrawal already has a payout in flight.');
  }
  if (tx.status !== 'pending') {
    res.status(409);
    throw new Error(`Withdrawal is "${tx.status}", not pending — cannot start a payout.`);
  }

  const md = tx.metadata || {};
  const coinsRedeemed = Number(md.coinsRedeemed) || 0;
  const rupees = Math.abs(Number(tx.amount) || 0);
  if (coinsRedeemed <= 0 || rupees <= 0) {
    res.status(400);
    throw new Error('Withdrawal is missing its coin amount or ₹ value.');
  }

  // Hold the coins before any money moves.
  const wallet = await ensureWallet(tx.userId);
  if (wallet.coins < coinsRedeemed) {
    res.status(400);
    throw new Error(`Insufficient coins (${wallet.coins} available, ${coinsRedeemed} needed).`);
  }
  wallet.coins -= coinsRedeemed;
  await wallet.save();

  const dest = md.method === 'Bank'
    ? { method: 'Bank', accountNumber: md.accountNumber, ifsc: md.ifsc, name: md.accountName }
    : { method: 'UPI', upiId: md.paymentDetails };
  const user = await User.findById(tx.userId).select('name').lean();

  let payout;
  try {
    payout = await payoutForWithdrawal({
      userName: user?.name,
      userId: tx.userId,
      txId: tx._id,
      amountRupees: rupees,
      dest,
    });
  } catch (e) {
    // Refund the held coins; leave the withdrawal pending for a retry.
    wallet.coins += coinsRedeemed;
    await wallet.save();
    res.status(502);
    throw new Error(`Razorpay payout failed: ${e.message}`);
  }

  tx.status = 'processing';
  tx.metadata = {
    ...md,
    payoutId: payout.payoutId,
    contactId: payout.contactId,
    fundAccountId: payout.fundAccountId,
    payoutStatus: payout.status,
    payoutInitiatedAt: new Date(),
    actionedBy: req.user?._id?.toString(),
    actionedAt: new Date(),
  };
  await tx.save();

  res.json({
    status: 'success',
    data: { transaction: tx, payout: { id: payout.payoutId, status: payout.status } },
  });
}

/**
 * PATCH /api/admin/withdrawals/:id
 *
 * Move a withdrawal through the state machine:
 *   pending → processing (admin started the payout — manual, or via RazorpayX)
 *   processing → completed (paid; RazorpayX webhook, or admin pastes a TXN id)
 *   pending → rejected (refunds the held amount back to the user's wallet)
 */
export const updateWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { action, note, txnId } = req.body;

  const tx = await Transaction.findById(id);
  if (!tx || tx.type !== 'withdrawal') {
    res.status(404);
    throw new Error('Withdrawal not found');
  }

  const STATUS_MAP = { process: 'processing', complete: 'completed', reject: 'rejected' };
  const nextStatus = STATUS_MAP[action];
  if (!nextStatus) {
    res.status(400);
    throw new Error('action must be process | complete | reject');
  }

  // Auto-payout: admin approves a pending withdrawal, Razorpay is enabled, and
  // no manual TXN id was supplied → fire a real RazorpayX payout. Coins are
  // held now and refunded if the call fails; the webhook confirms completion.
  if (action === 'complete' && !txnId && (await payoutsEnabled())) {
    await runRazorpayPayout({ req, res, tx });
    return;
  }

  tx.status = nextStatus;
  tx.metadata = {
    ...(tx.metadata || {}),
    ...(note ? { note } : {}),
    ...(txnId ? { payoutId: txnId } : {}),
    ...(nextStatus === 'completed' ? { completedAt: new Date() } : {}),
    actionedBy: req.user?._id?.toString(),
    actionedAt: new Date(),
  };
  await tx.save();

  // Coin-only economy: withdrawals debit the user's coin balance, not
  // cashback. The coin count is set by the user at request time and stored
  // on metadata.coinsRedeemed; we apply it lazily here on completion so a
  // mid-flight reject doesn't need a refund.
  //
  //   - complete: subtract coinsRedeemed from wallet.coins
  //   - reject:   nothing to refund (coins were never debited)
  //   - process:  no balance change yet
  const coinsRedeemed = Number(tx.metadata?.coinsRedeemed) || 0;
  if (action === 'complete' && coinsRedeemed > 0) {
    const wallet = await ensureWallet(tx.userId);
    if (wallet.coins < coinsRedeemed) {
      // Defensive: user's balance dropped below the held amount between
      // request and completion (shouldn't happen with our flow, but better
      // to error than silently overdraft).
      tx.status = 'pending'; // rollback the status flip
      await tx.save();
      res.status(400);
      throw new Error(`Insufficient coins (${wallet.coins} available, ${coinsRedeemed} needed)`);
    }
    wallet.coins -= coinsRedeemed;
    await wallet.save();
  }

  if (nextStatus === 'completed') {
    try {
      await notify({ userId: tx.userId, type: 'withdrawal_paid', data: { amount: Math.abs(tx.amount), method: tx.metadata?.method || 'UPI' } });
    } catch (e) { /* best-effort */ }
  } else if (nextStatus === 'rejected') {
    try {
      await notify({ userId: tx.userId, type: 'withdrawal_rejected', data: { amount: Math.abs(tx.amount) } });
    } catch (e) { /* best-effort */ }
  }

  res.json({ status: 'success', data: { transaction: tx } });
};

/**
 * POST /api/admin/reports/import
 *
 * Bulk-credit users from a merchant report. Body shape:
 *
 *   {
 *     merchant: "amazon" | "myntra" | "cuelinks" | ...
 *     periodStart, periodEnd: ISO dates (optional, for audit)
 *     rows: [
 *       { orderId, subid, amount, commission, status, timestamp? }
 *     ]
 *   }
 *
 * For each row we extract userId from the subid (cr_<userId> pattern), create
 * a pending Transaction with a 30-day lock period, and remember the matched
 * userId for the audit trail. Rows we can't match are returned so the admin
 * can manually assign them in a follow-up (or we'll add click-log matching
 * in Phase 3).
 *
 * Idempotency: each merchant orderId can only be credited once per user.
 * Duplicate orderIds in the same import (or already in the DB) are reported
 * as `error: 'duplicate'` rather than double-credited.
 */
export const importReport = async (req, res) => {
  const { merchant, periodStart, periodEnd, rows } = req.body || {};

  if (!merchant || typeof merchant !== 'string') {
    res.status(400);
    throw new Error('merchant is required');
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400);
    throw new Error('rows must be a non-empty array');
  }
  if (rows.length > 5000) {
    res.status(400);
    throw new Error('Import too large — split into batches of 5000 or fewer');
  }

  // Load current coin-economy config. Used inside the per-row loop below.
  const settings = await AdminSettings.get();
  const passThroughPercent = settings.passThroughPercent;
  const coinsPerRupee      = settings.coinsPerRupee;
  const defaultLockDays    = settings.defaultLockDays;

  // Collect orderIds we've already credited from this merchant to dedupe.
  const incomingOrderIds = rows.map((r) => String(r.orderId || '')).filter(Boolean);
  const existing = await Transaction.find({
    'metadata.brand': merchant.toLowerCase(),
    'metadata.orderId': { $in: incomingOrderIds },
  })
    .select('metadata.orderId')
    .lean();
  const dupSet = new Set(existing.map((t) => t.metadata?.orderId));

  // Process row-by-row. Single-import idempotency too: track orderIds we
  // create in THIS request so a duplicate within the same CSV doesn't
  // double-credit either.
  const seenInRequest = new Set();
  const results = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let failedCount = 0;
  let totalCredited = 0;

  for (const raw of rows) {
    const row = {
      rawRow: raw,
      orderId: String(raw.orderId || ''),
      subid: String(raw.subid || ''),
      amount: Number(raw.amount) || 0,
      commission: Number(raw.commission) || 0,
      status: String(raw.status || 'confirmed').toLowerCase(),
      matchedUserId: null,
      matchedVia: 'none',
      matchConfidence: 0,
      transactionId: null,
      error: null,
    };

    if (!row.orderId) {
      row.error = 'missing_orderId';
      failedCount += 1;
      results.push(row);
      continue;
    }
    if (dupSet.has(row.orderId) || seenInRequest.has(row.orderId)) {
      row.error = 'duplicate';
      failedCount += 1;
      results.push(row);
      continue;
    }
    seenInRequest.add(row.orderId);

    if (row.commission <= 0) {
      row.error = 'zero_commission';
      failedCount += 1;
      results.push(row);
      continue;
    }

    // ── Attribution: primary subid, fallback click-log ─────────────────
    // Primary: extract userId from the "cr_<userId>" subid pattern.
    // Fallback: no valid subid → search ClickEvent for a plausible match
    // on this merchant in the last 48h. If exactly one distinct user
    // clicked, credit them with medium confidence (70). Multiple candidates
    // means we can't safely pick one — leave as unmatched for admin review.
    let userId = userIdFromSubid(row.subid);
    let matchedByFallback = false;

    if (!userId) {
      const candidates = await ClickEvent.find({
        merchant: merchant.toLowerCase(),
        userId: { $exists: true, $ne: null },
        createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      })
        .select('userId')
        .lean();
      const distinctUsers = [...new Set(candidates.map((c) => String(c.userId)))];
      if (distinctUsers.length === 1) {
        userId = distinctUsers[0];
        matchedByFallback = true;
      } else {
        row.error = distinctUsers.length === 0 ? 'no_subid_match' : 'ambiguous_click_match';
        unmatchedCount += 1;
        results.push(row);
        continue;
      }
    }

    // Verify the user exists before creating the transaction.
    const user = await User.findById(userId).select('_id').lean();
    if (!user) {
      row.error = 'user_not_found';
      unmatchedCount += 1;
      results.push(row);
      continue;
    }

    // ── Coin attribution — commission-based formula ─────────────────────
    // Primary path (correct):
    //   coins = commission × passThroughPercent × coinsPerRupee
    //
    // The merchant's commission column IS the source of truth for what the
    // user actually bought. If they bought a ₹2000 fashion item at 8%, the
    // merchant tells us so via commission=160. We just split it with the
    // user per the admin-configured pass-through.
    //
    // Promotional override:
    // If we can trace the row back to a specific deal via the click log AND
    // that deal has coinsReward > 0, we use the flat reward instead. Only
    // for admin-configured promotional deals.
    let coinsToCredit;
    let coinsSource = 'formula';
    let matchedDealId = null;

    const recentClick = await ClickEvent.findOne({
      userId,
      merchant: merchant.toLowerCase(),
      dealId: { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .populate('dealId', 'coinsReward title')
      .lean();

    if (recentClick?.dealId?.coinsReward > 0) {
      // Deal-configured promotional flat reward.
      coinsToCredit = recentClick.dealId.coinsReward;
      coinsSource = 'deal_promo';
      matchedDealId = recentClick.dealId._id;
    } else {
      // Standard commission-based formula.
      coinsToCredit = Math.round(row.commission * passThroughPercent * coinsPerRupee);
      if (recentClick?.dealId?._id) matchedDealId = recentClick.dealId._id;
    }

    const lockExpiresAt = new Date(Date.now() + defaultLockDays * 24 * 60 * 60 * 1000);
    const transaction = await Transaction.create({
      userId,
      // Coins-only economy: every purchase reward is a coin_credit, held
      // pending until the lock expires. Confirmed by the Phase D cron job.
      type: 'coin_credit',
      amount: coinsToCredit,
      status: 'pending',
      description: `${merchant.charAt(0).toUpperCase()}${merchant.slice(1)} reward · order ${row.orderId}`,
      ...(matchedDealId ? { dealId: matchedDealId } : {}),
      metadata: {
        brand: merchant.toLowerCase(),
        orderId: row.orderId,
        lockExpiresAt,
        importedFromReport: true,
        subid: row.subid,
        commissionPaid: row.commission,      // audit — what the merchant paid us
        passThroughPercent,                  // audit — rate at credit time
        coinsPerRupee,                       // audit — rate at credit time
        coinsSource,                         // 'formula' | 'deal_promo'
      },
    });

    // Split model: coins go to pendingCoins until lock expires. Users can
    // SEE these in-app but can't withdraw against them — protects us from
    // paying out on a sale that gets returned/canceled.
    await Wallet.updateOne(
      { userId },
      {
        $inc: { pendingCoins: coinsToCredit },
        $setOnInsert: { coins: 0, confirmedCashback: 0, pendingCashback: 0, lifetimeEarned: 0 },
      },
      { upsert: true },
    );

    try {
      await notify({ userId, type: 'coins_credited', data: { coins: coinsToCredit, orderId: row.orderId } });
    } catch (e) { /* best-effort: a notification failure must never break the credit */ }

    row.matchedUserId = userId;
    row.matchedVia = matchedByFallback
      ? 'click_log_fallback'
      : (matchedDealId ? 'subid+click' : 'subid');
    row.matchConfidence = matchedByFallback ? 70 : (matchedDealId ? 100 : 90);
    row.transactionId = transaction._id;
    // Stash coin attribution on the audit row so the admin can see WHY a
    // particular row got a particular coin amount.
    row.rawRow = { ...row.rawRow, _coinsAwarded: coinsToCredit, _coinsSource: coinsSource };
    matchedCount += 1;
    totalCredited += coinsToCredit;
    results.push(row);
  }

  const importRecord = await ReportImport.create({
    merchant: merchant.toLowerCase(),
    periodStart: periodStart ? new Date(periodStart) : undefined,
    periodEnd:   periodEnd   ? new Date(periodEnd)   : undefined,
    importedBy: req.user._id,
    importedAt: new Date(),
    totalRows: rows.length,
    matchedRows: matchedCount,
    unmatchedRows: unmatchedCount,
    failedRows: failedCount,
    totalCommissionCredited: totalCredited,
    rows: results,
  });

  res.json({
    status: 'success',
    data: {
      importId: importRecord._id,
      summary: {
        total: rows.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        failed: failedCount,
        totalCommissionCredited: totalCredited,
      },
      results,
    },
  });
};

/**
 * GET /api/admin/reports/imports
 *
 * History of past report imports — list view for the Reports Inbox tab.
 */
export const listReportImports = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const imports = await ReportImport.find({})
    .sort({ importedAt: -1 })
    .limit(limit)
    .populate('importedBy', 'name email')
    .select('-rows') // hide the heavy per-row data on the list view
    .lean();

  res.json({ status: 'success', data: { imports } });
};

/**
 * GET /api/admin/reports/imports/:id
 *
 * Single import detail — includes the per-row results for forensics.
 */
export const getReportImport = async (req, res) => {
  const imp = await ReportImport.findById(req.params.id)
    .populate('importedBy', 'name email')
    .populate('rows.matchedUserId', 'name phone')
    .lean();
  if (!imp) {
    res.status(404);
    throw new Error('Report import not found');
  }
  res.json({ status: 'success', data: { import: imp } });
};
