# Product Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weak `$text` search with Atlas Search (fuzzy + prefix + relevance), add search-as-you-type, and turn zero-result searches into merchant chip fallbacks + a demand log instead of dead ends.

**Architecture:** A pure `buildSearchPipeline()` function in `searchPipeline.js` builds the Atlas `$search`-first aggregation; `getProducts` wraps it with the fire-and-forget demand log upsert and near-miss re-query. A `MerchantSearchStrip` component sits at the bottom of every search results page; zero-result searches also surface near-misses. All merchant fallback clicks reuse the existing `logClick` endpoint (explicit `url` path). An admin screen lists queries by count so the team knows what to stock.

**Tech Stack:** MongoDB Atlas Search (compound query, autocomplete, fuzzy), Mongoose, Express, React Native, React Query, Lucide icons.

---

## ⚠️ DEPLOY GATE — Atlas Search Index (do this first, before Task 2 ships)

Create an Atlas Search index named **`products`** on the `products` collection in the Atlas console (Cluster → Search → Create Index → JSON editor). The existing `$text` Mongoose index is **kept** — it is the fallback path when Atlas Search is unavailable.

**Index definition:**
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": [
        {
          "type": "autocomplete",
          "analyzer": "lucene.standard",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15
        },
        { "type": "string" }
      ],
      "description": { "type": "string" },
      "category":    { "type": "string" },
      "merchant":    { "type": "string" },
      "isActive":    { "type": "boolean" }
    }
  }
}
```

Index build takes 1–5 minutes on a free tier. Confirm status is **Active** before shipping Task 2.

---

## Global Constraints

- `$search` must be the first pipeline stage — never move it
- `isActive: true` filter goes in `$search compound.filter` (not `$match`) when Atlas Search is active
- Demand log upsert is always fire-and-forget — `.catch(() => {})`, never awaited
- Near-miss re-query runs server-side inside `getProducts`, not as a second client call; result returned as `data.nearMisses`
- No cashback promise on merchant fallback chips — copy is "Not stocked yet — search on:"
- Merchant URL map lives in `subidBuilder.js`; app only sends `{ merchant, searchQuery }` to `logClick`
- Follow existing test pattern: `try/catch` with graceful skip when `ECONNREFUSED` or `MongoNotConnected`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `backend/src/modules/products/searchPipeline.js` | Pure `buildSearchPipeline()` — no I/O |
| **Create** | `backend/src/modules/search/searchQueryModel.js` | `SearchQuery` Mongoose model |
| **Create** | `backend/src/__tests__/searchPipeline.test.js` | Unit tests for `buildSearchPipeline` |
| **Create** | `backend/src/__tests__/merchantSearchUrl.test.js` | Unit tests for `buildMerchantSearchUrl` |
| **Create** | `backend/src/__tests__/searchDemandLog.test.js` | Integration test for demand log |
| **Create** | `chingiring-app/src/components/MerchantSearchStrip.tsx` | Merchant chip strip component |
| **Create** | `chingiring-app/src/screens/Admin/MobileAdminSearchQueries.tsx` | Admin demand log screen |
| **Modify** | `backend/src/modules/products/productController.js` | Wire Atlas Search + near-miss + demand log |
| **Modify** | `backend/src/modules/clicks/subidBuilder.js` | Add `buildMerchantSearchUrl()` |
| **Modify** | `backend/src/modules/clicks/clickController.js` | Handle `{ merchant, searchQuery }` fallback |
| **Modify** | `backend/src/modules/admin/adminController.js` | Add `getSearchQueries` |
| **Modify** | `backend/src/modules/admin/adminRoutes.js` | `GET /admin/search-queries` |
| **Modify** | `chingiring-app/src/api/clicks.ts` | Add `merchant?` + `searchQuery?` to `LogClickPayload` |
| **Modify** | `chingiring-app/src/api/admin.ts` | Add `getSearchQueries` |
| **Modify** | `chingiring-app/src/screens/Dashboard/CategoryProductsScreen.tsx` | Debounce + cascade + strip |
| **Modify** | `chingiring-app/src/components/MobileAdminNav.tsx` | Add `AdminSearchQueries` to `ADMIN_NAV_ITEMS` |
| **Modify** | `chingiring-app/src/navigation/AdminNavigator.tsx` | Register `AdminSearchQueries` tab |

---

## Task 1: `buildSearchPipeline()` — pure function, fully tested

**Files:**
- Create: `backend/src/modules/products/searchPipeline.js`
- Create: `backend/src/__tests__/searchPipeline.test.js`

**Interfaces:**
- Produces: `buildSearchPipeline(opts) → stage[]` (consumed by Task 2)

```
opts shape:
{
  search?: string,           // free-text; if absent, no $search stage
  category?: string,         // exact match
  minPrice?: number,         // inclusive
  maxPrice?: number,
  minCoins?: number,
  maxCoins?: number,
  minRating?: number,
  minDiscount?: number,      // % (0 = off)
  featured?: boolean,
  sort?: string | null,      // key from SORT_MAP; null = default
  page: number,
  limit: number,
}
```

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/searchPipeline.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import { buildSearchPipeline } from '../modules/products/searchPipeline.js';

describe('buildSearchPipeline', () => {
  it('has $search as first stage when search is present', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    expect(Object.keys(p[0])[0]).toBe('$search');
  });

  it('has NO $search stage when search is absent', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    expect(p.some(s => s.$search)).toBe(false);
  });

  it('has isActive:true in $match (not in Atlas filter) when search is absent', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    expect(p[0].$match?.isActive).toBe(true);
  });

  it('puts $match AFTER $search when both are present', () => {
    const p = buildSearchPipeline({ search: 'shoe', category: 'Footwear', page: 1, limit: 12 });
    const keys = p.map(s => Object.keys(s)[0]);
    expect(keys.indexOf('$search')).toBe(0);
    expect(keys.indexOf('$match')).toBeGreaterThan(0);
  });

  it('includes category filter in $match', () => {
    const p = buildSearchPipeline({ search: 'shoe', category: 'Footwear', page: 1, limit: 12 });
    const m = p.find(s => s.$match?.category);
    expect(m.$match.category).toEqual({ $regex: '^Footwear$', $options: 'i' });
  });

  it('includes price range in $match', () => {
    const p = buildSearchPipeline({ minPrice: 100, maxPrice: 500, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.price);
    expect(m.$match.price).toEqual({ $gte: 100, $lte: 500 });
  });

  it('includes minCoins filter in $match', () => {
    const p = buildSearchPipeline({ minCoins: 500, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.coinsPrice);
    expect(m.$match.coinsPrice.$gte).toBe(500);
  });

  it('includes minRating filter in $match', () => {
    const p = buildSearchPipeline({ minRating: 4, page: 1, limit: 12 });
    const m = p.find(s => s.$match?.rating);
    expect(m.$match.rating).toEqual({ $gte: 4 });
  });

  it('has minDiscount $match AFTER $addFields', () => {
    const p = buildSearchPipeline({ minDiscount: 20, page: 1, limit: 12 });
    const keys = p.map(s => Object.keys(s)[0]);
    const af = keys.indexOf('$addFields');
    // second $match (discount) comes after $addFields
    const discountMatch = p.findIndex((s, i) => i > af && s.$match?._discount);
    expect(discountMatch).toBeGreaterThan(af);
  });

  it('omits $sort when search is present and sort is null/undefined', () => {
    const p = buildSearchPipeline({ search: 'shoe', sort: null, page: 1, limit: 12 });
    expect(p.some(s => s.$sort)).toBe(false);
  });

  it('includes $sort with price:1 when sort=price_asc', () => {
    const p = buildSearchPipeline({ search: 'shoe', sort: 'price_asc', page: 1, limit: 12 });
    const s = p.find(st => st.$sort);
    expect(s.$sort.price).toBe(1);
  });

  it('includes $sort newest by default when no search', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    const s = p.find(st => st.$sort);
    expect(s.$sort.createdAt).toBe(-1);
  });

  it('Atlas compound has autocomplete with boost 5 and fuzzy maxEdits 1 on name', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const ac = compound.should.find(c => c.autocomplete?.path === 'name');
    expect(ac.autocomplete.fuzzy.maxEdits).toBe(1);
    expect(ac.autocomplete.score.boost.value).toBe(5);
  });

  it('Atlas compound has text on name with boost 3 and fuzzy maxEdits 2', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const txt = compound.should.find(c => c.text?.path === 'name');
    expect(txt.text.fuzzy.maxEdits).toBe(2);
    expect(txt.text.score.boost.value).toBe(3);
  });

  it('Atlas compound filter has isActive:true equals clause', () => {
    const p = buildSearchPipeline({ search: 'shoe', page: 1, limit: 12 });
    const { compound } = p[0].$search;
    const activeFilter = compound.filter.find(f => f.equals?.path === 'isActive');
    expect(activeFilter.equals.value).toBe(true);
  });

  it('last stage is $facet with products and total', () => {
    const p = buildSearchPipeline({ page: 1, limit: 12 });
    const last = p[p.length - 1];
    expect(last.$facet).toHaveProperty('products');
    expect(last.$facet).toHaveProperty('total');
  });

  it('$facet products has correct $skip for page 3, limit 24', () => {
    const p = buildSearchPipeline({ page: 3, limit: 24 });
    const facet = p[p.length - 1].$facet;
    const skip = facet.products.find(s => s.$skip !== undefined);
    expect(skip.$skip).toBe(48); // (3-1)*24
  });

  it('$facet products has $limit matching the limit param', () => {
    const p = buildSearchPipeline({ page: 1, limit: 6 });
    const facet = p[p.length - 1].$facet;
    const lim = facet.products.find(s => s.$limit !== undefined);
    expect(lim.$limit).toBe(6);
  });

  it('index name is "products"', () => {
    const p = buildSearchPipeline({ search: 'x', page: 1, limit: 12 });
    expect(p[0].$search.index).toBe('products');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/searchPipeline.test.js --no-coverage
```
Expected: multiple failures with "Cannot find module".

- [ ] **Step 3: Implement `searchPipeline.js`**

Create `backend/src/modules/products/searchPipeline.js`:

```js
/**
 * Pure pipeline builder for product search.
 * No I/O — all logic is testable without a DB connection.
 * Consumed by getProducts in productController.js.
 */

const SORT_MAP = {
  price_asc:    { price: 1 },
  price_desc:   { price: -1 },
  newest:       { createdAt: -1 },
  best:         { sold: -1 },
  discount:     { _discount: -1 },
  '-createdAt': { createdAt: -1 },
};

// Discount % = (mrp − price)/mrp × 100; 0 when mrp unset or not above price.
const DISCOUNT_EXPR = {
  $cond: [
    { $and: [{ $gt: ['$mrp', 0] }, { $gt: ['$mrp', '$price'] }] },
    { $multiply: [{ $divide: [{ $subtract: ['$mrp', '$price'] }, '$mrp'] }, 100] },
    0,
  ],
};

/**
 * Build a MongoDB aggregation pipeline for product listing + search.
 *
 * When `search` is present the pipeline starts with an Atlas `$search` stage
 * (index "products") and isActive is filtered there. When absent, a plain
 * `$match: { isActive: true }` handles it. Either way the rest of the filters,
 * sort, and $facet follow.
 *
 * @param {Object} opts
 * @param {string}  [opts.search]       Free-text query
 * @param {string}  [opts.category]     Exact category (case-insensitive)
 * @param {number}  [opts.minPrice]
 * @param {number}  [opts.maxPrice]
 * @param {number}  [opts.minCoins]
 * @param {number}  [opts.maxCoins]
 * @param {number}  [opts.minRating]
 * @param {number}  [opts.minDiscount]  Minimum discount % (0 = off)
 * @param {boolean} [opts.featured]     isFeatured filter
 * @param {string|null} [opts.sort]     Key from SORT_MAP; null/undefined = default
 * @param {number}  opts.page           1-based
 * @param {number}  opts.limit
 * @returns {Array} Aggregation pipeline stages
 */
export function buildSearchPipeline({
  search,
  category,
  minPrice, maxPrice,
  minCoins, maxCoins,
  minRating,
  minDiscount,
  featured,
  sort,
  page = 1,
  limit = 12,
}) {
  const pipeline = [];

  // ── Stage 1: Atlas Search (only when search term is present) ──────────────
  if (search) {
    pipeline.push({
      $search: {
        index: 'products',
        compound: {
          minimumShouldMatch: 1,
          filter: [
            // isActive inside the Atlas filter so the engine can skip non-active docs
            { equals: { path: 'isActive', value: true } },
          ],
          should: [
            {
              // Prefix / edge-ngram — catches "headph" → Headphones
              autocomplete: {
                query: search,
                path: 'name',
                fuzzy: { maxEdits: 1 },
                score: { boost: { value: 5 } },
              },
            },
            {
              // Whole-word fuzzy — catches "bluetoth" → Bluetooth
              text: {
                query: search,
                path: 'name',
                fuzzy: { maxEdits: 2 },
                score: { boost: { value: 3 } },
              },
            },
            {
              // Broad recall on other fields (lower rank)
              text: {
                query: search,
                path: ['description', 'category', 'merchant'],
                fuzzy: { maxEdits: 1 },
                score: { boost: { value: 1 } },
              },
            },
          ],
        },
      },
    });
  }

  // ── Stage 2: $match — remaining filters ──────────────────────────────────
  // isActive is already handled by Atlas filter when search is present.
  const match = search ? {} : { isActive: true };
  if (category) match.category = { $regex: `^${category}$`, $options: 'i' };
  if (featured) match.isFeatured = true;

  const priceRange = {};
  if (minPrice !== undefined) priceRange.$gte = minPrice;
  if (maxPrice !== undefined) priceRange.$lte = maxPrice;
  if (Object.keys(priceRange).length) match.price = priceRange;

  const coinsRange = {};
  if (minCoins !== undefined) coinsRange.$gte = minCoins;
  if (maxCoins !== undefined) coinsRange.$lte = maxCoins;
  if (Object.keys(coinsRange).length) match.coinsPrice = coinsRange;

  if (minRating !== undefined) match.rating = { $gte: minRating };

  if (Object.keys(match).length) {
    pipeline.push({ $match: match });
  }

  // ── Stage 3: computed discount field ─────────────────────────────────────
  pipeline.push({ $addFields: { _discount: DISCOUNT_EXPR } });

  if (minDiscount !== undefined && minDiscount > 0) {
    pipeline.push({ $match: { _discount: { $gte: minDiscount } } });
  }

  // ── Stage 4: sort ─────────────────────────────────────────────────────────
  // When searching without an explicit sort, omit $sort — Atlas already returns
  // documents in descending relevance order and we preserve that.
  if (!search || sort) {
    const sortKey = sort || 'newest';
    pipeline.push({ $sort: { ...(SORT_MAP[sortKey] || SORT_MAP.newest), _id: 1 } });
  }

  // ── Stage 5: paginate via $facet ──────────────────────────────────────────
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = Math.max(1, Number(limit) || 12);
  pipeline.push({
    $facet: {
      products: [
        { $skip: (pageN - 1) * limitN },
        { $limit: limitN },
        { $project: { _discount: 0 } },
      ],
      total: [{ $count: 'count' }],
    },
  });

  return pipeline;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/searchPipeline.test.js --no-coverage
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/products/searchPipeline.js src/__tests__/searchPipeline.test.js
git commit -m "feat(search): buildSearchPipeline — pure Atlas Search pipeline builder"
```

---

## Task 2: Wire `getProducts` to Atlas Search + near-miss

**Files:**
- Modify: `backend/src/modules/products/productController.js`

**Interfaces:**
- Consumes: `buildSearchPipeline(opts) → stage[]` from Task 1
- Produces: `GET /api/products` response now includes `data.nearMisses: Product[]`
  (empty array when `total > 0` or no `search` term)

- [ ] **Step 1: Read the current `getProducts` implementation**

Open `backend/src/modules/products/productController.js`. The function starts at line 7.
The current pipeline build (lines 26–79) will be replaced. Keep `getAllProductsAdmin` unchanged.

- [ ] **Step 2: Replace `getProducts` with the Atlas-Search wired version**

Replace the entire `getProducts` function (lines 7–96) with:

```js
import { buildSearchPipeline } from './searchPipeline.js';
// (add this import at the top of the file alongside the existing Product import)
```

Replace the function body:

```js
export const getProducts = async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    search,
    featured,
    sort = null,          // null → relevance when searching, newest otherwise
    minPrice,
    maxPrice,
    minCoins,
    maxCoins,
    minRating,
    minDiscount,
  } = req.query;

  const num = (v) => (v === undefined || v === '' ? undefined : Number(v));

  const opts = {
    search: search?.trim() || undefined,
    category: category || undefined,
    featured: featured === 'true',
    sort: sort || null,
    minPrice:    num(minPrice),
    maxPrice:    num(maxPrice),
    minCoins:    num(minCoins),
    maxCoins:    num(maxCoins),
    minRating:   num(minRating),
    minDiscount: num(minDiscount),
    page:  Math.max(1, Number(page) || 1),
    limit: Math.max(1, Number(limit) || 12),
  };

  const pipeline = buildSearchPipeline(opts);

  let result;
  try {
    [result] = await Product.aggregate(pipeline);
  } catch (err) {
    // Atlas Search index missing or unavailable — degrade to $text search.
    // The $text index is kept on the schema specifically for this fallback.
    if (opts.search && err.message?.includes('$search')) {
      console.error('[search] Atlas Search unavailable, degrading to $text:', err.message);
      const degradedOpts = { ...opts, search: undefined };
      const degradedPipeline = buildSearchPipeline(degradedOpts);
      // Add $text match manually at the front
      const textMatch = { isActive: true, $text: { $search: opts.search } };
      degradedPipeline.unshift({ $match: textMatch });
      [result] = await Product.aggregate(degradedPipeline);
    } else {
      throw err;
    }
  }

  const products = result?.products ?? [];
  const total    = result?.total?.[0]?.count ?? 0;

  // Near-miss: if the filtered search returned nothing, run the same Atlas query
  // WITHOUT the non-search filters (drop category, price, coins, rating, discount).
  // Returns up to 6 products so the user sees something instead of a blank page.
  // Runs server-side in the same request — no second round-trip from the client.
  let nearMisses = [];
  if (total === 0 && opts.search) {
    try {
      const nearPipeline = buildSearchPipeline({
        search: opts.search,
        sort: null,     // relevance order
        page: 1,
        limit: 6,
        // intentionally no category / price / coins / rating / discount
      });
      const [nearResult] = await Product.aggregate(nearPipeline);
      nearMisses = nearResult?.products ?? [];
    } catch {
      // near-miss failure is non-fatal; empty array is fine
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      products,
      nearMisses,
      pagination: {
        page:  opts.page,
        limit: opts.limit,
        total,
        pages: Math.ceil(total / opts.limit),
      },
    },
  });
};
```

- [ ] **Step 3: Add `buildSearchPipeline` import at the top of `productController.js`**

At line 1, after `import Product from './productModel.js';`, add:

```js
import { buildSearchPipeline } from './searchPipeline.js';
```

- [ ] **Step 4: Smoke test against the real cluster**

Start the backend:
```bash
cd backend && npm run dev
```
Run these curls and verify non-empty results each time:

```bash
# Should return Bluetooth products (full-word fuzzy)
curl "http://localhost:5000/api/products?search=bluetoth" | jq '.data.pagination'

# Should return Headphone products (prefix autocomplete)
curl "http://localhost:5000/api/products?search=headph" | jq '.data.products[0].name'

# Name match should appear before description-only match
curl "http://localhost:5000/api/products?search=samsung" | jq '.data.products[0].name'

# Filters still work with search
curl "http://localhost:5000/api/products?search=shoe&maxPrice=500" | jq '.data.pagination.total'

# Near-miss: impossible search + category filter → nearMisses non-empty
curl "http://localhost:5000/api/products?search=shoe&category=Electronics" | jq '.data.nearMisses | length'
```

If `bluetoth` / `headph` return 0, the Atlas index is not yet active. Wait and retry.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/products/productController.js
git commit -m "feat(search): wire getProducts to Atlas Search with near-miss fallback"
```

---

## Task 3: `SearchQuery` model + demand-log upsert

**Files:**
- Create: `backend/src/modules/search/searchQueryModel.js`
- Modify: `backend/src/modules/products/productController.js` (3-line addition)
- Create: `backend/src/__tests__/searchDemandLog.test.js`

**Interfaces:**
- Produces: `SearchQuery` collection (consumed by Task 5's admin endpoint)
- Schema: `{ q: String (unique, normalized), count: Number, lastResultCount: Number, lastSeenAt: Date }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/searchDemandLog.test.js`:

```js
import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

// Integration test — requires a real MongoDB connection.
// Gracefully skipped when MongoDB is not available.
describe('Demand log', () => {
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });

  it('GET /api/products does not 500 when search is present', async () => {
    try {
      const res = await request(app).get('/api/products?search=demandlogtest');
      expect(res.status).toBe(200);
      // nearMisses key must be present (even if empty array)
      expect(res.body.data).toHaveProperty('nearMisses');
      expect(Array.isArray(res.body.data.nearMisses)).toBe(true);
    } catch (e) {
      if (
        e.message?.includes('ECONNREFUSED') ||
        e.message?.includes('MongoNotConnected') ||
        e.message?.includes('buffering timed out')
      ) {
        console.warn('Skipping: MongoDB not connected');
        return;
      }
      throw e;
    }
  });
});
```

- [ ] **Step 2: Run test — expect it to fail (nearMisses key missing)**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/searchDemandLog.test.js --no-coverage
```

Expected: fails because `data.nearMisses` doesn't exist yet (Task 2 should already be done; if it is, this test passes — move on).

- [ ] **Step 3: Create the `SearchQuery` model**

Create `backend/src/modules/search/searchQueryModel.js`:

```js
import mongoose from 'mongoose';

/**
 * Stores every unique normalized search query with an occurrence count.
 * All searches are logged (not just misses). lastResultCount = 0 marks a true
 * miss — filter for it in the admin screen to see what to stock next.
 *
 * q is normalized before storage: lowercased, trimmed, whitespace collapsed.
 * This collapses "Bluetooth ", "bluetooth", "BLUETOOTH" into one row.
 *
 * No userId stored — the aggregate is the point; per-user search history is a
 * privacy liability with no use here.
 */
const searchQuerySchema = new mongoose.Schema(
  {
    q:               { type: String, required: true, trim: true, unique: true },
    count:           { type: Number, default: 1, min: 0 },
    lastResultCount: { type: Number, default: 0, min: 0 },
    lastSeenAt:      { type: Date,   default: Date.now },
  },
  { timestamps: false },
);

searchQuerySchema.index({ count: -1 });

export default mongoose.model('SearchQuery', searchQuerySchema);
```

- [ ] **Step 4: Add the demand-log upsert to `getProducts`**

In `backend/src/modules/products/productController.js`, add the import at the top alongside the other imports:

```js
import SearchQuery from '../search/searchQueryModel.js';
```

Then, immediately after the `nearMisses` block (before `res.status(200).json`), add:

```js
  // Demand log — fire-and-forget. A failure here must never affect the response.
  if (opts.search) {
    const q = opts.search.toLowerCase().replace(/\s+/g, ' ').trim();
    SearchQuery.findOneAndUpdate(
      { q },
      { $inc: { count: 1 }, $set: { lastResultCount: total, lastSeenAt: new Date() } },
      { upsert: true, new: false },
    ).catch(() => {});
  }
```

- [ ] **Step 5: Run test — expect it to pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/searchDemandLog.test.js --no-coverage
```

- [ ] **Step 6: Verify in Atlas (optional manual check)**

After running a few searches, check the `searchqueries` collection in Atlas or Compass. Each unique normalized query should have a row with `count ≥ 1` and `lastResultCount` equal to the number of products returned.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/modules/search/searchQueryModel.js src/modules/products/productController.js src/__tests__/searchDemandLog.test.js
git commit -m "feat(search): SearchQuery demand log — fire-and-forget upsert on every search"
```

---

## Task 4: Merchant search URLs + `logClick` fallback

**Files:**
- Modify: `backend/src/modules/clicks/subidBuilder.js`
- Modify: `backend/src/modules/clicks/clickController.js`
- Create: `backend/src/__tests__/merchantSearchUrl.test.js`

**Interfaces:**
- Produces: `buildMerchantSearchUrl(merchant, searchQuery) → string | null`
- Produces: `POST /api/clicks/log` accepts `{ merchant, searchQuery }` with no `dealId`/`productId`/`url`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/merchantSearchUrl.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import { buildMerchantSearchUrl } from '../modules/clicks/subidBuilder.js';

describe('buildMerchantSearchUrl', () => {
  it('returns amazon search URL with encoded query', () => {
    const url = buildMerchantSearchUrl('amazon', 'bluetooth headphones');
    expect(url).toBe('https://www.amazon.in/s?k=bluetooth%20headphones');
  });

  it('returns flipkart search URL', () => {
    const url = buildMerchantSearchUrl('flipkart', 'running shoes');
    expect(url).toBe('https://www.flipkart.com/search?q=running%20shoes');
  });

  it('returns myntra URL with slug path and rawQuery param', () => {
    const url = buildMerchantSearchUrl('myntra', 'casual shirts');
    expect(url).toContain('https://www.myntra.com/casual-shirts');
    expect(url).toContain('rawQuery=casual%20shirts');
  });

  it('myntra slug strips non-alphanumeric chars', () => {
    const url = buildMerchantSearchUrl('myntra', "men's t-shirts!");
    // slug: "mens tshirts" → "mens-tshirts"
    expect(url).toContain('/mens-tshirts');
  });

  it('returns meesho search URL', () => {
    const url = buildMerchantSearchUrl('meesho', 'kurti');
    expect(url).toBe('https://www.meesho.com/search?q=kurti');
  });

  it('returns null for unknown merchant', () => {
    const url = buildMerchantSearchUrl('unknown_store', 'shoe');
    expect(url).toBeNull();
  });

  it('trims whitespace from searchQuery', () => {
    const url = buildMerchantSearchUrl('amazon', '  shoes  ');
    expect(url).toBe('https://www.amazon.in/s?k=shoes');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/merchantSearchUrl.test.js --no-coverage
```

Expected: fail with "buildMerchantSearchUrl is not exported".

- [ ] **Step 3: Add `buildMerchantSearchUrl` to `subidBuilder.js`**

Append to `backend/src/modules/clicks/subidBuilder.js` (after the existing `wrapCuelinks` function):

```js
// ── Merchant search URL builders ──────────────────────────────────────────────
// Called server-side at click time for search-fallback chips. The app sends
// { merchant, searchQuery } and the server builds the URL here so a merchant
// URL format change is a backend deploy, not an app store release.

function myntraSlug(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')   // strip punctuation
    .replace(/\s+/g, '-')          // spaces → hyphens
    .trim();
}

const MERCHANT_SEARCH_BUILDERS = {
  amazon:   (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  myntra:   (q) => `https://www.myntra.com/${myntraSlug(q)}?rawQuery=${encodeURIComponent(q)}`,
  meesho:   (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
};

/**
 * Build the search-results URL for a merchant given a query string.
 * Returns null for unknown merchants — caller should 400.
 */
export function buildMerchantSearchUrl(merchant, searchQuery) {
  const builder = MERCHANT_SEARCH_BUILDERS[merchant];
  if (!builder) return null;
  return builder(searchQuery.trim());
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/merchantSearchUrl.test.js --no-coverage
```

- [ ] **Step 5: Wire the fallback path in `clickController.js`**

In `backend/src/modules/clicks/clickController.js`, add `buildMerchantSearchUrl` to the existing import:

```js
import { detectMerchant, appendSubid, ensureAmazonTag, wrapCuelinks, buildMerchantSearchUrl } from './subidBuilder.js';
```

In `logClick`, after the block that resolves `productId` (around line 56, just before the `if (!originalUrl)` guard), add a new branch for merchant fallback:

```js
  // Merchant fallback search: no product/deal/url, but merchant + searchQuery provided.
  // Build the search URL server-side so merchant URL changes are backend deploys.
  let isFallbackSearch = false;
  if (!originalUrl && req.body.merchant && req.body.searchQuery) {
    const rawUrl = buildMerchantSearchUrl(req.body.merchant, req.body.searchQuery);
    if (!rawUrl) {
      res.status(400);
      throw new Error(`Unknown merchant for fallback search: ${req.body.merchant}`);
    }
    originalUrl = rawUrl;
    isFallbackSearch = true;
  }
```

Then, after the existing Cuelinks wrap block (`if (dealDoc?.viaCuelinks ...)`), add the fallback Cuelinks wrap:

```js
  // Non-Amazon fallback search clicks earn via Cuelinks (no direct affiliate
  // program for Flipkart/Myntra/Meesho). Amazon earns via the associate tag above.
  if (isFallbackSearch && rawMerchant !== 'amazon' && settings.cuelinksPublisherId) {
    preparedUrl = wrapCuelinks(preparedUrl, settings.cuelinksPublisherId);
  }
```

Note: `rawMerchant` is already set before this point (`const rawMerchant = detectMerchant(preparedUrl);` at line ~70).

- [ ] **Step 6: Smoke test the fallback endpoint**

```bash
cd backend && npm run dev
# In another terminal:
curl -s -X POST http://localhost:5000/api/clicks/log \
  -H "Content-Type: application/json" \
  -d '{"merchant":"amazon","searchQuery":"bluetooth headphones","source":"search_fallback"}' \
  | jq '.data.redirectUrl'
# Should return an amazon.in/s?k=bluetooth+headphones URL with ascsubtag appended

curl -s -X POST http://localhost:5000/api/clicks/log \
  -H "Content-Type: application/json" \
  -d '{"merchant":"unknown","searchQuery":"shoe","source":"search_fallback"}' \
  | jq '.status'
# Should return 400
```

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/modules/clicks/subidBuilder.js src/modules/clicks/clickController.js src/__tests__/merchantSearchUrl.test.js
git commit -m "feat(search): merchant fallback URLs — buildMerchantSearchUrl + logClick fallback path"
```

---

## Task 5: Admin search-queries endpoint

**Files:**
- Modify: `backend/src/modules/admin/adminController.js`
- Modify: `backend/src/modules/admin/adminRoutes.js`

**Interfaces:**
- Produces: `GET /api/admin/search-queries?page=1&limit=50&missesOnly=true`
- Response: `{ status: 'success', data: { items: SearchQueryRow[], total, page, pages } }`
- `SearchQueryRow`: `{ q, count, lastResultCount, lastSeenAt }`

- [ ] **Step 1: Write the failing test**

Add to `backend/src/__tests__/adminDashboard.route.test.js`:

```js
  it('GET /api/admin/search-queries requires auth', async () => {
    const res = await request(app).get('/api/admin/search-queries');
    expect([401, 403]).toContain(res.statusCode);
  });
```

- [ ] **Step 2: Run test — expect failure (404 not 401/403)**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/adminDashboard.route.test.js --no-coverage
```

Expected: new test fails because the route doesn't exist yet (returns 404).

- [ ] **Step 3: Add `SearchQuery` import and `getSearchQueries` to `adminController.js`**

Add import alongside the existing model imports at the top of `backend/src/modules/admin/adminController.js`:

```js
import SearchQuery from '../search/searchQueryModel.js';
```

Append this function at the end of the file:

```js
// @desc    List search queries sorted by hit count (demand log)
// @route   GET /api/admin/search-queries
// @access  Private/Admin
export const getSearchQueries = async (req, res) => {
  const page       = Math.max(1, parseInt(req.query.page)  || 1);
  const limit      = Math.max(1, Math.min(200, parseInt(req.query.limit) || 50));
  const missesOnly = req.query.missesOnly === 'true';

  const query = missesOnly ? { lastResultCount: 0 } : {};

  const [items, total] = await Promise.all([
    SearchQuery.find(query)
      .sort({ count: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SearchQuery.countDocuments(query),
  ]);

  res.json({
    status: 'success',
    data: { items, total, page, pages: Math.ceil(total / limit) },
  });
};
```

- [ ] **Step 4: Register the route in `adminRoutes.js`**

Add `getSearchQueries` to the existing import from `adminController.js`:

```js
import { getDashboardStats, getUsers, getAllDeals, getSearchQueries } from './adminController.js';
```

Add the route after the existing `GET /products` route:

```js
router.get('/search-queries', getSearchQueries);
```

- [ ] **Step 5: Run test — expect it to pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest src/__tests__/adminDashboard.route.test.js --no-coverage
```

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/admin/adminController.js src/modules/admin/adminRoutes.js src/__tests__/adminDashboard.route.test.js
git commit -m "feat(search): admin GET /search-queries endpoint — demand log with missesOnly filter"
```

---

## Task 6: Frontend — `LogClickPayload` update + `MerchantSearchStrip` component

**Files:**
- Modify: `chingiring-app/src/api/clicks.ts`
- Create: `chingiring-app/src/components/MerchantSearchStrip.tsx`

**Interfaces:**
- Consumes: `clicksAPI.log({ merchant, searchQuery, source })` — same `log()` function
- Produces: `<MerchantSearchStrip searchQuery={string} title?: string />` — used in Task 7

- [ ] **Step 1: Add `merchant` and `searchQuery` to `LogClickPayload`**

In `chingiring-app/src/api/clicks.ts`, update the interface:

```ts
export interface LogClickPayload {
  dealId?: string;
  productId?: string;
  url?: string;
  source?: string;
  merchant?: string;      // for merchant fallback search chips
  searchQuery?: string;   // for merchant fallback search chips
}
```

No other changes needed — `clicksAPI.log()` already passes the payload body as-is.

- [ ] **Step 2: Create `MerchantSearchStrip.tsx`**

Create `chingiring-app/src/components/MerchantSearchStrip.tsx`:

```tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { clicksAPI } from '../api/clicks';

const MERCHANTS: { key: string; label: string }[] = [
  { key: 'amazon',   label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'myntra',   label: 'Myntra' },
  { key: 'meesho',   label: 'Meesho' },
];

interface Props {
  searchQuery: string;
  /** Defaults to "Not stocked yet — search on:" */
  title?: string;
}

/**
 * Row of merchant chips that deep-link into each merchant's search results
 * for the given query. The click is logged through the existing subid-rewrite
 * pipeline so Chingiringi earns the affiliate commission.
 *
 * Rendered at the bottom of every search results page and prominently inside
 * zero-result states.
 */
export function MerchantSearchStrip({ searchQuery, title }: Props) {
  if (!searchQuery.trim()) return null;

  const openMerchant = async (merchant: string) => {
    try {
      const { redirectUrl } = await clicksAPI.log({
        merchant,
        searchQuery: searchQuery.trim(),
        source: 'search_fallback',
      });
      await Linking.openURL(redirectUrl);
    } catch {
      // Click log failed — no raw URL to fall back to since the server builds it.
      // Silently no-op; the user stays on the current screen.
    }
  };

  return (
    <View style={st.wrap}>
      <Text style={st.title}>{title ?? 'Not stocked yet — search on:'}</Text>
      <View style={st.chips}>
        {MERCHANTS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={st.chip}
            onPress={() => openMerchant(m.key)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Search ${m.label} for ${searchQuery}`}
          >
            <ShoppingBag size={13} color={Colors.primary} strokeWidth={2} />
            <Text style={st.chipLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight10,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
});
```

- [ ] **Step 3: Commit**

```bash
cd chingiring-app && git add src/api/clicks.ts src/components/MerchantSearchStrip.tsx
git commit -m "feat(search): MerchantSearchStrip component + LogClickPayload merchant fields"
```

---

## Task 7: `CategoryProductsScreen` — debounce + zero-result cascade + merchant strip

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/CategoryProductsScreen.tsx`

**Interfaces:**
- Consumes: `data.nearMisses` from `getProducts` (Task 2)
- Consumes: `<MerchantSearchStrip>` (Task 6)
- The screen already has `search` state; we add a 250ms debounce on `searchInput` to drive it

- [ ] **Step 1: Read the file before editing**

Open `chingiring-app/src/screens/Dashboard/CategoryProductsScreen.tsx`. The parts we touch:
- Imports block (line 1–24)
- State block (line 51–52, the `searchInput` and `search` state lines)
- The `useInfiniteQuery` result destructuring (line 80–83)
- The empty-state JSX branch (line 137–141)
- The `FlatList` `ListFooterComponent` (line 162–166)
- The `StyleSheet` at the bottom

- [ ] **Step 2: Add imports**

Add to the import block (after the `useNavigation` import):

```tsx
import { useEffect } from 'react';
import { MerchantSearchStrip } from '../../components/MerchantSearchStrip';
```

`useEffect` is from React — ensure `React, { useState }` on line 1 becomes `React, { useState, useEffect }`.

- [ ] **Step 3: Add the debounce effect**

After the existing `const [search, setSearch] = useState(routeSearch);` line, add:

```tsx
  // Debounce live search — fire 250ms after the user stops typing.
  // onSubmitEditing still calls setSearch immediately for keyboard-submit.
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearch('');
      return;
    }
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);
```

- [ ] **Step 4: Read `nearMisses` from the query result**

After the existing line:
```tsx
const total: number = (data?.pages?.[0] as any)?.data?.pagination?.total ?? 0;
```

Add:
```tsx
  const nearMisses: Product[] = (data?.pages?.[0] as any)?.data?.nearMisses ?? [];
```

- [ ] **Step 5: Replace the zero-result JSX branch**

Find this block (lines 137–141):
```tsx
      ) : products.length === 0 ? (
        <View style={s.centre}>
          <Text style={s.emptyTitle}>No products found</Text>
          <Text style={s.emptySub}>Nothing matches your search or filters.</Text>
        </View>
```

Replace with:
```tsx
      ) : products.length === 0 ? (
        <FlatList
          // key must encode BOTH cols and whether nearMisses are present.
          // React Native forbids changing numColumns without remounting.
          key={nearMisses.length > 0 ? `empty-grid-${cols}` : 'empty-no-grid'}
          data={nearMisses}
          keyExtractor={(p) => p._id}
          numColumns={nearMisses.length > 0 ? cols : 1}
          columnWrapperStyle={
            nearMisses.length > 0
              ? { gap: GAP, paddingHorizontal: H_PAD }
              : undefined
          }
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <View style={s.centre}>
              <Text style={s.emptyTitle}>No products found</Text>
              {search && nearMisses.length > 0 ? (
                <Text style={s.emptySub}>No exact match — closest in store:</Text>
              ) : (
                <Text style={s.emptySub}>Nothing matches your search or filters.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} width={cardW} onPress={() => handleProductPress(item)} />
          )}
          ListFooterComponent={
            search ? <MerchantSearchStrip searchQuery={search} /> : <View style={{ height: 40 }} />
          }
          showsVerticalScrollIndicator={false}
        />
```

- [ ] **Step 6: Add `MerchantSearchStrip` to the normal results footer**

Find the existing non-empty `FlatList`'s `ListFooterComponent` (around line 162):
```tsx
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />
            ) : (
              <View style={{ height: 40 }} />
            )
          }
```

Replace with:
```tsx
          ListFooterComponent={
            <>
              {isFetchingNextPage ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />
              ) : null}
              {search && !hasNextPage ? (
                <MerchantSearchStrip searchQuery={search} title="Also search on:" />
              ) : null}
              <View style={{ height: 40 }} />
            </>
          }
```

- [ ] **Step 7: Manual QA**

Run the app:
```bash
cd chingiring-app && npx expo start
```

Check these scenarios:
1. Type "shoe" in the search bar → results update live within 250ms of stopping (debounce working)
2. Type "bluetoth" → should return results (Atlas fuzzy working — needs Task 2 shipped)
3. Search "xyzqwerty999" (no results, no near-misses possible) → "No products found" + merchant chips below
4. Search "shoe" + set category=Electronics (filters out all shoes) → near-miss grid of shoes appears + merchant chips below
5. Normal search results page → merchant chips appear at the bottom after the last page of results
6. Tap "Amazon" chip → Amazon search results page opens in browser, URL has `ascsubtag` param

- [ ] **Step 8: Commit**

```bash
cd chingiring-app && git add src/screens/Dashboard/CategoryProductsScreen.tsx
git commit -m "feat(search): debounce + near-miss grid + MerchantSearchStrip in search results"
```

---

## Task 8: Admin search-queries screen + navigation

**Files:**
- Create: `chingiring-app/src/screens/Admin/MobileAdminSearchQueries.tsx`
- Modify: `chingiring-app/src/api/admin.ts`
- Modify: `chingiring-app/src/components/MobileAdminNav.tsx`
- Modify: `chingiring-app/src/navigation/AdminNavigator.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/search-queries` (Task 5)
- Produces: Admin screen accessible from the "More" sheet (since it's not in `PRIMARY_KEYS`)

- [ ] **Step 1: Add `getSearchQueries` to the admin API client**

In `chingiring-app/src/api/admin.ts`, add this function alongside the other admin getters:

```ts
  getSearchQueries: async (params?: {
    page?: number;
    limit?: number;
    missesOnly?: boolean;
  }) => {
    const response = await apiClient.get('/api/admin/search-queries', { params });
    return response.data;
  },
```

- [ ] **Step 2: Create `MobileAdminSearchQueries.tsx`**

Create `chingiring-app/src/screens/Admin/MobileAdminSearchQueries.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { adminAPI } from '../../api/admin';
import { Colors, Fonts } from '../../constants/theme';

// Format a date as "Aug 15" or "Aug 15, 2025" if not current year
function fmtDate(d: string | Date): string {
  const date = new Date(d);
  const now  = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-IN', opts);
}

export function MobileAdminSearchQueries() {
  const [missesOnly, setMissesOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'search-queries', missesOnly],
    queryFn: () => adminAPI.getSearchQueries({ limit: 100, missesOnly }),
    staleTime: 60_000,
  });

  const items: any[] = data?.data?.items ?? [];
  const total: number = data?.data?.total ?? 0;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <MobileAdminNav active="AdminSearchQueries" />

      <View style={st.toolbar}>
        <Text style={st.toolbarLabel}>Misses only (0 results)</Text>
        <Switch
          value={missesOnly}
          onValueChange={setMissesOnly}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.surface}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={st.centre} size="large" color={Colors.primary} />
      ) : isError ? (
        <View style={st.centre}>
          <Text style={st.errorText}>Couldn't load. Tap to retry.</Text>
          <TouchableOpacity onPress={() => refetch()} style={st.retryBtn} activeOpacity={0.7}>
            <Text style={st.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.q}
          contentContainerStyle={st.list}
          ListHeaderComponent={
            <Text style={st.count}>
              {total} {total === 1 ? 'query' : 'queries'}
              {missesOnly ? ' with 0 results' : ''}
            </Text>
          }
          ListEmptyComponent={
            <Text style={st.empty}>No search queries logged yet.</Text>
          }
          renderItem={({ item }) => (
            <View style={st.row}>
              <View style={st.rowMain}>
                <Text style={st.query} numberOfLines={1}>{item.q}</Text>
                <View style={st.meta}>
                  <Text style={st.metaTxt}>
                    {item.lastResultCount === 0
                      ? '❌ 0 results'
                      : `✓ ${item.lastResultCount} result${item.lastResultCount === 1 ? '' : 's'}`}
                  </Text>
                  <Text style={st.metaSep}>·</Text>
                  <Text style={st.metaTxt}>last {fmtDate(item.lastSeenAt)}</Text>
                </View>
              </View>
              <View style={[st.badge, item.lastResultCount === 0 && st.badgeMiss]}>
                <Text style={[st.badgeTxt, item.lastResultCount === 0 && st.badgeMissTxt]}>
                  {item.count}×
                </Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={st.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toolbarLabel: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },

  list:  { paddingBottom: 24 },
  count: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSecondary, padding: 16, paddingBottom: 8 },
  empty: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingTop: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  rowMain: { flex: 1, marginRight: 12 },
  query:   { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaTxt: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
  metaSep: { fontSize: 12, color: Colors.border },

  badge: {
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeMiss: { backgroundColor: '#fee2e2' },
  badgeTxt:  { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textSecondary },
  badgeMissTxt: { color: Colors.danger },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 16 },

  errorText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  retryBtn:  { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:  { fontSize: 14, fontFamily: Fonts.semiBold, color: '#fff' },
});
```

- [ ] **Step 3: Add `AdminSearchQueries` to `ADMIN_NAV_ITEMS` in `MobileAdminNav.tsx`**

In `chingiring-app/src/components/MobileAdminNav.tsx`, add `Search` to the import:

```tsx
import {
  LayoutDashboard, Wallet, CreditCard, Users, Package, Store,
  Image as ImageIcon, Ticket, PlaySquare, Search,
} from 'lucide-react-native';
```

Add to `ADMIN_NAV_ITEMS` array (append at the end):

```tsx
  { key: 'AdminSearchQueries', label: 'Search', icon: Search },
```

No change needed to `TITLES` — it auto-populates from `ADMIN_NAV_ITEMS`.

- [ ] **Step 4: Register the screen in `AdminNavigator.tsx`**

Add import alongside the other screen imports:

```tsx
import { MobileAdminSearchQueries } from '../screens/Admin/MobileAdminSearchQueries';
```

Add `Tab.Screen` entry inside `MobileAdminNavigator`'s `Tab.Navigator` (before the closing tag):

```tsx
      <Tab.Screen name="AdminSearchQueries" component={MobileAdminSearchQueries} options={{ title: 'Search Queries' }} />
```

- [ ] **Step 5: Verify the screen is reachable**

Run the app and open admin. The "More" sheet (bottom nav → More) should show a "Search" entry (since `AdminSearchQueries` is not in `PRIMARY_KEYS`). Tap it → screen loads, shows "No search queries logged yet" if the collection is empty, or the sorted query list if not.

Toggle "Misses only" → list re-filters to rows where `lastResultCount === 0`.

- [ ] **Step 6: Commit**

```bash
cd chingiring-app && git add src/api/admin.ts src/screens/Admin/MobileAdminSearchQueries.tsx src/components/MobileAdminNav.tsx src/navigation/AdminNavigator.tsx
git commit -m "feat(search): admin Search Queries screen — demand log with miss filter"
```

---

## Post-ship checklist

- [ ] Confirm Atlas Search index status is **Active** in Atlas console before shipping Task 2 to prod
- [ ] Run a handful of searches in prod, then check Atlas `searchqueries` collection has rows
- [ ] Verify Amazon fallback chip URL contains `tag=<associateTag>` + `ascsubtag=cr_<userId>`
- [ ] Verify Flipkart fallback chip URL is Cuelinks-wrapped when `cuelinksPublisherId` is set
- [ ] Admin Search screen shows "Misses only" rows for searches that returned 0 results
