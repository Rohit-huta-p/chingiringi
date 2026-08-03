import Transaction from '../transactions/transactionModel.js';
import Wallet from '../wallet/walletModel.js';
import { verifyWebhookSignature } from './razorpayService.js';
import { notify } from '../notifications/notificationService.js';

// Re-credit the coins that were held for a payout that failed or reversed, so a
// failed payout never costs the user their coins.
async function refundHeldCoins(tx) {
  const coins = Number(tx.metadata?.coinsRedeemed) || 0;
  if (coins <= 0) return;
  const wallet = await Wallet.findOne({ userId: tx.userId });
  if (wallet) { wallet.coins += coins; await wallet.save(); }
}

/**
 * POST /api/webhooks/razorpay
 *
 * Mounted with a RAW body parser (see app.js) so the HMAC signature can be
 * verified over the exact bytes Razorpay signed. Always returns 200 for a
 * handled/ignored event so Razorpay stops retrying; only a bad signature 400s.
 *
 * Matching is by `metadata.payoutId` — after a payout fails we clear that id,
 * so a duplicate/stale event finds no match and is a safe no-op (no double
 * refund, no clobbering a fresh retry payout).
 */
export const razorpayWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers['x-razorpay-signature'];

  const ok = await verifyWebhookSignature(raw, signature);
  if (!ok) return res.status(400).json({ status: 'error', message: 'Invalid signature' });

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { event = null; }
  if (!event?.event) return res.status(200).json({ status: 'ignored' });

  const payout = event.payload?.payout?.entity;
  if (payout && String(event.event).startsWith('payout.')) {
    const tx = await Transaction.findOne({ type: 'withdrawal', 'metadata.payoutId': payout.id });
    if (!tx) return res.status(200).json({ status: 'no-match' });

    if (event.event === 'payout.processed' && tx.status === 'processing') {
      tx.status = 'completed';
      tx.metadata = { ...(tx.metadata || {}), payoutStatus: 'processed', completedAt: new Date() };
      await tx.save();
      try {
        await notify({
          userId: tx.userId,
          type: 'withdrawal_paid',
          data: { amount: Math.abs(tx.amount), method: tx.metadata?.method || 'UPI' },
        });
      } catch (e) { /* best-effort */ }
    } else if (
      (event.event === 'payout.failed' || event.event === 'payout.reversed') &&
      tx.status === 'processing'
    ) {
      await refundHeldCoins(tx);
      // Drop payoutId/contact/fundAccount so the withdrawal is cleanly retryable
      // and a duplicate event can't match it again.
      const { payoutId, contactId, fundAccountId, ...rest } = tx.metadata || {};
      tx.status = 'pending';
      tx.metadata = {
        ...rest,
        payoutStatus: payout.status || 'failed',
        payoutFailureReason: payout.failure_reason || event.event,
      };
      await tx.save();
      try {
        await notify({ userId: tx.userId, type: 'withdrawal_rejected', data: { amount: Math.abs(tx.amount) } });
      } catch (e) { /* best-effort */ }
    }
  }

  return res.status(200).json({ status: 'ok' });
};
