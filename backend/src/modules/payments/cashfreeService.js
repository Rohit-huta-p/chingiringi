import crypto from 'crypto';
import AdminSettings from '../admin/adminSettingsModel.js';

// Cashfree Payouts (V2). client id/secret + env live in the AdminSettings
// singleton (entered by the admin in-app) — never in code or env here. All API
// calls use Node's built-in fetch + crypto, so there is no extra dependency.
// Mirrors the shape of razorpayService.js so payoutService can pick either one.
//
// VERIFY against your Cashfree dashboard before going live — the V2 API
// reference is gated, so every provider-specific literal is isolated below and
// marked `VERIFY`. A wrong webhook guess fails closed (signature mismatch →
// rejected, nothing pays out), so it surfaces safely in sandbox.

const API_VERSION = '2024-01-01'; // VERIFY [2] x-api-version
const BASE = {
  prod:    'https://api.cashfree.com/payout',      // VERIFY [1]
  sandbox: 'https://sandbox.cashfree.com/payout',  // VERIFY [1]
};

/** Load the live Cashfree config from the admin settings singleton. */
export async function loadConfig() {
  const s = await AdminSettings.get();
  return {
    clientId:      s.cashfreeClientId || '',
    clientSecret:  s.cashfreeClientSecret || '',
    env:           s.cashfreeEnv === 'prod' ? 'prod' : 'sandbox',
    // Cashfree signs webhooks with the client secret; a separate field is kept
    // in case an account uses a distinct signing secret.
    webhookSecret: s.cashfreeWebhookSecret || s.cashfreeClientSecret || '',
    enabled:       !!s.cashfreeEnabled,
  };
}

/** True when payouts can actually run (used by the UI / callers to branch). */
export async function payoutsEnabled() {
  const c = await loadConfig();
  return !!(c.enabled && c.clientId && c.clientSecret);
}

/** Throws a message-bearing error if payouts can't run; returns the config. */
export async function assertPayoutsReady() {
  const cfg = await loadConfig();
  if (!cfg.enabled) throw new Error('Cashfree payouts are disabled — enable them in Admin → Settings.');
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('Cashfree client id / secret not configured.');
  return cfg;
}

/**
 * JSON call to the Cashfree Payouts API with the V2 header auth. Throws with
 * Cashfree's own message on non-2xx so the admin sees something useful.
 */
async function cfFetch(cfg, path, method = 'POST', body) {
  const res = await fetch(`${BASE[cfg.env]}${path}`, {
    method,
    headers: {
      'x-client-id': cfg.clientId,
      'x-client-secret': cfg.clientSecret,
      'x-api-version': API_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json?.message || json?.raw || `Cashfree ${path} failed (${res.status})`);
    err.cashfree = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Full payout for one withdrawal: a single V2 standard transfer with the
 * beneficiary inline (no contact/fund-account round-trips like Razorpay).
 * `dest` = { method: 'UPI' | 'Bank', upiId?, name?, ifsc?, accountNumber? }.
 * `transfer_id = tx._id` is the idempotency key — Cashfree rejects a duplicate,
 * so a retry can never double-pay.
 * Returns { payoutId, status } (contactId/fundAccountId absent — not used here).
 */
export async function payoutForWithdrawal({ userName, userId, txId, amountRupees, dest }) {
  const cfg = await assertPayoutsReady();
  const amount = Math.round(Number(amountRupees) * 100) / 100; // rupees, 2dp
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid payout amount.');
  if (dest.method === 'UPI' && !dest.upiId) throw new Error('UPI id missing on this withdrawal.');
  if (dest.method === 'Bank' && (!dest.accountNumber || !dest.ifsc)) {
    throw new Error('Bank account number / IFSC missing on this withdrawal.');
  }

  const instrument = dest.method === 'UPI'
    ? { vpa: dest.upiId }
    : { bank_account_number: dest.accountNumber, bank_ifsc: dest.ifsc };

  const transfer = await cfFetch(cfg, '/transfers', 'POST', {
    transfer_id: String(txId),
    transfer_amount: amount,
    transfer_mode: dest.method === 'UPI' ? 'upi' : 'imps', // VERIFY [3]
    beneficiary_details: {
      beneficiary_name: (dest.name || userName || 'Chingiringi user').slice(0, 100),
      beneficiary_instrument_details: instrument,
    },
  });

  return {
    payoutId: transfer.cf_transfer_id || transfer.transfer_id || String(txId),
    status: transfer.status, // RECEIVED | PENDING | SUCCESS | FAILED | ...
  };
}

/**
 * Map a Cashfree transfer status / webhook event name to our withdrawal
 * outcome. Anything still in flight (RECEIVED/PENDING/APPROVAL_PENDING) → null,
 * so the webhook is a safe no-op until a terminal state arrives.
 */
export function outcomeFromStatus(status) {
  const s = String(status || '').toUpperCase();
  if (['SUCCESS', 'ACKNOWLEDGED', 'COMPLETED', 'TRANSFER_SUCCESS', 'TRANSFER_ACKNOWLEDGED'].includes(s)) return 'paid';
  if (['FAILED', 'REJECTED', 'REVERSED', 'RETURNED', 'TRANSFER_FAILED', 'TRANSFER_REJECTED', 'TRANSFER_REVERSED'].includes(s)) return 'failed';
  return null;
}

/**
 * Verify a Cashfree Payouts V2 webhook: HMAC-SHA256 of `timestamp + rawBody`
 * with the client (webhook) secret, base64-encoded, constant-time compared to
 * the x-webhook-signature header. VERIFY [4] — if your account is on the V1
 * payout webhook (sorted POST params), swap this one function.
 */
export async function verifyWebhookSignature(rawBody, { signature, timestamp } = {}) {
  const cfg = await loadConfig();
  if (!cfg.webhookSecret || !signature || !timestamp) return false;
  const payload = `${timestamp}${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(payload).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
