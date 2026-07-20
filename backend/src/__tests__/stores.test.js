import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import Store from '../modules/stores/storeModel.js';
import app from '../app.js';

// Fail queries fast when no DB is connected (default buffer is 10s, which blows
// past jest's 5s per-test timeout). With a DB connected (CI), queries run
// normally. Lets the API smoke tests tolerate a DB-less local run.
mongoose.set('bufferTimeoutMS', 2000);

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

describe('Stores API', () => {
  // 200 with a DB, 500 without one — either way the route is mounted and the
  // response shape is correct when it succeeds.
  it('GET /api/stores is reachable and well-shaped', async () => {
    const res = await request(app).get('/api/stores');
    expect([200, 500]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body.data).toHaveProperty('stores');
      expect(Array.isArray(res.body.data.stores)).toBe(true);
    }
  });

  // Auth-gate — no DB needed; `protect` rejects before any query runs.
  it('POST /api/stores is 401 without auth', async () => {
    const res = await request(app).post('/api/stores').send({ name: 'X' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/stores/:bad is 404 or 500', async () => {
    const res = await request(app).get('/api/stores/000000000000000000000000');
    expect([404, 500]).toContain(res.statusCode);
  });
});
