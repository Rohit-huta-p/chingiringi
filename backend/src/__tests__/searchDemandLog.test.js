import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

// Integration test — requires a real MongoDB connection.
// Gracefully skipped when MongoDB is not available.
describe('Demand log', () => {
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });

  it('GET /api/products does not 500 when search is present', async () => {
    try {
      const res = await request(app).get('/api/products?search=demandlogtest');

      // Skip on MongoDB connection errors (500 responses with specific error patterns)
      if (res.status === 500) {
        const errorMsg = JSON.stringify(res.body?.error || res.body?.message || '');
        if (
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('MongoNotConnected') ||
          errorMsg.includes('buffering timed out')
        ) {
          console.warn('Skipping: MongoDB or Atlas Search not available');
          return;
        }
      }

      expect(res.status).toBe(200);
      // nearMisses key must be present (even if empty array)
      expect(res.body.data).toHaveProperty('nearMisses');
      expect(Array.isArray(res.body.data.nearMisses)).toBe(true);
    } catch (e) {
      if (
        e.message?.includes('ECONNREFUSED') ||
        e.message?.includes('MongoNotConnected') ||
        e.message?.includes('buffering timed out')
      ) {
        console.warn('Skipping: MongoDB not connected');
        return;
      }
      throw e;
    }
  });
});
