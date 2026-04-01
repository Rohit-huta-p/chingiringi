import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Wallet API', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/wallet', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/wallet');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/wallet/transactions', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/wallet/transactions');
      expect(res.statusCode).toBe(401);
    });
  });
});
