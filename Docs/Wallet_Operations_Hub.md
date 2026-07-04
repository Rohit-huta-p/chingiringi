# Chingiringi Wallet Operations

A unified system for crediting users from merchant reports, processing withdrawals, and giving the admin complete visibility into every user's wallet history. Built around a single-currency **coin** economy: every purchase earns coins, every withdrawal pays out the coin equivalent in ₹.

---

## The economy in one paragraph

Every product you list has a **Coins Reward** — the number of coins a user earns when they buy that product through Chingiringi. When the merchant sends a sale report, we look up which deal the user clicked, find the matching coin reward, and credit those coins to their wallet. Coins are held for 30 days while the merchant's return window runs; after that they're confirmed. When the user wants to cash out, they request a withdrawal in coins, the app shows them the rupee equivalent at the current conversion rate, and the admin processes the payout. There is no "cashback" track to manage in parallel — coins are the only currency users earn or hold.

**Default conversion: 10 coins = ₹1.** Adjustable.

---

## What changed and why

### The problem

Before this work, admin was juggling three separate screens:

- **Users screen** — block / unblock, view list
- **Withdrawals screen** — process payouts
- **No way at all** to credit users from a merchant report. Every order had to be manually re-typed into a wallet adjustment form, one user at a time.

When a report from Myntra or Cuelinks arrived with 200 orders, the admin had to:

1. Open each row in the merchant dashboard
2. Find the matching user in the Users screen
3. Manually credit them
4. Track which rows they'd already done

This took hours per report. The risk of double-crediting or missing rows entirely was high.

### The fix

**One Wallet Operations Hub** with three tabs that share a unified backend:

1. **Pending Queue** — every action waiting for the admin, in one list
2. **Reports Inbox** — paste a merchant report → auto-match users → bulk-credit in one click
3. **User Wallet** — search any user, see their complete history (every click + every transaction + every payout) on a single timeline

Daily admin work that used to take 2-3 hours per report now takes about 5 minutes per report.

---

## How users earn coins

### Step 1 — The user clicks a deal in Chingiringi

When a user taps "Shop Now" on any deal, Chingiringi does two things at once:

- Logs a **ClickEvent** in our database (which user, which deal, which merchant, when)
- Builds a tracking link with a unique tag (`cr_<userId>`) and opens the merchant's website

The user lands on Myntra (or Amazon, Flipkart, Meesho, Ajio, etc.), sees the product, and makes the purchase.

### Step 2 — The merchant report arrives, days or weeks later

Affiliate programs send reports on a daily, weekly, or monthly cycle. Each row tells us:

- Order ID
- The tracking tag we attached (`cr_<userId>`)
- Sale amount
- Commission paid to us
- Order status (confirmed, returned, cancelled)

### Step 3 — Admin imports the report in one click

Admin opens the **Reports Inbox** tab, picks the merchant, pastes the report (CSV or tab-separated), clicks **Parse Report**. The system shows a preview:

> 60 rows parsed.
> 52 will match via subid (matched).
> 6 will match via click log (medium confidence).
> 2 are unmatched (need manual assignment).
>
> Approximate coins to credit: 5,200

Admin clicks **Import**. Every matched user gets the right number of coins credited, held pending for 30 days (the merchant's return window).

### Step 4 — Coins unlock after 30 days

After the lock period, coins become confirmed and the user can request a withdrawal against them.

---

## How users withdraw

### The user side

User opens Chingiringi, taps **Withdraw Money**, enters the number of coins they want to redeem. The app shows them the rupee equivalent immediately at the current rate, e.g.:

> Withdraw 500 coins → you'll receive ₹50 to your UPI

The user picks UPI or bank transfer, confirms.

### The admin side

That withdrawal request lands in the admin's **Pending Queue**. Each row shows:

- User name + phone
- ₹500 (500 coins)
- UPI VPA or bank details
- Time since request

Admin clicks **Open** → drops into the user's wallet page. The pending withdrawal is the first thing they see, surfaced above the full timeline. Two buttons: **Approve & Pay** and **Reject**.

Admin transfers the ₹50 via UPI from their own bank app, pastes the UPI reference number into the dialog, clicks Approve & Pay. The system:

- Marks the withdrawal completed
- Records the UPI reference for audit
- Debits 500 coins from the user's wallet
- Updates the user's app — they see "Completed" with the reference

If admin rejects (insufficient KYC, suspicious activity, fraud flag), the coins stay in the user's wallet — they weren't debited until completion.

---

## What admin sees: the User Wallet timeline

The most powerful view in the system. Search any user, drop into their page, see the entire story on a single chronological timeline:

```
Rahul Sharma · +91 98765 43210 · joined 14 Jan 2026
─────────────────────────────────────────────────────────
Confirmed: ₹0    Pending: ₹0    Coins: 5,600    Lifetime: ₹1,250

[ Credit Coins ]  [ Debit Coins ]   |   [ Credit ₹ ]  [ Debit ₹ ]

─────────────────────────────────────────────────────────
PENDING WITHDRAWAL — ₹500 (5,000 coins)
UPI · rahul@paytm · requested 2 days ago
                                    [ Approve & Pay ] [ Reject ]
─────────────────────────────────────────────────────────

Wallet Timeline
─────────────────────────────────────────────────────────

 4 Apr  ✅ Confirmed   +50   Amazon · order AMZ-123
                            (lock period expired)

 5 Mar  💰 Pending     +50   Amazon · order AMZ-123
                            (locks until 4 Apr)

 5 Mar  👆 Click             Amazon · "Wireless headphones"
 4 Mar  👆 Click             Myntra · "Denim jeans"
 4 Mar  📥 Withdrawal  ₹100  Completed · UPI ref: TXN-XYZ
                            (1,000 coins debited)
─────────────────────────────────────────────────────────
```

Every event — every click, every coin credit, every withdrawal — on one scrollable list, sorted by date. Admin never has to navigate elsewhere to investigate a user's history.

---

## What admin sees: the Pending Queue

The default landing tab. Three counter cards at the top show how much work is waiting:

- **Withdrawals waiting** — orange, requires payout
- **Ready to confirm** — green, lock period expired, ready to release
- **Recent imports** — blue, audit of the last few merchant uploads

Below the counters: detailed lists of each pending withdrawal (with one-click jump to the user) and a history strip of the most recent report imports.

Admin opens the app in the morning, glances at the Pending Queue, knows exactly what to do that day.

---

## What admin sees: the Reports Inbox

The high-leverage screen. The full workflow:

1. **Pick the merchant** (Amazon / Myntra / Flipkart / Meesho / Ajio / Nykaa / Cuelinks / Admitad — chip selector)
2. **Paste the report** in the text area. CSV or tab-separated. Columns can be in any order — the system auto-detects `order_id`, `subid` (or `ascsubtag`), `amount`, `commission`, `status`
3. **Parse Report** — system reads the rows, validates the column mapping, shows a preview table
4. **Preview** — every row shown with:
   - Order ID, subid, ₹ commission, ≈ coins to credit, status
   - Green "subid ✓" pill on rows that will auto-match
   - Yellow "unmatched" pill on rows missing a recognisable subid
5. **Summary panel** above the table:
   - Total rows
   - Will match (count of green rows)
   - Unmatched (yellow)
   - Approximate coins to credit (totalled)
6. **Import** — one click bulk-credits every matched row, creates the audit record, refreshes the queue

After import, a green success card shows:

> 52 of 60 rows credited — 5,200 coins pending lock.
> 6 unmatched — Phase 3 click-log fallback will catch these.

A history list at the bottom shows every past import so admin can answer "what report credited Rahul on 5 March" months later.

---

## Setting coin rewards per deal

When admin creates or edits a deal, there's a new field:

> **Coins Reward (per purchase)** — `[      50      ]`
>
> Leave blank to fall back to system rate (commission × 10).

Two approaches available:

- **Per-deal explicit reward** — admin sets exactly how many coins each deal awards. Premium deals can give richer rewards (100 coins) than discount-heavy ones (20 coins). Useful for promotions, exclusive deals, partner tiers.
- **System-rate fallback** — if admin doesn't set a per-deal reward, the import flow uses the commission earned × 10 coins per ₹. A ₹50 commission → 500 coins. Simple, automatic, fair.

The system picks the per-deal value when it can find the matching click; falls back to the rate when it can't. Either way, the user is credited something — no order silently drops through the cracks.

---

## Audit and safety

Every action is logged.

- **Every click** stored in the ClickEvent table (user, deal, merchant, time, original URL, redirected URL, IP, device, referer). Forever.
- **Every report import** stored in the ReportImport table with the original rows + per-row outcome (matched / unmatched / failed) + the admin who imported it. Replayable if matchers ever change.
- **Every wallet adjustment** stored as a Transaction with the admin's user id, the reason, the timestamp. Full audit chain.
- **Every withdrawal** stored as a Transaction with the merchant's UPI reference number on completion. Reconciles to the bank statement.

**Safety guards built in:**

- Duplicate detection — the same merchant order ID can never be credited twice, even across multiple imports.
- Overdraft prevention — debit actions check the wallet balance before deducting. Withdrawals refuse to complete if the user's coin balance dropped below the held amount between request and approval.
- Auth required — every admin endpoint requires admin role on the access token. Non-admin users cannot reach any of these routes.

---

## The numbers

Daily admin work, before and after:

| Task | Before | After |
|---|---|---|
| Import a 60-row merchant report | 2-3 hours | 5 minutes |
| Process a single withdrawal | 5 minutes (3 screens) | 30 seconds (1 screen) |
| Investigate "where's my cashback" complaint | 15 min (search logs, query DB) | 1 minute (User Wallet timeline) |
| Discover lock-expired transactions ready to confirm | Manual SQL query | 1 click in Pending Queue |
| Audit "what reports credited this user" | Impossible without engineering | 1 click in Reports Inbox history |

**At 100 users / 20 orders per day:** ~5 hours of admin work per week, down to ~30 minutes.

**At 10,000 users / 2,000 orders per day:** the workflow scales linearly — bulk import handles 5,000 rows at a time, no manual data entry per user.

---

## What this unlocks for the business

1. **Trust** — users see their pending coins land within hours of the report arriving, not weeks. They tell their friends.
2. **Speed of cash-out** — admin can process withdrawals as fast as UPI transfers settle, because the system surfaces them and tracks them.
3. **Forensic answers** — every "where did my coins come from" or "why didn't I get coins for that order" question is answerable in 60 seconds via the User Wallet timeline.
4. **Onboarding new merchants** — adding a new affiliate partner takes 5 minutes: add the merchant chip to the Reports Inbox, set the subid parameter name. The whole pipeline works on day one.
5. **Scalable to 100k users** — none of the flows require per-user manual work. The team grows linearly with conversation volume, not with order volume.

---

## What's next: Phase 3

The 6 unmatched rows in every import (because the merchant stripped the subid, or the user clicked from someone else's device) currently land in a "needs manual assignment" bucket. Phase 3 adds smart matching with confidence scoring:

- For each unmatched row, look through the click log for clicks on the same merchant within 24 hours of the order, with a matching amount window
- Surface candidate users ranked by confidence (0-100)
- Admin reviews and confirms with one click
- Recovers an estimated 5-10% of orders that today require manual chasing

Estimated time: 3 working days. Adds significant attribution lift at no per-transaction cost.

---

## Summary

What was: three disconnected admin screens, no merchant report ingestion, every credit done by hand.

What is: one workflow hub. Paste a report, click Import, done. Open a user, see everything, act inline. Process a withdrawal in 30 seconds. Audit anything in a minute.

The system is built around how the admin actually works — user-centric, action-first — not around how the data happens to be modelled in the database. Daily-driver software, ready to take Chingiringi from 100 users to 100,000.
