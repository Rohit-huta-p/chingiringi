# Offline Stores — Design Spec

**Date:** 2026-07-20
**Status:** Draft for review
**Build target:** Tier 1 (foundation). Tiers 2–3 designed here so the data model doesn't need rework later.

---

## 1. Context & problem

The user-facing **Offline Stores** screen ([`chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx`](../../../chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx)) is entirely static — it reads a hardcoded `MOCK_STORES` array from [`chingiring-app/src/data/offlineStores.ts`](../../../chingiring-app/src/data/offlineStores.ts). There is no backend `stores` module and no admin surface to manage stores.

This maps to the PRD's **QR / offline merchant network** (FR-038 QR Merchant Management, FR-020 QR Scanning), which is documented as **Missing**. However, the actual business model the founder described **supersedes** the PRD's "scan-to-earn-coins" framing:

> Chingiringi ties up with physical stores. When a user buys at a partner store, they **pay through the Chingiringi app**. The money lands in **Chingiringi's account** (not the store's). The user gets an **instant discount at checkout**. Chingiringi keeps its commission and **settles the store later** for its share, per the agreed deal.

So "Offline Stores" is an **in-app payment + merchant-settlement platform**, with Chingiringi as merchant-of-record for offline purchases — not a coins directory.

## 2. Goals / non-goals

**Goals**
- Real, admin-managed offline store directory backing the existing user screen.
- A data model that captures each store's **commercial deal** (discount + commission) and supports the eventual payment + settlement flow.
- Reuse the codebase's proven full-stack CRUD pattern (Deals/Products) and existing infra (Razorpay, wallet, transactions, `ImageUploader`).

**Non-goals (this build / Tier 1)**
- Live in-app payment collection (Tier 2).
- Settlement ledger and payouts (Tier 3).
- Self-service merchant onboarding / approval queue (deferred; admin creates stores directly).
- No coins or post-pay cashback for offline — **the reward is the instant discount, full stop.**

## 3. Reward & settlement model (decided)

**Instant discount at checkout.** Two admin-configurable knobs per store:

- `userDiscountPercent` (`d`) — what the user saves; the only term ever exposed publicly.
- `platformCommissionPercent` (`c`) — Chingiringi's margin; **admin-only, never sent to the client.**

Worked example — ₹1,000 bill, `d`=8%, `c`=5%:

| Party | Amount | Formula |
|---|---|---|
| User pays | ₹920 | `bill × (1 − d)` |
| Chingiringi keeps | ₹50 | `bill × c` |
| Store settled (later) | ₹870 | `collected − bill × c` = `bill × (1 − d − c)` |
| User saved | ₹80 | `bill × d` |

The store bears `d + c`; the user gets `d`; the platform gets `c`. Each offline purchase is one ledger row (Tier 2); rows roll up into per-store settlements (Tier 3).

**Guardrails** stored per store: `maxDiscountCap` (₹ ceiling on a single discount), `minBillAmount`.

## 4. Data model

### 4.1 `Store` (new Mongo model — mirrors `dealModel.js`)

```
Store {
  // ── Profile ───────────────────────────────
  name:          String  (required)
  shortName:     String  (required)   // shown on map pill
  slug:          String  (unique)
  category:      String  (enum: StoreCategory — the existing 8 values, verbatim)
  description:   String
  logoUrl:       String
  images:        [String]
  phone:         String

  // ── Location ──────────────────────────────
  address:       String  (required)
  area:          String
  city:          String  (default 'Bengaluru')
  location:      { type: 'Point', coordinates: [lng, lat] }   // 2dsphere index
  lat:           Number  (required)    // kept flat too, for the existing card/map
  lng:           Number  (required)

  // ── Hours ─────────────────────────────────
  opensAt:       String   // "9:30 AM"
  closesAt:      String   // "9:00 PM"
  openDays:      [Number]  // 0–6; empty = all week
  // isOpen is COMPUTED from opensAt/closesAt/openDays at read time
  //   (+ optional manual `forceClosed` override).
  forceClosed:   Boolean (default false)

  // ── Deal terms (ADMIN-ONLY — stripped from public responses) ──
  userDiscountPercent:       Number (required, 0–100)
  platformCommissionPercent: Number (required, 0–100)
  maxDiscountCap:            Number (default 0 = no cap)
  minBillAmount:            Number (default 0)
  settlementCycle:          String (enum: 'weekly'|'monthly', default 'monthly')
  payoutAccount:            { method, upiId, bankName, accountLast4, ... }  // admin-only

  // ── Flags ─────────────────────────────────
  isActive:      Boolean (default true)
  isFeatured:    Boolean (default false)   // → "Hottest" badge on the card
  isVerified:    Boolean (default false)

  // ── Denormalized stats (filled in Tier 3; default 0) ──
  rating:        Number (default 0)
  reviewsCount:  Number (default 0)
  totalGmv:      Number (default 0)
  totalTxns:     Number (default 0)

  timestamps: true
}
```

Indexes: `slug` (unique), `category`, `city`, `isActive`, `location` (2dsphere), text index on `name`/`address`.

**`StoreCategory`** is the existing enum — no change, no `Category` ref, no picker:
`Fashion | Electronics | Grocery | Food & Cafe | Health | Jewellery | Sports | Beauty`.

### 4.2 Public vs admin projection

- **Public** (`GET /api/stores`): profile + location + hours + computed `isOpen` + `isFeatured` + `rating`/`reviewsCount` + **`discountPercent`** (alias of `userDiscountPercent`). **Never** `platformCommissionPercent`, `payoutAccount`, or stats.
- **Admin** (`GET /api/admin/stores`): full document.

### 4.3 Field mapping to the existing mock (minimal user-screen churn)

| Mock `Store` field | Backend source |
|---|---|
| `id` | `_id` |
| `name`, `shortName`, `category`, `address`, `lat`, `lng`, `opensAt`, `rating` | same |
| `reviews` | `reviewsCount` |
| `isOpen` | computed |
| `isHottest` | `isFeatured` |
| `coins`, `cashbackPercent` | **removed** → replaced by `discountPercent` |
| `distanceKm` | computed client-side from user geolocation vs `lat`/`lng` (fallback: hidden / "Near" sort disabled when no location) |
| `imageUrl` | `logoUrl` (or `images[0]`) |

## 5. Backend module (`backend/src/modules/stores/`)

Mirrors `deals` structure and middleware.

- `storeModel.js` — schema above.
- `storeController.js` — `getStores` (filters: `category`, `search`, `near=lat,lng`, `open`, pagination), `getStore`, `createStore`, `updateStore`, `deleteStore`. Public getters use the public projection.
- `storeRoutes.js`:
  - Public: `GET /`, `GET /:id`
  - Admin (`protect` + `admin`): `POST /`, `PUT /:id`, `DELETE /:id`
- Register in `backend/src/app.js` (`/api/stores`) and add the admin list route `GET /api/admin/stores` in the admin module (matching how `getDeals`/`getProducts` are exposed under `/api/admin`).
- Seed script `backend/src/scripts/seedStores.js` porting the 8 mock stores (+ plausible `userDiscountPercent`/`platformCommissionPercent`) so the screen has data immediately.

## 6. Admin UI (`chingiring-app/src/screens/Admin/`)

Same shape as [`AdminDealsScreen.tsx`](../../../chingiring-app/src/screens/Admin/AdminDealsScreen.tsx):

- `AdminStoresScreen.tsx` — desktop table (Store | Category | Discount | Commission | Status | Actions) + stats row (Total / Active / Featured) + search + Add button.
- `MobileAdminStores.tsx` — mobile list variant (matches the other `MobileAdmin*` screens).
- `StoreFormModal` — grouped sections: **Profile** (name, shortName, category-as-plain-select from the enum, description, phone, `ImageUploader` for logo + images) · **Location** (address, area, city, lat, lng) · **Hours** (opensAt, closesAt, openDays) · **Deal terms** (userDiscountPercent, platformCommissionPercent, maxDiscountCap, minBillAmount, settlementCycle, payoutAccount) · **Flags** (isActive, isFeatured, isVerified).

Wiring:
- `chingiring-app/src/api/stores.ts` — typed `Store` interface + `storesAPI.list/get`.
- Extend `chingiring-app/src/api/admin.ts` with `getStores/createStore/updateStore/deleteStore`.
- Register `AdminStores` in [`AdminNavigator.tsx`](../../../chingiring-app/src/navigation/AdminNavigator.tsx), `DesktopAdminDrawer.tsx`, and the drawer menu list.

## 7. User screen wiring

In [`OfflineStoresScreen.tsx`](../../../chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx):
- Replace `MOCK_STORES` with `storesAPI.list()` via `@tanstack/react-query` (loading + empty states).
- `StoreMap` is unchanged (consumes `lat`/`lng`).
- Store card: swap the **coins** badge for a **discount** badge (e.g. "8% OFF"); the map marker's `cashbackPercent` variant uses `discountPercent`.
- Keep `data/offlineStores.ts` only for the `StoreCategory` enum, `STORE_CATEGORIES`, and `CATEGORY_COLOR` (delete `MOCK_STORES` once seeded, or keep behind a dev flag).
- `distanceKm`: compute from device geolocation when available; otherwise hide the distance chip and fall back the "Near" sort to featured/rating.

## 8. Tier 2 — In-app pay loop (designed, not built now)

Flow: user opens a store → enters bill amount → **store cashier confirms the amount** (prevents under-reporting) → app computes discounted total → Razorpay collects into Chingiringi's account → `StoreTransaction` recorded → store sees a success confirmation.

- New `StoreTransaction` model (distinct from affiliate `clicks`): `store`, `user`, `billAmount`, `discountPercent`, `discountAmount`, `amountCollected`, `commissionAmount`, `storeNetAmount`, `razorpayPaymentId`, `status`, `settlementId?`, timestamps.
- Fraud guards: enforce `maxDiscountCap` / `minBillAmount`, per-user-per-store cooldown, store-side confirmation, server-recomputed amounts (never trust client totals).
- Screens: `StorePaymentScreen` (user), store-confirmation surface.

## 9. Tier 3 — Settlement & payouts (designed)

- `Settlement` model: aggregates unsettled `StoreTransaction`s per store per `settlementCycle` → `grossCollected`, `commissionTotal`, `amountOwed`, `status`, `payoutRef`, `paidAt`.
- Admin **Settlements** screen: owed-per-store, mark paid / Razorpay payout, reconciliation.
- Per-store performance view: GMV, txn count, unique users (backfills the denormalized stats).

## 10. Open questions (non-blocking for Tier 1)

- Exact `platformCommissionPercent` semantics if a store also wants a flat per-txn fee — deferred.
- Whether `payoutAccount` is captured now (Tier 1) or at first settlement (Tier 3). Spec captures the field now; making it required is a Tier-3 concern.
- Multi-city expansion (`city` field is present; the user screen currently hardcodes "Bengaluru").

## 11. Tier 1 build order

1. Backend `stores` module (model, controller, routes) + register + seed script.
2. `stores.ts` API client + `adminAPI` store methods.
3. `AdminStoresScreen` + `MobileAdminStores` + `StoreFormModal`; register in navigators/drawer.
4. Wire `OfflineStoresScreen` to `storesAPI.list()`; discount badge; remove `MOCK_STORES` usage.
5. Verify end-to-end (admin create → appears on user screen).
