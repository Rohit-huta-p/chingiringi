# Chingiringi Affiliate Flow
## From User Click to Coin Redemption — Both Integration Paths

Two parallel affiliate tracks, one shared user experience. This document walks through every step from a user tapping a product link to receiving money in their UPI account.

---

## The two paths at a glance

```
                           CHINGIRINGI APP
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
        ┌─────▼─────┐                         ┌────▼────┐
        │ CUELINKS  │  ← all non-Amazon       │ AMAZON  │  ← Amazon only
        │ AGGREGATOR│    merchants            │ DIRECT  │
        └─────┬─────┘                         └────┬────┘
              │                                     │
   ┌──────────┴──────────┐                          │
   ▼          ▼          ▼                          ▼
 MYNTRA   FLIPKART    AJIO                       AMAZON
 MEESHO   NYKAA       …
```

**Why two paths:**

- **Cuelinks** covers Myntra, Flipkart, Meesho, Ajio, Nykaa and 1,000+ other Indian merchants in a single integration. They take ~20% of every commission as their fee.
- **Amazon Associates** is direct. No middleman. We register with Amazon, get our publisher tag, keep 100% of the commission Amazon pays. Best margins.

Both paths feed the SAME user experience: tap a deal, buy, earn coins, redeem for ₹.

---

# PATH A: CUELINKS (Myntra / Flipkart / Meesho / Ajio / Nykaa / etc.)

## Step 1 — Setup (one time)

We register Chingiringi at **cuelinks.com**:

- Pick our publisher type (mobile app + website)
- Submit our domain / app links for verification
- Get a **Cuelinks publisher ID** (e.g., `cuelinks-chingiringi-12345`)
- Apply to each merchant inside the Cuelinks dashboard ("offers")
- Each merchant approves us (usually 24-48 hours)

We add Cuelinks merchant URLs to our admin: every Myntra / Flipkart / etc. deal gets the Cuelinks-formatted URL pasted into the deal's `affiliateUrl` field.

## Step 2 — User clicks a deal in Chingiringi

User browses Chingiringi, taps "Shop Now" on the **"Myntra: Flat 20% Cashback"** deal.

**What happens behind the scenes:**

```
1. App calls our backend: "User U clicked deal D"
2. Backend logs a ClickEvent: { user, deal, merchant=myntra, time }
3. Backend rewrites the affiliate URL with the user's tracking tag:
   https://linksredirect.com/?...&subid=cr_<U>
4. Backend returns the rewritten URL to the app
5. App opens the URL in the browser
```

The whole round-trip takes ~200ms — invisible to the user.

## Step 3 — User lands on Myntra (via Cuelinks)

Cuelinks 302-redirects the user to Myntra. Two cookies drop:

- **Cuelinks's tracking cookie** — knows the click came from us
- **Myntra's session cookie** — tracks the user on Myntra

The user is now on Myntra's site. They browse, add items to cart, check out.

## Step 4 — User buys

User completes the purchase. Order total ₹2,000.

Myntra pays a commission to Cuelinks based on category (let's say 8% for fashion = ₹160).

**Cuelinks's report shows:**

| Field | Value |
|---|---|
| Order ID | MYN-9X8B-A4 |
| Sub-ID | cr_64f8a2b9c1d2e3f4a5b6c7d8 |
| Sale amount | ₹2,000 |
| Commission earned by Cuelinks | ₹160 |
| Cuelinks's cut (20%) | ₹32 |
| **Commission paid to us** | **₹128** |
| Status | Pending |

## Step 5 — Admin imports the Cuelinks report

Cuelinks publishes reports weekly. Admin opens the **Wallet Operations Hub** → **Reports Inbox** tab:

- Picks "Cuelinks (aggregator)" from the merchant chip selector
- Pastes the CSV from the Cuelinks dashboard
- Clicks **Parse Report**

Preview shows every row matched via the `cr_<userId>` subid. Admin clicks **Import**.

## Step 6 — Coins credited (pending for 30 days)

For each matched row, the system:

- Calculates coins owed: `commission × passThroughPercent × coinsPerRupee`
- Default: 25% pass-through, 10 coins per ₹ → for ₹128 commission, user gets **320 coins** (≈ ₹32)
- Creates a pending Transaction with a 30-day lock (matches Myntra's return window)
- Adds 320 coins to the user's wallet immediately so they SEE the pending balance

The 30-day lock matters: Myntra can cancel the order or accept a return during this window, in which case Cuelinks marks the row CANCELLED in the next report and we'd need to reverse the credit.

## Step 7 — Coins confirm after 30 days

The lock expires. The pending Transaction flips to `confirmed`. The user can now withdraw against these coins.

## Step 8 — User requests withdrawal

User opens Chingiringi, taps **Withdraw Money**, enters 320 coins. App shows them:

> Withdraw 320 coins → ₹32 to your UPI

User picks UPI, enters their VPA, confirms.

## Step 9 — Admin processes payout

The request lands in the admin's Pending Queue. Admin opens the user, sees the request at the top, transfers ₹32 from their bank app via UPI, pastes the UPI reference number, clicks **Approve & Pay**.

System debits 320 coins from the user's wallet, marks the transaction completed.

## Step 10 — Cuelinks pays us (later)

Cuelinks aggregates and pays us monthly into our bank account. **Typical timing: 45-60 days after the order's status flipped to confirmed.**

So our cash from Cuelinks arrives AFTER we already paid the user. We're floating the user's payout. (See "Working Capital" below.)

---

# PATH B: AMAZON DIRECT (Amazon Associates)

## Step 1 — Setup (one time)

We register at **affiliate-program.amazon.in**:

- Submit our app + website
- Verify ownership
- Get our **Amazon Associate Tag** (e.g., `chingiringi-21`)
- **No per-merchant approval needed** — once accepted, we can promote anything on Amazon

We need to maintain at least 3 sales every 180 days or Amazon closes the account. With Chingiringi's traffic this is trivial.

## Step 2 — User clicks an Amazon deal in Chingiringi

Same as Cuelinks — App calls backend → ClickEvent logged → URL rewritten → opened.

**The URL format is different:**

```
https://amazon.in/dp/B0XYZABC123
  ?tag=chingiringi-21
  &ascsubtag=cr_<userId>
```

- `tag` — our Amazon publisher ID (Amazon uses this to know it's us)
- `ascsubtag` — our user tracking ID (Amazon echoes this back in reports)

## Step 3 — User lands on Amazon

Amazon drops their cookie. **24-hour attribution window** — anything the user buys on Amazon within the next 24 hours is credited to us (not just the product they clicked).

User browses, buys whatever. Order total ₹1,500 (different product than the one they clicked).

## Step 4 — Amazon tracks the order

Amazon's affiliate report shows:

| Field | Value |
|---|---|
| Order ID | 405-1234567-8901234 |
| ascsubtag | cr_64f8a2b9c1d2e3f4a5b6c7d8 |
| Product | Bluetooth speaker (not what they clicked!) |
| Sale amount | ₹1,500 |
| Category | Electronics |
| Commission rate | 1% (electronics) |
| **Commission paid to us** | **₹15** |
| Status | Shipped (will confirm after return window) |

Amazon does the per-product, per-category commission math. Their commission column already reflects the right rate for the actual product purchased.

## Step 5 — Admin imports the Amazon report

Same flow as Cuelinks:

- Wallet Operations Hub → Reports Inbox
- Pick "Amazon" from the merchant chip selector
- Two ways to get the data:
  1. **Manual:** download CSV from `affiliate-program.amazon.in` dashboard, paste it
  2. **Automated (Phase 4):** Amazon Reports API daily poll — fetches yesterday's orders automatically
- Parse → Preview → Import

The same `cr_<userId>` subid matching applies. Same coin formula: `commission × passThroughPercent × coinsPerRupee`. For ₹15 commission → **37 coins** (≈ ₹3.75).

User gets a smaller reward here because Amazon paid less commission (1% on electronics). That's fair — they bought electronics, we earned less.

## Step 6-9 — Same as Cuelinks

Coins pending → 30-day lock → confirm → user requests withdrawal → admin pays out.

The user experience is identical. They don't know or care whether the order went through Cuelinks or directly to Amazon.

## Step 10 — Amazon pays us (later)

Amazon pays monthly, ~**60 days after the END of the calendar month** in which the order shipped.

- Order shipped Jan 15 → Amazon pays end of March
- Minimum payout: ₹1,000 (₹100 for direct deposit in India)
- Payment via bank transfer (NEFT)

---

# Side-by-side comparison

| Dimension | Cuelinks | Amazon Direct |
|---|---|---|
| Setup effort | 1 hour signup + per-merchant approvals | 30 min signup, no per-merchant approval |
| Merchants covered | Myntra, Flipkart, Meesho, Ajio, Nykaa, 1000+ | Amazon only |
| Commission keep rate | ~80% (they take 20%) | 100% (no middleman) |
| Typical commission % | 5-12% depending on merchant + category | 0.5-12% depending on category |
| Payout cadence | Monthly, ~45-60 days after confirmation | Monthly, ~60 days after month end |
| Minimum payout | ₹1,000 | ₹1,000 (NEFT) |
| Report format | CSV / dashboard | CSV / dashboard / **API** |
| Cookie window | Varies by merchant (7-30 days typical) | 24 hours |
| TDS implication | TDS 5% above ₹15k/year on commission | TDS 5% above ₹15k/year on commission |
| Best for | Coverage breadth, fast launch | Margin, Amazon-heavy users |

**Strategy:** use Cuelinks for the 4 non-Amazon merchants (Myntra, Flipkart, Meesho, Ajio) and Amazon directly. Best of both — broad coverage + best margins on the biggest single merchant.

---

# Money flow: worked examples

## Example 1 — Myntra fashion purchase (via Cuelinks)

```
User buys: ₹2,000 dress on Myntra
  │
  ├── Myntra commission (8% fashion):     ₹160
  │         │
  │         └── Cuelinks's cut (20%):     ₹32
  │
  ├── Commission paid to us:              ₹128
  │
  ├── User's coin reward (25% × 10):      320 coins
  │         (= ₹32 redeemable)
  │
  └── Chingiringi's net keep:             ₹96 (75% of what we earned)
```

## Example 2 — Amazon electronics purchase (direct)

```
User buys: ₹1,500 Bluetooth speaker on Amazon
  │
  ├── Amazon commission (1% electronics): ₹15
  │
  ├── Commission paid to us:              ₹15  (no middleman cut)
  │
  ├── User's coin reward (25% × 10):      37 coins
  │         (= ₹3.75 redeemable)
  │
  └── Chingiringi's net keep:             ₹11.25 (75%)
```

## Example 3 — Amazon beauty purchase (direct)

```
User buys: ₹1,000 premium skincare on Amazon
  │
  ├── Amazon commission (10% luxury beauty): ₹100
  │
  ├── Commission paid to us:                 ₹100
  │
  ├── User's coin reward (25% × 10):         250 coins
  │         (= ₹25 redeemable)
  │
  └── Chingiringi's net keep:                ₹75 (75%)
```

---

# Settlement timing — the working capital reality

```
Day 0    User clicks, buys.
Day 0    Merchant report arrives at Cuelinks/Amazon dashboard (some merchants
         take 1-7 days).
Day 7    Admin imports report → user sees +320 coins (pending).
Day 37   Lock period expires → coins confirmed.
Day 40   User requests withdrawal of 320 coins (₹32).
Day 40   Admin transfers ₹32 via UPI.
                                                    ← OUR ₹32 PAID OUT
Day 60   Cuelinks/Amazon pays us their monthly cycle.
                                                    ← WE RECEIVE OUR ₹128
```

**The float:** we pay the user on day 40 but get paid by the network on day 60. For 20 days, we're funding the user's payout from our own cash.

**Working capital required:**

At 100 daily orders × ₹50 avg commission × 25% pass-through = ₹1,250/day in user payouts. With 20-day float, we need:

- ~₹25,000 reserve at any point in time
- Scales linearly: 10,000 daily orders → ₹2.5L reserve

**Two ways to manage this:**

1. **Hold a reserve** (recommended for growth): keep 2 months of expected payouts in the bank. Cleanest UX — user gets paid the day they request it.
2. **Hold user payouts until we're paid**: don't release coins for withdrawal until the network has settled the commission. Slower UX (60-day wait) but zero float risk.

Recommend Option 1 once monthly GMV is steady. Option 2 only if cash is genuinely tight.

---

# The user experience (what THEY see)

This is the only thing the end user cares about. Both paths feel identical.

```
1. Open Chingiringi → browse deals
2. Tap "Shop Now" on a deal → land on Myntra / Amazon / etc.
3. Buy normally on that merchant's site
4. Hours later → notification: "320 coins pending — confirms in 30 days"
5. 30 days later → notification: "320 coins confirmed! Ready to withdraw"
6. Open app → tap "Withdraw Money" → enter coin amount
7. See: "Withdraw 320 coins → ₹32 to your UPI"
8. Confirm → see request status: "Processing"
9. Same day or next: ₹32 arrives in their UPI
10. Notification: "Withdrawal complete. ₹32 sent to rahul@paytm. TXN: XXX"
```

User never sees Cuelinks. Never sees Amazon Associates. Never sees commissions or pass-through rates. Just: I bought, I got coins, I got money.

---

# Admin's daily workflow

```
Morning routine (5 minutes):
  1. Open Wallet Operations → Pending Queue
  2. See: "3 withdrawals waiting · 12 lock-expired txns ready to confirm"
  3. One by one:
     - Tap a withdrawal → user page opens → transfer via UPI → paste TXN id → done
  4. Tap "Confirm All" (Phase 3) on expired lock txns

Weekly routine (15 minutes):
  1. Log into Cuelinks dashboard → download weekly CSV
  2. Wallet Ops → Reports Inbox → pick Cuelinks → paste → Import
  3. Log into Amazon Associates → download daily/weekly CSV
  4. Wallet Ops → Reports Inbox → pick Amazon → paste → Import
  5. Review unmatched rows (typically <5%) → manual assign if obvious

Monthly:
  1. Reconcile bank deposits from Cuelinks + Amazon
  2. Adjust working capital reserve if needed
```

Total admin time at 100 users: ~3 hours/week. At 10,000 users: ~10 hours/week. Linear, predictable, no per-user manual work.

---

# Edge cases

| Situation | What happens |
|---|---|
| User clicks but doesn't buy | Click logged, no row in merchant report, no coins. Click data still useful for analytics. |
| User clicks, buys, returns within 30 days | Merchant report shows REJECTED on next cycle. Admin reverses the credit. User's pending coins disappear. |
| User clicks Myntra but our subid got stripped (rare) | Row arrives without subid. Lands in Unmatched. Phase 3 click-log fallback recovers via time+amount match. |
| Two users on same WiFi click same deal | Each has their own userId in the subid → separate attribution. No problem. |
| User clears cookies between click and purchase | Lost attribution. Merchant sees no source → no commission → no row in report → no coins. Unavoidable industry-wide. |
| Cuelinks payment delayed | We've already paid the user. Float increases until next settlement. |
| Fraud (user using stolen card, charges back) | Merchant report marks REJECTED. We reverse user's pending coins. If already confirmed → admin manually debits and notes the case. |

---

# Summary

**Two integration paths, one user experience.**

| Path | Use for | Margin | Setup |
|---|---|---|---|
| Cuelinks | Myntra, Flipkart, Meesho, Ajio, Nykaa, etc. | ~80% of commission earned | 1 hour + per-merchant approvals |
| Amazon direct | Amazon (highest-volume single merchant) | 100% of commission earned | 30 min, instant |

**The economics:** at default 25% pass-through, we keep 75% of every ₹ of commission we earn. User gets coins worth 25%. That's the sustainable share.

**The cash flow:** we pay the user within days of confirmation, but the network pays us 30-60 days later. Need a working-capital reserve equal to ~2 months of expected payouts.

**The admin work:** ~3 hours per week at small scale. Scales linearly to ~10 hours per week at 10,000 users. No per-user manual entry — everything is bulk import + queue-based action.

**The user sees:** click → buy → coins land → wait 30 days → withdraw → money in UPI. Same flow for every merchant, every category, every order. They never see the plumbing.
