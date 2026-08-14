import { Product } from '../api/products';
import { discountPct } from './product';

// Shared sort + range-filter logic for every product listing (Home web/mobile,
// Category page). Pure and UI-free so all three surfaces behave identically and
// the rules can be unit-tested in isolation.

export type SortKey = 'price_asc' | 'price_desc' | 'discount' | 'newest' | 'best';

export interface RangePreset {
  id: string;
  label: string;
  test: (p: Product) => boolean;
}

export interface ProductControlsState {
  sort: SortKey | null;
  priceRange: string; // RangePreset id from PRICE_PRESETS
  coinsRange: string; // RangePreset id from COINS_PRESETS
  minDiscount: number; // 0 = any; else min % off (vs MRP)
  minRating: number;   // 0 = any; else min headline rating
  category: string;    // '' / 'All' = any; else exact category name (facet)
}

export const DEFAULT_CONTROLS: ProductControlsState = {
  sort: null,
  priceRange: 'all',
  coinsRange: 'all',
  minDiscount: 0,
  minRating: 0,
  category: '',
};

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'price_asc', label: 'Price ↑' },
  { id: 'price_desc', label: 'Price ↓' },
  { id: 'discount', label: 'Discount ↓' },
  { id: 'newest', label: 'Newest' },
  { id: 'best', label: 'Best-selling' },
];

// Threshold chips for the filter sheet. id is the numeric value as a string so
// the shared RangeChips renderer can drive them; 'Any' clears the threshold.
export const DISCOUNT_STEPS: { id: string; label: string }[] = [
  { id: '0', label: 'Any' },
  { id: '10', label: '10%+' },
  { id: '20', label: '20%+' },
  { id: '30', label: '30%+' },
  { id: '50', label: '50%+' },
];

export const RATING_STEPS: { id: string; label: string }[] = [
  { id: '0', label: 'Any' },
  { id: '4', label: '4★+' },
  { id: '4.5', label: '4.5★+' },
];

// Non-overlapping buckets so a product lands in exactly one.
export const PRICE_PRESETS: RangePreset[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'lt500', label: '< ₹500', test: (p) => p.price < 500 },
  { id: '500_1000', label: '₹500–1k', test: (p) => p.price >= 500 && p.price <= 1000 },
  { id: '1000_5000', label: '₹1k–5k', test: (p) => p.price > 1000 && p.price <= 5000 },
  { id: 'gt5000', label: '> ₹5k', test: (p) => p.price > 5000 },
];

export const COINS_PRESETS: RangePreset[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'lt500', label: '< 500', test: (p) => p.coinsPrice < 500 },
  { id: '500_2000', label: '500–2k', test: (p) => p.coinsPrice >= 500 && p.coinsPrice <= 2000 },
  { id: '2000_10000', label: '2k–10k', test: (p) => p.coinsPrice > 2000 && p.coinsPrice <= 10000 },
  { id: 'gt10000', label: '> 10k', test: (p) => p.coinsPrice > 10000 },
];

// True when the user has changed anything from the defaults — i.e. the page
// should switch from its curated layout to a flat listing.
export function isControlsActive(s: ProductControlsState): boolean {
  return (
    s.sort !== null ||
    s.priceRange !== 'all' ||
    s.coinsRange !== 'all' ||
    s.minDiscount > 0 ||
    s.minRating > 0 ||
    (!!s.category && s.category !== 'All')
  );
}

// ── Server query mapping ──────────────────────────────────────────────────────
// Range presets are UI buckets; the Results page runs them server-side, so map
// each bucket to numeric bounds (integer prices/coins). Keep in sync with
// PRICE_PRESETS / COINS_PRESETS above.
const PRICE_BOUNDS: Record<string, { minPrice?: number; maxPrice?: number }> = {
  all: {},
  lt500: { maxPrice: 499 },
  '500_1000': { minPrice: 500, maxPrice: 1000 },
  '1000_5000': { minPrice: 1001, maxPrice: 5000 },
  gt5000: { minPrice: 5001 },
};
const COINS_BOUNDS: Record<string, { minCoins?: number; maxCoins?: number }> = {
  all: {},
  lt500: { maxCoins: 499 },
  '500_2000': { minCoins: 500, maxCoins: 2000 },
  '2000_10000': { minCoins: 2001, maxCoins: 10000 },
  gt10000: { minCoins: 10001 },
};

// Turn the UI control state (+ optional search) into getProducts() query params
// so filter/sort/search all run server-side with pagination.
export function controlsToQuery(
  s: ProductControlsState,
  extra?: { search?: string },
): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (s.sort) q.sort = s.sort;
  const price = PRICE_BOUNDS[s.priceRange];
  if (price?.minPrice != null) q.minPrice = price.minPrice;
  if (price?.maxPrice != null) q.maxPrice = price.maxPrice;
  const coins = COINS_BOUNDS[s.coinsRange];
  if (coins?.minCoins != null) q.minCoins = coins.minCoins;
  if (coins?.maxCoins != null) q.maxCoins = coins.maxCoins;
  if (s.minDiscount > 0) q.minDiscount = s.minDiscount;
  if (s.minRating > 0) q.minRating = s.minRating;
  if (s.category && s.category !== 'All') q.category = s.category;
  const search = extra?.search?.trim();
  if (search) q.search = search;
  return q;
}

function findPreset(list: RangePreset[], id: string): RangePreset | undefined {
  return list.find((r) => r.id === id);
}

const SORT_COMPARATORS: Record<SortKey, (a: Product, b: Product) => number> = {
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  discount: (a, b) => (discountPct(b.mrp, b.price) ?? 0) - (discountPct(a.mrp, a.price) ?? 0),
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  best: (a, b) => (b.sold ?? 0) - (a.sold ?? 0),
};

// Filter by the active price/coins buckets + discount/rating thresholds, then
// sort. Never mutates the input.
export function applyProductControls(
  products: Product[],
  s: ProductControlsState,
): Product[] {
  const priceP = findPreset(PRICE_PRESETS, s.priceRange);
  const coinsP = findPreset(COINS_PRESETS, s.coinsRange);

  let out = products.filter(
    (p) =>
      (!priceP || priceP.test(p)) &&
      (!coinsP || coinsP.test(p)) &&
      (s.minDiscount <= 0 || (discountPct(p.mrp, p.price) ?? 0) >= s.minDiscount) &&
      (s.minRating <= 0 || (p.rating ?? 0) >= s.minRating),
  );

  if (s.sort) {
    out = [...out].sort(SORT_COMPARATORS[s.sort]);
  }

  return out;
}
