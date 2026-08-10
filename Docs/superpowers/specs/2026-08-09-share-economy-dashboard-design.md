# Share-economy admin dashboard — design spec

Date: 2026-08-09
Status: approved design, pre-plan
Direction: **B · Momentum** · deltas: **real period-over-period**

## Goal

The admin dashboard was built for purchase cashback (clicks, conversions,
cashback issued). The reward model has pivoted: users now earn coins by
**sharing** products/stores (`ShareEvent`), not by buying. The dashboard must
be rebuilt around the share economy, keeping affiliate revenue as a compact
secondary strip.

Two admin screens read one endpoint, so this is **one backend rewrite + two
view rewrites + one shared chart tweak**:

- `backend/src/modules/admin/adminController.js` → `getDashboardStats`
- `chingiring-app/src/screens/Admin/MobileAdminDashboard.tsx` (phone, primary)
- `chingiring-app/src/screens/Admin/AdminDashboardScreen.tsx` (web/desktop)
- `chingiring-app/src/components/RevenueTrendChart.tsx` (generalise to any series)
- `chingiring-app/src/api/admin.ts` (types)

## Why it's needed (bug, not just cosmetics)

`conversions` and `revenueTrend` currently count **all** `coin_credit`
transactions. Share rewards now create `coin_credit` txns
(`metadata.reason: 'share'`), so both numbers are silently inflated by every
share. The rewrite fixes this by excluding `reason: 'share'` from the affiliate
"purchases" count.

## Data source

`ShareEvent { userId, itemType:'product'|'store', itemId, coinsAwarded,
day:'YYYY-MM-DD' (IST), createdAt }`. The IST `day` string bucket powers all
day-window math (no UTC drift — matches the share system's `istDayBucket`).

Wallet (`coins`, `pendingCoins`) and Transaction (`coin_credit` / `coin_debit`,
`metadata.commissionPaid`, `metadata.reason`) provide the coin ledger and
affiliate numbers. `AdminSettings.get()` provides `coinsPerRupee`.

## New payload contract

`getDashboardStats` returns `data`:

```
hero: {
  totalShares,          // all-time ShareEvent count
  sharesToday,          // count(day == today IST)
  coinsFromShares,      // Σ coinsAwarded all-time (share engine output ONLY)
  liabilityRupees,      // circulation / coinsPerRupee  (money owed)
}
cards: {                // each: { value, deltaPct }  — deltaPct signed, or null
  sharesToday,          // value vs yesterday
  shares30d,            // last 30d vs prior 30d
  uniqueSharers30d,     // distinct userId last 30d vs prior 30d
  coinsIssued30d,       // sum coinsAwarded last 30d vs prior 30d
}
coinsEconomy: { issued, redeemed, circulation }   // all-time, ALL reasons; liability lives in hero
shareTrend: [ { label, shares } x30 ]             // daily, oldest→newest, gaps filled 0
topSharers: [ { name, email, shares, coins } x5 ]
topSharedItems: [ { itemType, name, brand, shares } x5 ]
revenue: { clicks, purchases, commission }        // purchases EXCLUDES reason:'share'
```

`deltaPct` is `null` when the prior window is 0 (avoid divide-by-zero / `Infinity`);
the view renders no pill in that case — never "+0%" or "NaN".

## Metric → source → delta map

| Slot | Metric | Source | Delta basis |
|---|---|---|---|
| Hero big | Total shares (all-time) | `ShareEvent.count()` | pill shows `▲ sharesToday` (absolute, not %) |
| Hero sub | Coins from shares (all-time) | Σ `coinsAwarded` (share-only) | — |
| Hero sub | ₹ Coin liability | `circulation / coinsPerRupee` | — |
| Card | Shares today | `count(day==today)` | vs yesterday |
| Card | Shares · 30d | `count(last 30d)` | vs prior 30d |
| Card | Unique sharers · 30d | `distinct(userId, last 30d)` | vs prior 30d |
| Card | Coins issued · 30d | Σ `coinsAwarded` last 30d | vs prior 30d |
| Ledger | Issued / Redeemed / Circulating | txn sums + wallet coins | — |
| Trend | Shares/day, 30d | `$group` by `day` | — |
| Leaderboard | Top sharers | `$group` by `userId` | — |
| Leaderboard | Top shared items | `$group` by `(itemType,itemId)` → resolve names | — |
| Strip | Clicks / Purchases / Commission | ClickEvent + coin_credit (excl. share) | — |

## Backend work

1. **Day-window helpers** (reuse `istDayBucket` from `shareService.js`):
   `dayStr(offset)` = IST day N days back; window bounds as `day` string
   ranges (`$gte`/`$lt`), lexicographic on `YYYY-MM-DD`.
2. **`pctDelta(curr, prev)`** pure helper → signed % rounded to 1 dp, or `null`
   when `prev === 0`. Colocated + unit-tested.
3. **Aggregations** (all IST-`day` based): today/yesterday counts; 30d vs
   prior-30d counts; distinct sharers per window; `coinsAwarded` sums per
   window + all-time; daily trend `$group` with 30-day zero-fill.
4. **Coins economy**: keep existing coin_credit/coin_debit sums and wallet
   circulation; add `liabilityRupees = circulation / settings.coinsPerRupee`.
5. **Leaderboards**: `topSharers` via `$group`+`$lookup`(users); `topSharedItems`
   via `$group` then two batched `find`s (Product `title/brand`, Store `name`)
   mapped back by id.
6. **Affiliate strip**: `clicks = ClickEvent.count()`; `purchases =
   coin_credit count where metadata.reason != 'share'`; `commission = Σ
   metadata.commissionPaid` over those.
7. **Index**: add `ShareEvent.index({ day: 1 })` — the bare `{day}` counts
   aren't covered by the existing compound (`userId`-prefixed) indexes.

## Frontend work — Direction B (Momentum)

`MobileAdminDashboard.tsx` (primary), same visual system adapted wider on
`AdminDashboardScreen.tsx`:

- **Hero panel** — deep-indigo card: label "Total shares", big tabular number,
  green `▲ N today` pill, inline 30d sparkline, two sub-stats (coins issued,
  ₹ liability).
- **2×2 metric cards** — accent stripe per card; value + signed delta pill
  (green up / red down; hidden when `deltaPct == null`).
- **Share momentum** — area chart via the generalised `RevenueTrendChart`
  (`data: {label, value}[]`, `color` prop), emphasised end dot.
- **Top sharers** — initials-avatar rows + share count + relative bar.
- **Revenue strip** — 3-up mini cards: Clicks · Purchases · Commission.
- Keep existing empty states (fresh install → zeros / empty leaderboards).

`RevenueTrendChart` is generalised from `{revenue, conversions}` to
`{label, value}[]` + `color`; both screens are being rewritten so the prop
change is contained.

## Deleted

Clicks/Conversions/Cashback stat cards; `stats.{totalClicks,conversions,
cashbackIssued,activeUsers}` and `topDeals` (by click) and the UTC
`revenueTrend` chart shape. Clicks survive as one number in the revenue strip;
the affiliate **trend chart** is dropped for v1 (can return as a sparkline later).

## Testing

- `pctDelta`: positive, negative, `prev===0 → null`, rounding. One assert-based
  self-check (no framework).
- Day-window helper: boundary — a share bucketed "yesterday" counts in the
  prior window, not today.
- Frontend: verified in the Expo preview (no RN unit tests added).

## Risks / deploy gates

- **`coinsPerRupee` gate.** `liabilityRupees` divides by the stored
  `coinsPerRupee`. Per the share-to-earn deploy gate, an existing `AdminSettings`
  doc may still hold `10` instead of `1000` → liability reads **100× too high**.
  Same stored value gates withdrawals; fix once, both correct.
- Bare `{day}` counts need the new index or they collection-scan at volume.

## Out of scope (v1)

Affiliate revenue trend chart; per-deal click leaderboard; cap-hitter / abuse
panel; product-vs-store split as its own card (it shows inside Top shared items);
CSV export.
