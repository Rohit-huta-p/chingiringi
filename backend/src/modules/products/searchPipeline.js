/**
 * Pure pipeline builder for product search.
 * No I/O — all logic is testable without a DB connection.
 * Consumed by getProducts in productController.js.
 */
import mongoose from 'mongoose';

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
  storeId,
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
  // isActive: always include on the MongoDB side as a safety net — Atlas filter
  // handles it inside the engine, but a misconfigured index can silently skip it.
  const match = { isActive: true };
  if (category) match.category = { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  if (featured) match.isFeatured = true;
  // storeId: filter to products assigned to this store. Products without a storeId
  // are platform-wide and will NOT appear on any individual store profile — they
  // are only visible through the main catalogue. Admin assigns storeId to surface
  // a product on a store's public SellerProfileScreen.
  if (storeId) {
    match.storeId = new mongoose.Types.ObjectId(storeId);
  }

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
