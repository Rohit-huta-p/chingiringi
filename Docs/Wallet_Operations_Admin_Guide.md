# Wallet Operations Hub
## Admin Reference Guide

Single admin screen at **`/admin/wallet-ops`** that consolidates every coin and cashback action into one workflow. Replaces the separate Users + Withdrawals + Categories screens. Four tabs, one backend hub.

---

## Tab 1 — Pending Queue (default)

*"What needs my action right now?"*

**Three counter cards at the top:**

- **Withdrawals waiting** — users who requested payout, admin hasn't paid yet
- **Ready to confirm** — pending coin credits whose 30-day lock has expired (the hourly cron auto-flips these)
- **Recent imports** — last 5 merchant reports ingested

Below the counters: full list of pending withdrawals with an **Open** button that jumps straight to that user's timeline.

Backend endpoint: `GET /api/admin/queue`.

---

## Tab 2 — Reports Inbox

*"Import a merchant report and credit coins in one click."*

### Workflow

1. Pick the merchant chip: Amazon, Myntra, Flipkart, Meesho, Ajio, Nykaa, Cuelinks, Admitad
2. Paste CSV or TSV from the affiliate dashboard
3. Click **Parse Report** — auto-detects columns (`order_id`, `subid` or `ascsubtag`, `amount`, `commission`, `status`) with hard-coded fallbacks for the exact Cuelinks and Amazon Associates header names
4. Preview shows every row with match indicators (green *subid ✓* or yellow *unmatched*) plus estimated coins per row using the live pass-through formula
5. Click **Import** — server runs `coins = commission × passThroughPercent × coinsPerRupee` per row, creates pending `coin_credit` transactions, adds to `pendingCoins`
6. Success card shows totals; past imports are listed below for audit

### Attribution logic

- **Primary:** extract userId from the `cr_<userId>` subid pattern (100% confidence)
- **Deal promo override:** if the click log finds a matching Deal with `coinsReward > 0`, use that flat reward instead
- **Fallback:** no valid subid → look through click log for the last 48h on the same merchant, credit if exactly one distinct user matches (medium confidence 70)

Backend endpoints: `POST /api/admin/reports/import` and `GET /api/admin/reports/imports`.

---

## Tab 3 — User Wallet

*"Search any user, see the whole story, act inline."*

**Left pane:** search box (name / phone / email).

**Right pane** on user select:

- Identity card: name, phone, joined date
- Four stat tiles: **Confirmed ₹ · Pending ₹ · Coins · Lifetime ₹**
- Four action buttons: **Credit Coins / Debit Coins** (primary economy) plus **Credit ₹ / Debit ₹** (goodwill refunds)
- If user has a pending withdrawal, it surfaces above the timeline with two buttons:
  - **Approve & Pay** — prompts for the UPI TXN id, debits coins, marks the withdrawal complete
  - **Reject** — no debit, coins stay in the user's balance
- **Wallet Timeline** — interleaved clicks + transactions, newest first, color-coded by status. Every click, every credit, every debit, every withdrawal shows up on one scrollable list

Backend endpoint: `GET /api/admin/users/:id/timeline` returns clicks + transactions merged and sorted.

---

## Tab 4 — Settings

*"Tune the coin economy."*

**Five fields:**

- **Pass-through %** — the slice of every ₹ of commission that goes to the user as coins (default 25%)
- **Coins per ₹1** — the conversion rate at both credit AND redemption (default 10)
- **Lock period days** — how long pending coins wait before confirming (default 30)
- **Cuelinks publisher ID** — stamped into every Cuelinks-toggled deal's URL at click time
- **Amazon associate tag** — auto-appended to every Amazon URL at click time

**Live preview card** recalculates as you type:

> ₹1000 order at 5% commission → user gets X coins (≈ ₹Y), we keep ₹Z

Backend endpoints: `GET /api/admin/settings` and `PATCH /api/admin/settings`. Singleton doc so there is exactly one source of truth for the whole economy.

---

## The end-to-end flow at a glance

```
User taps Shop Now
    ↓
Backend logs ClickEvent + rewrites URL with subid
(plus Amazon tag / Cuelinks wrapper if applicable)
    ↓
User buys on merchant (external)
    ↓
Merchant → Cuelinks / Amazon report (days later)
    ↓
Admin: Reports Inbox → paste CSV → Parse → Import
    ↓
For each row: match user via subid → credit coins to pendingCoins
→ create pending Transaction
    ↓
Lock period passes (Phase D cron, hourly): pending → confirmed,
pendingCoins → coins
    ↓
User requests withdrawal (mobile Withdraw Sheet in the wallet screen)
    ↓
Admin: Pending Queue → Open → Approve & Pay → paste UPI TXN id
    ↓
Coins debited, user's app shows Completed
```

Every step is observable from the same hub. No context switching between screens.

---

## Cheat sheet: which tab for which task

| Task | Tab |
|---|---|
| See what needs action today | Pending Queue |
| Credit users after a merchant report arrives | Reports Inbox |
| Handle a specific user's complaint / manual credit / withdrawal | User Wallet |
| Change pass-through %, coin rate, or merchant credentials | Settings |
| Audit "which report credited user X" | Reports Inbox → history list |
| Confirm the URL is going out with the right tag / subid | Test in-app + inspect URL, then Settings if wrong |
| Reverse a mistaken import | User Wallet → find user → Debit Coins with a note |

---

## Access

`/admin/wallet-ops` on the admin site. Admin role required on your account. No sub-routes — everything is tab-scoped within the same screen.
