# Razorpay Payments — Design Spec

**Date:** 2026-07-22
**Status:** Approved — building Phase 0 + Phase 2
**Scope of this build:** Phase 0 (Razorpay core service) + Phase 2 (user cashback **withdrawal payouts** via RazorpayX). Phases 1 (offline-store collection) and 3 (store settlement) are designed elsewhere and out of scope here.

---

## 1. Where Razorpay is used (whole picture)

Razorpay is currently **stubbed only** — keys live in `AdminSettings` (`razorpayKeyId/Secret/AccountNumber/Enabled`), masked by `adminSettingsController.js`, with a status card in `AdminProfileScreen.tsx`. Nothing calls the API yet.

| # | Flow | Direction | Roles | Razorpay product | Status |
|---|------|-----------|-------|------------------|--------|
| 1 | Offline-store in-app payment (instant discount) | Collect — shopper → Chingiringi | shopper · store · admin | Orders + Checkout + webhook | Designed (stores Tier 2), not built |
| 2 | **User cashback withdrawal** | **Payout — Chingiringi → user** | user requests · admin approves | **RazorpayX Payouts** | **This build** |
| 3 | Store settlement | Payout — Chingiringi → store | store · admin | RazorpayX Payouts | Designed (stores Tier 3), not built |
| 4 | Razorpay keys config | — | admin | — | Built |

## 2. Current withdrawal flow (what we wire into)

- **User:** `POST /api/wallet/withdraw` (`requestWithdrawal`) creates `Transaction(type='withdrawal', status='pending', amount=₹)` with the payout destination + `coinsRedeemed` + locked `coinRate` on `metadata`. Wallet is **not** debited yet.
- **Admin:** `PATCH /api/admin/withdrawals/:id` (`updateWithdrawal`) moves `pending → processing → completed` (or `rejected`). Today "complete" is **manual** — admin pays out-of-band and pastes a UPI/bank TXN id; coins are debited on complete.
- A withdrawal **is** a `Transaction` — there is no separate Withdrawal model. `metadata.payoutId` is already anticipated in the read shape.

### 2.1 Latent bug to fix first
`Transaction.metadata` is a **typed sub-schema** (`brand/orderId/lockExpiresAt/rejectionReason/payoutId`). Mongoose strict mode drops any other key on save — but the code writes `method/paymentDetails/accountNumber/ifsc/coinsRedeemed/coinRate/actionedBy/completedAt` to it. Those are needed to pay out. **Fix:** change `metadata` to `Schema.Types.Mixed` (default `{}`) so the whole bag persists. Existing docs are unaffected.

## 3. Phase 0 — Razorpay core service

`backend/src/modules/payments/razorpayService.js`

- Config from `AdminSettings.get()`: `razorpayKeyId`, `razorpayKeySecret`, `razorpayAccountNumber` (RazorpayX payout account), `razorpayEnabled`, **new `razorpayWebhookSecret`**.
- `assertPayoutsReady()` — throws a clear 4xx-style error if not configured/enabled.
- `rzpFetch(path, method, body)` — `https://api.razorpay.com{path}` with HTTP Basic auth (`keyId:keySecret`) via Node's built-in `fetch`; throws with Razorpay's error payload on non-2xx.
- `createContact({ name, referenceId })` → `POST /v1/contacts`.
- `createFundAccount({ contactId, method, upiId, name, ifsc, accountNumber })` → `POST /v1/fund_accounts` (`vpa` for UPI, `bank_account` for Bank).
- `createPayout({ fundAccountId, amountPaise, mode, referenceId, narration })` → `POST /v1/payouts` with `account_number = razorpayAccountNumber`, `currency: 'INR'`, `queue_if_low_balance: true`.
- `verifyWebhookSignature(rawBody, signature)` — HMAC-SHA256 over the raw request body with `razorpayWebhookSecret`, compared with `crypto.timingSafeEqual`.
- Built-in `fetch` + `crypto` only — **no new npm dependency.**

**AdminSettings / admin UI:** add `razorpayWebhookSecret` (masked exactly like `razorpayKeySecret`) in the model + controller + `api/admin.ts` types + the `AdminProfileScreen` payout card, which also displays the webhook URL to register (`{API_BASE}/api/webhooks/razorpay`).

## 4. Phase 2 — Withdrawal payout wiring

### 4.1 Payout on approval (`updateWithdrawal`)
When admin approves a pending withdrawal **and Razorpay payouts are enabled** (else the manual "paste TXN id" path is unchanged):

1. **Idempotency guard** — refuse if `metadata.payoutId` already set or status ∉ {pending}.
2. Recompute ₹ from `coinsRedeemed × coinRate` on the tx (never trust the client) and confirm the wallet still holds `coinsRedeemed`.
3. **Hold the coins:** debit `wallet.coins -= coinsRedeemed` now (so the user can't double-withdraw while the payout is in flight).
4. `createContact` → `createFundAccount` (UPI `vpa` or bank) → `createPayout` (`amountPaise = round(₹ × 100)`, `mode = 'UPI' | 'IMPS'`, `reference_id = tx._id`).
5. Store `payoutId`, `contactId`, `fundAccountId`, `payoutStatus='processing'` on metadata; set `tx.status='processing'`.
6. **On any API failure:** refund the held coins, set `tx.status='pending'`, return Razorpay's error message. No coins lost.

### 4.2 Webhook (`POST /api/webhooks/razorpay`)
New `paymentsRoutes` mounted in `app.js` **before** the JSON body parser for this path (needs the **raw body** for signature verification), no auth middleware, signature-verified:

- `payout.processed` → find tx by `payoutId` → `status='completed'`, `metadata.completedAt`, notify `withdrawal_paid`.
- `payout.failed` / `payout.reversed` → find tx → **refund coins**, `status='pending'` (retryable), `metadata.payoutFailureReason`, notify `withdrawal_rejected`.
- Unknown/duplicate events → 200 no-op (idempotent).

### 4.3 Manual fallback
When Razorpay is disabled/unconfigured, `updateWithdrawal` keeps the exact current behavior (manual TXN id, debit-on-complete). The two paths never both run for one withdrawal.

## 5. Frontend

- **`WalletOperationsScreen`** — the pending-withdrawal "Approve & Pay": if `razorpayEnabled`, call the payout action (no manual TXN-id prompt) and show `processing/completed/failed` + `payoutId` + any failure reason; if not enabled, keep the manual prompt.
- **`AdminProfileScreen`** — add the webhook-secret field and show the webhook URL + the 3 events to register.

## 6. Safety & guards

- Server-recomputed ₹; client totals never trusted.
- Idempotent: `reference_id = tx._id` + `payoutId` guard prevents double payout.
- Coins **held on initiation, refunded on failure** — a failed/reversed payout never loses the user's coins.
- Webhook signature verified with `timingSafeEqual`.
- **Test keys only** until explicitly flipped to live. The agent never handles real keys — the admin enters them in the app.

## 7. Ops setup (admin does this — documented, not automated)

1. Enable **RazorpayX Payouts** on the Razorpay account (+ IP allowlist if the account requires it).
2. In admin settings, enter the RazorpayX **account number** and a **webhook secret** (key id/secret already there).
3. In the Razorpay dashboard, register the webhook `{API_BASE}/api/webhooks/razorpay` for events `payout.processed`, `payout.failed`, `payout.reversed`.
4. Start in **Test mode** (test keys). RazorpayX test-mode payouts are simulated; verify the state machine before going live.

## 8. Build order

1. `metadata` → Mixed (transaction model).
2. `AdminSettings.razorpayWebhookSecret` + controller mask + `api/admin.ts` + `AdminProfileScreen` field & webhook URL.
3. `razorpayService.js` (Phase 0).
4. `updateWithdrawal` payout path + refund-on-failure.
5. `paymentsController` + `paymentsRoutes` webhook, mounted with raw body in `app.js`.
6. `WalletOperationsScreen` payout UX.
7. Verify state machine with test keys; document; checkpoint before live.

## 9. Out of scope (separate specs)

- Phase 1 — offline-store collection (Razorpay Orders + Checkout on web + native EAS, `StoreTransaction`, cashier confirm).
- Phase 3 — store settlement (`Settlement` model, admin Settlements screen, store payouts).
