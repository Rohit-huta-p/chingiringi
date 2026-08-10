import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Admin dashboard route', () => {
  it('GET /api/admin/dashboard requires auth', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect([401, 403]).toContain(res.statusCode);
  });
});
