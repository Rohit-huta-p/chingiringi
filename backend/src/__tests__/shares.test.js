import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Shares API auth', () => {
  it('POST /api/shares requires auth', async () => {
    const res = await request(app).post('/api/shares').send({ itemType: 'product', itemId: 'x' });
    expect(res.statusCode).toBe(401);
  });
  it('GET /api/shares/quota requires auth', async () => {
    const res = await request(app).get('/api/shares/quota');
    expect(res.statusCode).toBe(401);
  });
  // Pending-contract shape (data.status='pending', shareUrl, coinsPerShare) needs a
  // Mongo-backed harness to assert end-to-end; not available in this repo yet.
});

describe('Share redirect /s', () => {
  // No DB in this harness: the pending lookup buffers against mongoose's
  // disconnected connection and only resolves once its buffering timeout
  // fires (caught internally) — past jest's 5s default, hence the bump.
  it('returns a 200 interstitial for a well-formed link', async () => {
    const res = await request(app).get('/s/product/64f8a2b9c1d2e3f4a5b6c7d8?ref=cr_64f8a2b9c1d2e3f4a5b6c7d8');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('chingiringapp://product/');
  }, 20000);
  it('never 4xxs the opener, even on a garbage id', async () => {
    const res = await request(app).get('/s/product/not-an-id?ref=cr_x');
    expect(res.statusCode).toBe(200);
  });
});
