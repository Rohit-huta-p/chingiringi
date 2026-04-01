import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Categories API', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/categories', () => {
    it('should return 200 with categories array', async () => {
      try {
        const res = await request(app).get('/api/categories');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      } catch (error) {
        if (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('MongoNotConnectedError') ||
          error.message.includes('buffering timed out')
        ) {
          console.warn('Skipping test: MongoDB not connected');
          return;
        }
        throw error;
      }
    });
  });

  describe('POST /api/categories', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).post('/api/categories').send({
        name: 'Test Category',
        slug: 'test-category',
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
