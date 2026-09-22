// Offline-store shared constants. Store records now come from the API
// (see src/api/stores.ts). This file keeps only the category taxonomy and the
// map center used across the offline-stores UI.
//
// STORE_CATEGORIES is the canonical *suggested* list shown in every seller
// picker and the buyer store-browse tiles. Sellers may also enter a custom
// category (the "Other" option in CategorySelect), so a store's `category` can
// be any string — StoreCategory below is only the canonical set (used to key
// CATEGORY_META); use getCategoryMeta()/getCategoryColor() for safe lookups.

export const STORE_CATEGORIES = [
  'Beauty',
  'Electronics',
  "Women's Fashion",
  'Sneakers & Shoes',
  'Home & Garden',
  'Video Games',
  'Toys',
  'Sports',
  'Baby & Kids',
  'Rocks & Crystals',
  'Outdoors',
  "Men's Fashion",
  'Arts & Handmade',
  'Jewellery & Watches',
  'Bags & Accessories',
  'Antiques & Vintage Decor',
  'Wholesale & Deals',
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const BENGALURU_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};
