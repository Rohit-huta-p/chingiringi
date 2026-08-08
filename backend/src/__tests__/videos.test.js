import { describe, it, expect, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import { verifyWebhookSignature } from '../services/cloudflareStream.js';

describe('cloudflareStream.verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ uid: 'abc', status: { state: 'ready' } });
  const time = '1699999999';
  const sig = crypto.createHmac('sha256', secret).update(`${time}.${body}`).digest('hex');

  it('accepts a correct signature', () => {
    expect(verifyWebhookSignature(body, `time=${time},sig1=${sig}`, secret)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(body + 'x', `time=${time},sig1=${sig}`, secret)).toBe(false);
  });
  it('rejects a malformed header', () => {
    expect(verifyWebhookSignature(body, 'garbage', secret)).toBe(false);
  });
});
