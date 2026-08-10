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
  it('POST /api/shares still requires auth (pending flow, no anonymous shares)', async () => {
    const res = await request(app).post('/api/shares').send({ itemType: 'product', itemId: 'x' });
    expect(res.statusCode).toBe(401);
  });
});
