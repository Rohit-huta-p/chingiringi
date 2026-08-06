import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

// This repo runs tests against app.js directly with no isolated test DB, so we
// cover the validation gate that runs BEFORE any Google verification or DB write.
// The find-or-create path is verified manually against a dev Google account.
describe('POST /auth/google', () => {
  it('400s when idToken is missing', async () => {
    const res = await request(app).post('/auth/google').send({});
    expect(res.statusCode).toBe(400);
  });

  it('400s when idToken is empty', async () => {
    const res = await request(app).post('/auth/google').send({ idToken: '' });
    expect(res.statusCode).toBe(400);
  });
});
