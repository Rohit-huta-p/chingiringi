import mongoose from 'mongoose';
import Transaction from '../transactions/transactionModel.js';
import { notify } from '../notifications/notificationService.js';
import { applyPayoutOutcome } from './payoutService.js';
import { verifyWebhookSignature as verifyRazorpaySignature } from './razorpayService.js';
import {
  verifyWebhookSignature as verifyCashfreeSignature,
  outcomeFromStatus as cashfreeOutcome,
  loadConfig as cashfreeLoadConfig,
} from './cashfreeService.js';

// Both provider webhooks flip a withdrawal's final state through the shared
// applyPayoutOutcome (refund-on-fail / complete-on-success lives there, once).
// Each webhook only owns its own signature check + payload→outcome mapping +
// how it finds our Transaction.

// Best-effort user notification of a terminal payout outcome.
async function notifyOutcome(tx, outcome) {
  try {
    await notify({
      userId: tx.userId,
      type: outcome === 'paid' ? 'withdrawal_paid' : 'withdrawal_rejected',
      data: { amount: Math.abs(tx.amount), method: tx.metadata?.method || 'UPI' },
    });
  } catch (e) { /* best-effort */ }
}

// Razorpay payout event → our outcome.
function razorpayOutcome(event) {
  if (event === 'payout.processed') return 'paid';
  if (event === 'payout.failed' || event === 'payout.reversed') return 'failed';
  return null;
}

/**
 * POST /api/webhooks/razorpay
 *
 * Raw-body mounted (app.js) so the HMAC signature verifies over the exact bytes
 * Razorpay signed. Always 200 for a handled/ignored event so Razorpay stops
 * retrying; only a bad signature 400s. Matches by `metadata.payoutId` — after a
 * failure we clear that id, so a stale event finds no match and no-ops.
 */
export const razorpayWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers['x-razorpay-signature'];

  const ok = await verifyRazorpaySignature(raw, signature);
  if (!ok) return res.status(400).json({ status: 'error', message: 'Invalid signature' });

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { event = null; }
  if (!event?.event) return res.status(200).json({ status: 'ignored' });

  const payout = event.payload?.payout?.entity;
  const outcome = payout ? razorpayOutcome(String(event.event)) : null;
  if (!payout || !outcome) return res.status(200).json({ status: 'ignored' });

  const tx = await Transaction.findOne({ type: 'withdrawal', 'metadata.payoutId': payout.id });
  if (!tx) return res.status(200).json({ status: 'no-match' });

  const changed = await applyPayoutOutcome(tx, outcome, {
    status: payout.status,
    reason: payout.failure_reason || event.event,
  });
  if (changed) await notifyOutcome(tx, outcome);
  return res.status(200).json({ status: 'ok' });
};

/**
 * POST /api/webhooks/cashfree
 *
 * Raw-body mounted (app.js). Verifies the Cashfree V2 signature over
 * `x-webhook-timestamp + rawBody`, then matches our withdrawal by `transfer_id`
 * (which we set to the Transaction _id). SUCCESS → completed; FAILED / REJECTED
 * / REVERSED → refund + pending. In-flight / unknown / dup → 200 no-op.
 */
export const cashfreeWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  const ok = await verifyCashfreeSignature(raw, { signature, timestamp });
  if (!ok) {
    // TEMP DIAGNOSTIC — remove once the webhook is verified. Logs WHY the
    // signature failed so we can match Cashfree's actual scheme. Never logs the
    // secret value, only whether one is configured; a sandbox test payload is
    // dummy data.
    let bodyKeys = [];
    let hasBodySignature = false;
    try {
      const b = JSON.parse(raw.toString('utf8'));
      bodyKeys = Object.keys(b);
      hasBodySignature = !!(b.signature || b.data?.signature);
    } catch { /* not JSON */ }
    let secretConfigured = false;
    let env = 'unknown';
    try { const cfg = await cashfreeLoadConfig(); secretConfigured = !!cfg.webhookSecret; env = cfg.env; } catch { /* ignore */ }
    console.warn('[cashfree-webhook] 400 invalid signature', JSON.stringify({
      secretConfigured,
      env,
      hasSigHeader: !!signature,
      hasTsHeader: !!timestamp,
      xHeaders: Object.keys(req.headers).filter((h) => h.startsWith('x-')),
      bodyKeys,
      hasBodySignature,
      rawPreview: raw.toString('utf8').slice(0, 500),
    }));
    return res.status(400).json({ status: 'error', message: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { event = null; }
  // VERIFY payload shape — V2 nests the transfer under data.transfer.
  const transfer = event?.data?.transfer || event?.data || {};
  const transferId = transfer.transfer_id;
  const outcome = cashfreeOutcome(transfer.status || event?.type);
  if (!transferId || !outcome) return res.status(200).json({ status: 'ignored' });

  if (!mongoose.Types.ObjectId.isValid(transferId)) return res.status(200).json({ status: 'no-match' });
  const tx = await Transaction.findOne({ _id: transferId, type: 'withdrawal' });
  if (!tx) return res.status(200).json({ status: 'no-match' });

  const changed = await applyPayoutOutcome(tx, outcome, {
    status: transfer.status,
    reason: transfer.status_description || transfer.failure_reason,
  });
  if (changed) await notifyOutcome(tx, outcome);
  return res.status(200).json({ status: 'ok' });
};
