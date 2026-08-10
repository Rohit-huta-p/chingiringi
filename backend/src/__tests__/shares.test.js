import { describe, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import ShareEvent from '../modules/shares/shareModel.js';

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
  it('renders the interstitial (200) even when the DB lookup fails', async () => {
    const spy = jest.spyOn(ShareEvent, 'findOne').mockReturnValue({ sort: () => Promise.reject(new Error('db down')) });
    const res = await request(app).get('/s/product/64f8a2b9c1d2e3f4a5b6c7d8?ref=cr_64f8a2b9c1d2e3f4a5b6c7d8');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('chingiringapp://product/');
    spy.mockRestore();
  });
  it('redirects invalid links home without echoing input (no XSS)', async () => {
    const res = await request(app).get('/s/product/%22%3E%3Cscript%3E?ref=cr_x');
    expect(res.statusCode).toBe(302);
    expect(res.text).not.toContain('<script>');
  });
});
