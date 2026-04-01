import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Profile API', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/profile', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/profile');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/profile', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).put('/api/profile').send({
        name: 'Test User',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/profile', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/profile');
      expect(res.statusCode).toBe(401);
    });
  });
});
