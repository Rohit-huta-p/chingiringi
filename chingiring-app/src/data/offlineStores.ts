// Offline-store shared constants. Store records now come from the API
// (see src/api/stores.ts). This file keeps only the category taxonomy and the
// map center used across the offline-stores UI.

export type StoreCategory =
  | 'Fashion'
  | 'Electronics'
  | 'Grocery'
  | 'Food & Cafe'
  | 'Health'
  | 'Jewellery'
  | 'Sports'
  | 'Beauty';

export const BENGALURU_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};

export const STORE_CATEGORIES: StoreCategory[] = [
  'Fashion',
  'Electronics',
  'Grocery',
  'Food & Cafe',
  'Health',
  'Jewellery',
  'Sports',
  'Beauty',
];
