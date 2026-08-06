# Product Detail Page Redesign — Design Spec

**Date:** 2026-08-06
**Screens:** `ProductDetailScreen.tsx` (desktop) + `MobileProductDetailScreen.tsx` (mobile), product mode only.
**Mockups:** three directions explored (A Earn-First / B Deal-Hunter Trust / C Social Share-Loop). Chosen: **B skeleton, share-only earning**.

## Goal

The product detail page currently reads like a bare mini-store: image → title → price → one paragraph → reviews. Chingiringi is a **share-to-earn + affiliate engine**, and the page is too sparse to (a) convert the affiliate buy or (b) fuel the share loop. This redesign adds scannable product content and a clean purchase path, without inventing data the backend doesn't have.

## Decisions (locked)

1. **Direction:** B (Deal-Hunter Trust). Purchase-first, matches existing "Direction A" code.
2. **Earning:** keep the existing **Share & Earn 100 CR** hook only. No separate Rewards panel, **no review reward, no buy-cashback** (neither is wired; would overpromise).
3. **MRP:** add an `mrp` field to Product so savings/strikethrough/off-badge are real.
4. **Share card (from Direction C, grafted into B):** gradient card with **real "🔥 N shared today"** count (new tiny endpoint), a **decorative anonymized avatar cluster** (colored initials, explicitly NOT real users), the framing line "Your friends get the deal. You get 100 CR.", and the existing **Share & Earn 100 CR** action. Degrades to framing + button when the count is too low to be good social proof.
5. **About + Highlights:** keep the **About** container (description as prose). **Highlights** bullets are derived from newline-separated lines in the same `description` — one field, no new schema. (No separate `highlights[]` field.)

## Honesty constraints (things NOT to render)

- **Never show a ₹ value for CR.** `coinsPerRupee = 1000` → 100 CR ≈ ₹0.10, not ₹100. Show "+100 CR" only.
- **No "lowest price in Nd"** — no price history stored. Out of scope.
- **No fabricated returns/warranty claims** per merchant. Merchant card states only what's true: redirect + secure checkout.
- **Rating-breakdown bars** are computed from *loaded in-app reviews only* and labeled as such; skipped when < 3 reviews.

## Scope — block inventory

Data source and target screens for each block. "Both" = desktop + mobile product mode.

| # | Block | Source | Backend? | Screens |
|---|-------|--------|----------|---------|
| 1 | Price + `mrp` strikethrough + "You save ₹X (Y%)" + "Y% off" badge | new `mrp` field; `discount = round((mrp-price)/mrp*100)` | **field only** | Both |
| 2 | Merchant trust card — "Sold by {merchant} · secure checkout on {merchant}" | `merchant` + `affiliateUrl` | no | Both |
| 3 | About (prose) + Highlights (bullets) | single `description`: prose paragraph → About; newline lines → Highlights bullets | no | Both |
| 4 | Ratings & Reviews: keep avg + count + cards; add breakdown bars | reviews API + client-side distribution from loaded reviews | no | Both |
| 5 | "You may also like" | `productsAPI.getProducts({category, limit})`, filter current id | no (new query) | Both |
| 6 | Breadcrumb (Home › Category › Name) | route/product | no | Desktop |
| 7 | Sticky buy bar (price + Buy + Share always visible) | existing | no | Desktop (mobile already has it) |
| 8 | Trust badges (verified merchant · secure checkout · earn on share) | static/honest | no | Both |
| 9 | **Share card** — "🔥 N shared today" + anon avatar cluster + "Your friends get the deal. You get 100 CR." + Share & Earn button | new `GET /api/shares/stats` (count) + existing ShareSheet flow | **tiny endpoint** | Both |

Kept as-is: Buy Now (affiliate), Share & Earn 100 CR CTA + quota helper, ShareSheet, WriteReviewModal, gallery/carousel.

## Backend change (small)

- `productModel.js`: add `mrp: { type: Number, default: 0, min: 0 }`. Controller already spreads `req.body`, so no controller edit.
- `shares`: add `GET /api/shares/stats?itemType=product&itemId=X` → `{ todayCount }` via `ShareEvent.countDocuments({ itemType, itemId, day })`, reusing the existing IST `day` bucket. Same auth as other share routes.
- `api/products.ts`: add `mrp?: number` to `Product`.
- `api/shares.ts`: add `getStats(itemType, itemId)`.
- Admin: add an **MRP** number input to `AdminProductsScreen.tsx` + `MobileAdminProducts.tsx` (next to price).

## Out of scope

Review reward, buy-cashback, Rewards panel, `coinsPrice` redemption, price history / lowest-price, **live share-activity feed** (the scrolling "Priya earned…" list — only the count card ships), deal-mode layout (unchanged).

## File touchpoints

- `backend/src/modules/products/productModel.js` — `mrp` field.
- `chingiring-app/src/api/products.ts` — `mrp?` on type.
- `chingiring-app/src/screens/Admin/AdminProductsScreen.tsx`, `MobileAdminProducts.tsx` — MRP input.
- `chingiring-app/src/screens/Dashboard/ProductDetailScreen.tsx` — desktop product panel: price block, merchant card, highlights, trust badges, breadcrumb, sticky bar, review bars, similar grid.
- `chingiring-app/src/screens/Dashboard/MobileProductDetailScreen.tsx` — mobile product view: same blocks, condensed; sticky CTA kept.
- Small shared helpers: `splitHighlights(description)`, `ratingDistribution(reviews)`, `discountFrom(mrp, price)` — colocated, not a new lib.

## Risks / notes

- Highlights depend on admins entering line-separated descriptions; single-paragraph descriptions fall back to the About block (no empty highlights).
- Rating bars are approximate (loaded reviews only) — acceptable, labeled.
- `mrp` back-compat: existing HomeScreen template items pass `oldPrice`/`discount`; read `mrp ?? oldPrice` and prefer computed discount so both shapes work.
- Similar-products query adds one request per detail view; cache via react-query key `['products', category]`.

## Verification

- Backend: `mrp` accepted on create/update; product GET returns it.
- Desktop + mobile: with `mrp > price` → strikethrough + savings + badge render; with `mrp` unset → clean single price (no NaN/0%).
- Multi-line description → bullets; single paragraph → About only.
- Similar grid excludes current product; empty category → block hidden.
- No ₹-equivalent of CR anywhere.
