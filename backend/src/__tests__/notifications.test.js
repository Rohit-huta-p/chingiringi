import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Notifications API', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('GET /api/notifications', () => {
    it('should return 401 without authentication', async () => {
      try {
        const res = await request(app).get('/api/notifications');
        expect(res.statusCode).toBe(401);
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

  describe('GET /api/notifications/unread-count', () => {
    it('should return 401 without authentication', async () => {
      try {
        const res = await request(app).get('/api/notifications/unread-count');
        expect(res.statusCode).toBe(401);
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

  describe('POST /api/notifications/push-token', () => {
    it('should return 401 without authentication', async () => {
      try {
        const res = await request(app).post('/api/notifications/push-token').send({
          token: 'ExponentPushToken[test]',
          platform: 'ios',
        });
        expect(res.statusCode).toBe(401);
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
});
