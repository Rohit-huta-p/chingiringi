# Per-Product Examples
## Three real product purchases, end to end

Companion to the main Affiliate Flow doc. Three concrete examples showing exactly what happens when a specific product is bought — including the case where the user buys something different from what they clicked.

Defaults used in every example: **pass-through 25%**, **10 coins per ₹1**.

---

## Example 1 — Amazon: Sony WH-1000XM5 Headphones (₹24,990)

User clicks the exact product. They buy the exact product. Single row in the Amazon report.

### Step 1 — Admin lists the deal

Chingiringi admin adds a deal:

| Field | Value |
|---|---|
| Title | Sony WH-1000XM5 Wireless Headphones |
| Brand | Sony |
| Merchant | Amazon |
| Category | Electronics |
| Affiliate URL | `https://amazon.in/dp/B09Y2JZB8R` |
| Image | (uploaded) |

### Step 2 — Rahul Sharma taps "Shop Now"

```
App     → backend: log click (Rahul, dealId=ABC, merchant=amazon)
Backend → rewrites URL:
  https://amazon.in/dp/B09Y2JZB8R
    ?tag=chingiringi-21
    &ascsubtag=cr_64f8a2b9c1d2e3f4a5b6c7d8
Backend → returns URL to app
App     → opens URL in browser
```

Amazon drops a 24-hour cookie tied to our publisher tag.

### Step 3 — Rahul buys the headphones

Order placed. Total ₹24,990. Category = Electronics. Amazon's commission rate for electronics = 1%.

**Amazon's affiliate report (24 hours later):**

| Field | Value |
|---|---|
| Order ID | 405-1234567-8901234 |
| ascsubtag | cr_64f8a2b9c1d2e3f4a5b6c7d8 |
| Product | Sony WH-1000XM5 |
| ASIN | B09Y2JZB8R |
| Sale amount | ₹24,990 |
| Category | Electronics |
| Commission rate | 1% |
| **Commission to us** | **₹249.90** |
| Status | Pending (lock period running) |

### Step 4 — Admin imports the Amazon report

Wallet Operations Hub → Reports Inbox → Amazon → paste CSV → Import.

System computes Rahul's coins:

```
coins = ₹249.90 × 0.25 × 10 = 624 coins (rounded)
```

### Step 5 — Rahul's wallet

```
Notification: "+624 coins pending from Sony WH-1000XM5 — confirms in 30 days"

Wallet:
  Coins: 624 (pending)
  Confirmed: 0
```

### Step 6 — After 30 days

Status flips to confirmed. Rahul can withdraw.

### Step 7 — Withdrawal

Rahul opens app → Withdraw Money → enters 624 coins.

```
App shows: "Withdraw 624 coins → ₹62.40 to your UPI"
```

(Rahul actually gets ₹62.40 because we round at credit time, not at withdrawal time.)

Rahul confirms → request goes to admin → admin transfers ₹62.40 via UPI → pastes TXN id → 624 coins debited.

### Final tally for one product

```
Product:                Sony WH-1000XM5 Wireless Headphones
Sale value:             ₹24,990
Amazon commission:      ₹249.90 (1% electronics rate)
User's reward:          624 coins = ₹62.40 (25% pass-through)
Chingiringi's keep:     ₹187.50 (75%)
```

---

## Example 2 — Myntra via Cuelinks: Levi's 511 Slim Fit Jeans (₹2,799)

Same flow but through the Cuelinks aggregator. Cuelinks takes their cut before paying us.

### Step 1 — Admin lists the deal

| Field | Value |
|---|---|
| Title | Levi's 511 Slim Fit Jeans |
| Brand | Levi's |
| Merchant | Myntra |
| Category | Fashion |
| Affiliate URL | `https://linksredirect.com/?cid=12345&source=linkkit&url=https%3A%2F%2Fwww.myntra.com%2Fjeans%2Flevis%2Flevis-men-511-slim-fit-jeans%2F12345` |

### Step 2 — Priya Patel taps "Shop Now"

```
Backend → rewrites URL with subid:
  https://linksredirect.com/?cid=12345&source=linkkit
    &url=...
    &subid=cr_64f9c3e0a1b2c3d4e5f6a7b8
Browser → Cuelinks → 302 to Myntra
```

Two cookies drop: Cuelinks's tracking cookie + Myntra's session cookie.

### Step 3 — Priya buys the jeans

Order placed. Total ₹2,799. Category = Fashion on Myntra. Myntra's commission rate = 8%.

**Cuelinks's report (weekly cycle):**

| Field | Value |
|---|---|
| Order ID | MYN-9X8B-A4 |
| Sub-ID | cr_64f9c3e0a1b2c3d4e5f6a7b8 |
| Product | Levi's 511 Slim Fit Jeans |
| Sale amount | ₹2,799 |
| Category | Fashion |
| Commission rate | 8% |
| Commission Cuelinks earned from Myntra | ₹223.92 |
| Cuelinks's cut (20%) | ₹44.78 |
| **Commission paid to us** | **₹179.14** |
| Status | Pending |

### Step 4 — Admin imports the Cuelinks report

Wallet Operations Hub → Reports Inbox → Cuelinks → paste → Import.

```
coins = ₹179.14 × 0.25 × 10 = 448 coins
```

### Step 5 — Priya's wallet

```
+448 coins pending from Levi's 511 Slim Fit Jeans — confirms in 30 days
```

### Step 6-7 — Lock expires, Priya withdraws 448 coins → ₹44.80 to UPI.

### Final tally

```
Product:                Levi's 511 Slim Fit Jeans
Sale value:             ₹2,799
Myntra commission:      ₹223.92 (8% fashion)
Cuelinks's cut (20%):   ₹44.78
Commission to us:       ₹179.14
User's reward:          448 coins = ₹44.80 (25% pass-through)
Chingiringi's keep:     ₹134.34 (75% of what we received)
```

Notice: the user gets ~₹44.80 on a ₹2,799 fashion order = **1.6% effective cashback**. They don't see this number — they see "448 coins = ₹44.80". But it scales with the merchant's commission rate.

---

## Example 3 — The "bought something else" scenario (most important)

This is the case the simple per-deal model breaks on. **Real users do this all the time.**

### What happens

Rahul taps the Sony headphones deal on Chingiringi. Amazon opens. Rahul looks at the headphones, decides they're too expensive, and instead buys three other things in the same session:

1. **Mamaearth Onion Hair Oil** — ₹399 (Beauty)
2. **Boat Airdopes 141** — ₹1,099 (Electronics)
3. **Levi's Polo T-Shirt** — ₹999 (Fashion)

He never buys the headphones he clicked.

### What Amazon's report shows

Three separate rows under the same `ascsubtag = cr_<Rahul>`:

| Order ID | Product | Sale ₹ | Category | Rate | Commission to us |
|---|---|---|---|---|---|
| 405-A | Mamaearth Onion Hair Oil | 399 | Beauty | 10% | ₹39.90 |
| 405-B | Boat Airdopes 141 | 1,099 | Electronics | 1% | ₹10.99 |
| 405-C | Levi's Polo T-Shirt | 999 | Fashion | 8% | ₹79.92 |

Each row is its own commission, calculated per Amazon's per-category rate.

### What our importer does

For each row, the formula runs independently:

```
Row 1 (hair oil):    ₹39.90  × 0.25 × 10 = 100 coins
Row 2 (earbuds):     ₹10.99  × 0.25 × 10 =  27 coins
Row 3 (polo):        ₹79.92  × 0.25 × 10 = 200 coins

Total credited to Rahul: 327 coins (≈ ₹32.70)
```

### What Rahul sees

```
Notification: "+327 coins pending from your Amazon order"

Wallet Timeline (after import):
─────────────────────────────────────────────
+ 100 coins  Amazon · Mamaearth Onion Hair Oil  · pending
+  27 coins  Amazon · Boat Airdopes 141         · pending
+ 200 coins  Amazon · Levi's Polo T-Shirt       · pending
─────────────────────────────────────────────
```

Three separate transactions. Each linked to its own product. Each will confirm independently 30 days later (or get reversed if Rahul returns just one item).

### Why this matters

**Per-deal `coinsReward` would fail here.** Rahul never bought the deal he clicked. The Sony headphones deal has `coinsReward: 200` set by admin. If we used that:

- Wrong product attribution
- Wrong amount (200 coins instead of 327)
- Couldn't handle the multi-row case at all

**The commission-based formula handles it correctly.** Amazon computed the per-product, per-category commission. We just split it 25/75 with the user. The user gets credit for what they ACTUALLY bought, not what we promoted.

### Final tally

```
What Rahul clicked:        Sony WH-1000XM5 (didn't buy)
What Rahul actually bought: 3 different items in same Amazon session
Total commissions to us:    ₹130.81
User's reward:              327 coins = ₹32.70 (25%)
Chingiringi's keep:         ₹98.11 (75%)
Admin work:                 0 — automatic per-row from import
```

---

## Summary — why the commission-based model is right

Three scenarios. One formula. Works in all of them.

| Scenario | Old (per-deal) | New (commission-based) |
|---|---|---|
| Bought exact product clicked | Works | Works |
| Bought different product, same merchant | **Wrong amount** | Works |
| Bought multiple products from one click | **Wrong count, wrong amount** | Works |

The merchant's commission column is the source of truth. We let them do the per-product, per-category math. We give the user a fair slice. Simple, scalable, accurate.
