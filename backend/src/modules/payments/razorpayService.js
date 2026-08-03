import crypto from 'crypto';
import AdminSettings from '../admin/adminSettingsModel.js';

// RazorpayX payouts + webhook verification. Keys live in the AdminSettings
// singleton (entered by the admin in-app) — never in code or env here. All API
// calls use Node's built-in fetch + crypto, so there is no extra dependency.

const RZP_BASE = 'https://api.razorpay.com';

/** Load the live Razorpay config from the admin settings singleton. */
export async function loadConfig() {
  const s = await AdminSettings.get();
  return {
    keyId:         s.razorpayKeyId || '',
    keySecret:     s.razorpayKeySecret || '',
    accountNumber: s.razorpayAccountNumber || '',
    webhookSecret: s.razorpayWebhookSecret || '',
    enabled:       !!s.razorpayEnabled,
  };
}

/** True when payouts can actually run (used by the UI / callers to branch). */
export async function payoutsEnabled() {
  const c = await loadConfig();
  return !!(c.enabled && c.keyId && c.keySecret && c.accountNumber);
}

/** Throws a message-bearing error if payouts can't run; returns the config. */
export async function assertPayoutsReady() {
  const cfg = await loadConfig();
  if (!cfg.enabled) throw new Error('Razorpay payouts are disabled — enable them in Admin → Settings.');
  if (!cfg.keyId || !cfg.keySecret) throw new Error('Razorpay key id / secret not configured.');
  if (!cfg.accountNumber) throw new Error('RazorpayX account number not configured.');
  return cfg;
}

/**
 * Basic-auth JSON call to the Razorpay API. Throws with Razorpay's own error
 * description on non-2xx so the admin sees a useful message.
 */
async function rzpFetch(cfg, path, method = 'GET', body) {
  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
  const res = await fetch(`${RZP_BASE}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json?.error?.description || json?.raw || `Razorpay ${path} failed (${res.status})`);
    err.razorpay = json?.error || json;
    err.status = res.status;
    throw err;
  }
  return json;
}

// ── RazorpayX payout primitives ──────────────────────────────────────────────

function createContact(cfg, { name, referenceId }) {
  return rzpFetch(cfg, '/v1/contacts', 'POST', {
    name: name || 'Chingiringi user',
    type: 'customer',
    reference_id: referenceId,
  });
}

function createFundAccount(cfg, { contactId, method, upiId, name, ifsc, accountNumber }) {
  if (method === 'UPI') {
    return rzpFetch(cfg, '/v1/fund_accounts', 'POST', {
      contact_id: contactId,
      account_type: 'vpa',
      vpa: { address: upiId },
    });
  }
  return rzpFetch(cfg, '/v1/fund_accounts', 'POST', {
    contact_id: contactId,
    account_type: 'bank_account',
    bank_account: { name: name || 'Chingiringi user', ifsc, account_number: accountNumber },
  });
}

function createPayout(cfg, { fundAccountId, amountPaise, mode, referenceId, narration }) {
  return rzpFetch(cfg, '/v1/payouts', 'POST', {
    account_number: cfg.accountNumber,
    fund_account_id: fundAccountId,
    amount: amountPaise,
    currency: 'INR',
    mode,                                      // 'UPI' | 'IMPS'
    purpose: 'payout',
    queue_if_low_balance: true,
    reference_id: String(referenceId).slice(0, 40),  // idempotency: our tx _id
    narration: (narration || 'Chingiringi payout').slice(0, 30),
  });
}

/**
 * Full payout for one withdrawal: contact → fund account → payout.
 * `dest` = { method: 'UPI' | 'Bank', upiId?, name?, ifsc?, accountNumber? }.
 * Returns { payoutId, contactId, fundAccountId, status }.
 */
export async function payoutForWithdrawal({ userName, userId, txId, amountRupees, dest }) {
  const cfg = await assertPayoutsReady();
  const amountPaise = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error('Invalid payout amount.');
  }
  if (dest.method === 'UPI' && !dest.upiId) throw new Error('UPI id missing on this withdrawal.');
  if (dest.method === 'Bank' && (!dest.accountNumber || !dest.ifsc)) {
    throw new Error('Bank account number / IFSC missing on this withdrawal.');
  }

  const contact = await createContact(cfg, { name: userName, referenceId: `user_${userId}` });
  const fundAccount = await createFundAccount(cfg, {
    contactId: contact.id,
    method: dest.method,
    upiId: dest.upiId,
    name: dest.name || userName,
    ifsc: dest.ifsc,
    accountNumber: dest.accountNumber,
  });
  const payout = await createPayout(cfg, {
    fundAccountId: fundAccount.id,
    amountPaise,
    mode: dest.method === 'UPI' ? 'UPI' : 'IMPS',
    referenceId: txId,
    narration: 'Chingiringi cashback',
  });

  return {
    payoutId: payout.id,
    contactId: contact.id,
    fundAccountId: fundAccount.id,
    status: payout.status,   // 'queued' | 'pending' | 'processing' | 'processed' | ...
  };
}

// ── Webhook signature ────────────────────────────────────────────────────────

/**
 * Verify a Razorpay webhook: HMAC-SHA256 of the RAW request body with the
 * configured webhook secret, constant-time compared to X-Razorpay-Signature.
 */
export async function verifyWebhookSignature(rawBody, signature) {
  const cfg = await loadConfig();
  if (!cfg.webhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
