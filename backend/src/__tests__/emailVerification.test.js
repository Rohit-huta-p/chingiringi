import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

// No isolated test DB in this repo, so these confirm the new routes are mounted
// and auth-gated (the gate/verify logic runs after `protect`, on a real user +
// DB, and is verified manually). If app.js failed to load with the new imports,
// every suite would fail here.
describe('Email verification + withdrawal gate wiring', () => {
  it('POST /api/profile/email/send-otp requires auth', async () => {
    const res = await request(app).post('/api/profile/email/send-otp').send({});
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/profile/email/verify requires auth', async () => {
    const res = await request(app).post('/api/profile/email/verify').send({ otp: '123456' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/wallet/withdraw requires auth (gate is after protect)', async () => {
    const res = await request(app).post('/api/wallet/withdraw').send({});
    expect(res.statusCode).toBe(401);
  });
});
