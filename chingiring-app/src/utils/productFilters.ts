import { Product } from '../api/products';

// Shared sort + range-filter logic for every product listing (Home web/mobile,
// Category page). Pure and UI-free so all three surfaces behave identically and
// the rules can be unit-tested in isolation.

export type SortKey = 'price_asc' | 'price_desc' | 'newest' | 'best';

export interface RangePreset {
  id: string;
  label: string;
  test: (p: Product) => boolean;
}

export interface ProductControlsState {
  sort: SortKey | null;
  priceRange: string; // RangePreset id from PRICE_PRESETS
  coinsRange: string; // RangePreset id from COINS_PRESETS
}

export const DEFAULT_CONTROLS: ProductControlsState = {
  sort: null,
  priceRange: 'all',
  coinsRange: 'all',
};

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'price_asc', label: 'Price ↑' },
  { id: 'price_desc', label: 'Price ↓' },
  { id: 'newest', label: 'Newest' },
  { id: 'best', label: 'Best-selling' },
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
  return s.sort !== null || s.priceRange !== 'all' || s.coinsRange !== 'all';
}

function findPreset(list: RangePreset[], id: string): RangePreset | undefined {
  return list.find((r) => r.id === id);
}

const SORT_COMPARATORS: Record<SortKey, (a: Product, b: Product) => number> = {
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  best: (a, b) => (b.sold ?? 0) - (a.sold ?? 0),
};

// Filter by the active price/coins buckets, then sort. Never mutates the input.
export function applyProductControls(
  products: Product[],
  s: ProductControlsState,
): Product[] {
  const priceP = findPreset(PRICE_PRESETS, s.priceRange);
  const coinsP = findPreset(COINS_PRESETS, s.coinsRange);

  let out = products.filter(
    (p) => (!priceP || priceP.test(p)) && (!coinsP || coinsP.test(p)),
  );

  if (s.sort) {
    out = [...out].sort(SORT_COMPARATORS[s.sort]);
  }

  return out;
}
