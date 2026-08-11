# Share reward visibility + notifications — design spec

Date: 2026-08-11
Status: approved design, pre-plan
Builds on: click-confirmed shares (merged to main). Withholds coins until a share is confirmed.

## Goal

Click-confirmed shares credit nothing at share time — coins are *pending* until a friend opens the link. Today that pending reward is invisible in the app, and confirmation only fires a generic "Balance added" notification. Add:

1. **Two running totals per user**, shown on the wallet + profile screens: total **pending** share coins and total **confirmed** (earned-from-sharing) coins. Across all shares, not per product.
2. **Two proper notifications**: `share_pending` when they share, `share_confirmed` when a friend's open unlocks the coins.

## Non-goals

Per-product/per-share lists; touching wallet balances (`coins`/`pendingCoins`); a new notification-preferences category.

## Data source (derived, display-only)

The totals are **computed from `ShareEvent`**, never stored on the wallet — this preserves the click-confirmed "withhold until confirmed, no clawback" accounting. One aggregation per user:

```js
ShareEvent.aggregate([
  { $match: { userId } },
  { $group: { _id: '$status', coins: { $sum: '$coinsAwarded' } } },
])
// → { pending: <coins where _id==='pending'>, confirmed: <coins where _id==='confirmed'> }  (0 when absent)
```

## Backend

### 1. Expose `shareRewards` on `GET /api/wallet`

`getWallet` (`walletController.js:9`) currently returns `data: { wallet }`. Add the aggregation and return `data: { wallet, shareRewards: { pending, confirmed } }`. Import `ShareEvent`. Both the wallet and profile screens read the `['wallet']` query, so one endpoint serves both. `expired` shares are ignored (not pending, not confirmed).

### 2. Two notification types

`notificationTemplates.js` — add:
- `share_pending` → `{ title: 'Share registered ⏳', body: '{coins} CR pending — unlocks when a friend opens your link.' }`
- `share_confirmed` → `{ title: 'Your share paid off 🎉', body: 'Someone opened your shared {itemType} — {coins} CR added to your wallet.' }`

`notificationService.js` `CATEGORY` map — add both → `'cashback'` (reuse the existing pref; no schema change, so a user who muted cashback mutes these too).

Wire:
- `createShare` (`shareController.js`) — after the pending `ShareEvent` is created (and NOT on the E11000 duplicate path), fire `notify({ userId, type: 'share_pending', data: { coins: coinsPerShare } }).catch(() => {})` (best-effort; a notif failure must never fail the share).
- `confirmAndCredit` (`shareRedirectController.js`) — replace the current `notify({ type: 'wallet_credited', … })` with `notify({ userId: ev.userId, type: 'share_confirmed', data: { coins: ev.coinsAwarded, itemType: ev.itemType } }).catch(() => {})`.

Both render in the existing `NotificationsScreen` (generic title/body) and push via the existing best-effort path.

## Frontend

`api/wallet.ts` — add `shareRewards?: { pending: number; confirmed: number }` to the wallet response type.

- **Wallet screens** (`MobileWalletScreen.tsx`, `WalletScreen.tsx`): a summary block reading `shareRewards` from the `['wallet']` query — two lines/chips:
  - "Pending · {pending} CR — unlocks when friends open your links" (shown only when `pending > 0`)
  - "Earned from shares · {confirmed} CR" (shown only when `confirmed > 0`)
- **Profile screens** (`MobileProfileScreen.tsx`, `ProfileScreen.tsx`): the same two totals as small indicators near the existing coins stat.

The `['wallet']` query already invalidates after a share, so the pending total refreshes without extra wiring.

## Testing

- `buildTemplate` is pure → unit-test the two new types return the expected `{title, body}` (incl. `{coins}`/`{itemType}` interpolation).
- The `shareRewards` aggregation is a Mongo query (no harness in this repo) — verified via the app/preview, consistent with the branch.
- Frontend: `tsc --noEmit` + a preview check that the totals render and hide at 0.

## Risks / notes

- **`share_pending` fires on every share** (up to the 100/day cap) — accepted per the product decision; gated by the `cashback` pref and bounded by the cap. Revisit if it reads as noisy.
- Reusing the `cashback` pref means these share notifications can't be muted independently; acceptable until a `shares` pref is warranted.
