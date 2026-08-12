# Cashfree Payouts — Design Spec

**Date:** 2026-08-12
**Status:** Approved — building
**Scope:** Switch user withdrawal **payouts** from RazorpayX to **Cashfree Payouts**, keeping Razorpay fully intact behind a provider toggle. Adds an **instant-on-tap** payout capped per user/day; over-cap requests fall to the existing admin-approval queue. No auto/scheduled payouts anywhere — every payout originates from the user's Withdraw tap.

Builds on the Razorpay payout wiring in [`2026-07-22-razorpay-payouts-design.md`](./2026-07-22-razorpay-payouts-design.md).

---

## 1. Decision (locked)

**Instant under a ₹ cap.** When a user taps *Confirm Withdrawal*:

- **within the daily cap** and the active provider is enabled → fire the payout **now**; coins held atomically, status → `processing`, provider webhook → `completed`. If the provider call fails, coins are refunded and it drops to the admin queue (retryable).
- **over the cap** (or provider disabled) → stays `pending` for admin approval, exactly like today.

The payout trigger moves out of the admin step and into the user's tap; admin only reviews over-cap/failed ones.

## 2. Current flow we wire into

- **User:** `POST /api/wallet/withdraw` (`requestWithdrawal`, [walletController.js](../../../backend/src/modules/wallet/walletController.js)) creates `Transaction(type='withdrawal', status='pending', amount=₹)` with `coinsRedeemed` + locked `coinRate` + destination on `metadata`. Wallet **not** debited.
- **Admin:** `PATCH /api/admin/withdrawals/:id` (`updateWithdrawal`) approves → today fires `runRazorpayPayout` (holds coins → Razorpay → `processing` → webhook completes).
- A withdrawal **is** a `Transaction` (no separate model). `metadata` is `Schema.Types.Mixed` — arbitrary payout keys persist.
- Only **WalletScreen** + **MobileWalletScreen** open a withdraw form. **ProfileScreen** "Withdraw" has no handler; **MobileProfileScreen** "Withdraw ›" goes to history — both get wired to the withdraw flow.

## 3. Architecture — one seam, two providers

`razorpayService.js` and the new `cashfreeService.js` share an implicit interface (`payoutsEnabled`, `payoutForWithdrawal`, `verifyWebhookSignature`). A tiny dispatcher picks one by `AdminSettings.payoutProvider`; nothing else knows which provider ran.

### 3.1 `payments/payoutService.js` (new — the seam)
- `getPayoutService()` → `cashfree` | `razorpay` module from `AdminSettings.payoutProvider`.
- `payoutsEnabled()` → delegates to the active provider.
- **`firePayout(tx, { actorId })`** — the shared money path, extracted from `runRazorpayPayout`:
  1. Guard: refuse if `metadata.payoutId` set or status ≠ `pending`.
  2. Recompute ₹ + coins from the tx (never trust client).
  3. **Atomic coin hold:** `Wallet.updateOne({ userId, coins: { $gte: n } }, { $inc: { coins: -n } })`; `modifiedCount === 0` → insufficient. *This atomic guard is the double-spend fix — a read-then-save debit lets a double-tap fire two payouts.*
  4. `provider.payoutForWithdrawal(...)` (`transfer_id`/`reference_id = tx._id` for idempotency).
  5. Success → `metadata.payoutId/…`, `status='processing'`. **Failure → refund coins (`$inc`), leave `pending`, throw.**
- **`applyPayoutOutcome(tx, 'paid'|'failed', extra)`** — shared webhook effect: `paid`→`completed`; `failed`→refund coins + clear payout ids + back to `pending`. Guarded on `status==='processing'`; both webhooks call it.

### 3.2 `payments/cashfreeService.js` (new)
Cashfree Payouts **V2**, Node `fetch` + `crypto` only (no new dependency):
- Config from `AdminSettings`: `cashfreeClientId`, `cashfreeClientSecret`, `cashfreeEnv` (`sandbox`|`prod`), `cashfreeWebhookSecret` (falls back to client secret), `cashfreeEnabled`.
- Auth: headers `x-client-id`, `x-client-secret`, `x-api-version` on every call (no separate token step in V2).
- `payoutForWithdrawal` → **one** `POST /transfers` with inline `beneficiary_details` (`vpa` for UPI, `bank_account_number`+`bank_ifsc` for bank), `transfer_id = tx._id`, `transfer_mode` `upi`|`imps`. Simpler than Razorpay's contact→fund-account→payout.
- `verifyWebhookSignature(rawBody, { signature, timestamp })` — HMAC-SHA256 base64 of `timestamp + rawBody`, key = client secret.
- `outcomeFromStatus(status)` maps `SUCCESS/ACKNOWLEDGED`→`paid`, `FAILED/REJECTED/REVERSED`→`failed`, else in-flight.

**VERIFY against the Cashfree dashboard before prod (V2 API reference is gated; each literal is isolated + `VERIFY`-commented):**
1. base URL + `/transfers` path (`api.cashfree.com/payout` prod, `sandbox.cashfree.com/payout` sandbox)
2. `x-api-version` value (`2024-01-01`)
3. `transfer_mode` strings (`upi` / `imps`)
4. webhook signature scheme (V2 `x-webhook-timestamp`+body vs V1 sorted-params) — **fails closed**: a wrong guess rejects the webhook (no bad payout), obvious in sandbox.
5. whether the account allows inline beneficiary or requires a pre-add step.

## 4. Instant-under-cap (`requestWithdrawal`)
After creating the pending tx, if `instantPayoutEnabled` and `payoutsEnabled()`:
- Sum the user's `metadata.paidInstant: true` withdrawals since midnight; if `todayInstant + rupees ≤ instantPayoutCapRupees` → `firePayout(tx)`, mark `metadata.paidInstant`, `instant=true`, status `processing`.
- Provider call throws → caught, stays `pending` (admin queue), `instant=false`.
- Over cap / disabled → stays `pending`.

Response gains `{ instant, status }` so the app shows "₹X sent" vs "over daily limit — pending approval". Cap is a **soft fraud limit**; exact concurrency isn't locked (`// ponytail: soft cap`).

## 5. Admin path (`updateWithdrawal`)
`runRazorpayPayout` → thin `runProviderPayout` calling shared `firePayout` (provider-agnostic, atomic). **Double-debit guard:** the manual "paste TXN id" debit-on-complete now runs only when `!metadata.payoutId` (a payout-held tx — instant or admin-fired — is already debited).

## 6. Webhooks
- **Keep** `POST /api/webhooks/razorpay` (match `metadata.payoutId`).
- **Add** `POST /api/webhooks/cashfree` (raw-body mount in `app.js`, mirrors the razorpay line). Verify V2 signature → match `Transaction._id == transfer_id` → `applyPayoutOutcome` → notify. Unknown/in-flight/dup → `200` no-op.

## 7. Settings (`AdminSettings` singleton)
Add `payoutProvider` (`'cashfree'` default), `cashfreeClientId/Secret/Env/WebhookSecret/Enabled` (secret + webhook secret masked like Razorpay), `instantPayoutCapRupees` (default **500**), `instantPayoutEnabled` (default `true`). Controller: `ALLOWED` + masking + validation.

## 8. Frontend
- **admin.ts / AdminProfileScreen:** provider toggle, Cashfree config modal (mirrors `RazorpayModal`: client id/secret, env, webhook secret + registered webhook URL), instant-cap field.
- **Withdraw entry points:** wire ProfileScreen + MobileProfileScreen "Withdraw" → the withdraw flow (navigate to the Wallet screen).
- **Success copy:** WalletScreen + MobileWalletScreen read `data.instant` — instant → "₹X on its way to your UPI"; queued → "Over your daily limit — pending approval".

## 9. Out of scope / deferred
- KYC / beneficiary name-match / velocity checks beyond the ₹ cap (`// ponytail: add if abuse shows up`).
- Cashfree balance/low-balance handling, batch transfers, store settlement.
- Removing Razorpay — it stays as the fallback provider.
