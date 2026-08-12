import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Referrals API auth', () => {
  it('POST /api/referrals/apply requires auth', async () => {
    const res = await request(app).post('/api/referrals/apply').send({ code: 'ABCD1234' });
    expect(res.statusCode).toBe(401);
  });
  it('POST /api/referrals/claim requires auth', async () => {
    const res = await request(app).post('/api/referrals/claim').send({});
    expect(res.statusCode).toBe(401);
  });
  it('GET /api/referrals/stats requires auth', async () => {
    const res = await request(app).get('/api/referrals/stats');
    expect(res.statusCode).toBe(401);
  });
});
