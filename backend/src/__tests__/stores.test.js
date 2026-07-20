import { describe, it, expect } from '@jest/globals';
import Store from '../modules/stores/storeModel.js';

describe('Store model', () => {
  it('requires the core fields', () => {
    expect(Store.schema.path('name').isRequired).toBe(true);
    expect(Store.schema.path('shortName').isRequired).toBe(true);
    expect(Store.schema.path('address').isRequired).toBe(true);
    expect(Store.schema.path('lat').isRequired).toBe(true);
    expect(Store.schema.path('lng').isRequired).toBe(true);
    expect(Store.schema.path('userDiscountPercent').isRequired).toBe(true);
    expect(Store.schema.path('platformCommissionPercent').isRequired).toBe(true);
  });

  it('constrains category to the 8 store categories', () => {
    const values = Store.schema.path('category').enumValues;
    expect(values).toEqual([
      'Fashion', 'Electronics', 'Grocery', 'Food & Cafe',
      'Health', 'Jewellery', 'Sports', 'Beauty',
    ]);
  });

  it('defaults city, flags and settlement cycle', () => {
    expect(Store.schema.path('city').defaultValue).toBe('Bengaluru');
    expect(Store.schema.path('isActive').defaultValue).toBe(true);
    expect(Store.schema.path('isFeatured').defaultValue).toBe(false);
    expect(Store.schema.path('settlementCycle').defaultValue).toBe('monthly');
  });
});
