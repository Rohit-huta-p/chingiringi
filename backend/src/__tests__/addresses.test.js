import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Addresses API', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/addresses', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/addresses');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/addresses', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).post('/api/addresses').send({
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
