import { describe, it, expect, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import { verifyWebhookSignature } from '../services/cloudflareStream.js';
import Video from '../modules/videos/videoModel.js';
import mongoose from 'mongoose';

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

describe('Video model', () => {
  it('requires store and streamUid', () => {
    const err = new Video({}).validateSync();
    expect(err.errors.store).toBeDefined();
    expect(err.errors.streamUid).toBeDefined();
  });
  it('defaults status=processing, moderation.state=pending, zeroed stats', () => {
    const v = new Video({ store: new mongoose.Types.ObjectId(), streamUid: 'uid1' });
    expect(v.validateSync()).toBeUndefined();
    expect(v.status).toBe('processing');
    expect(v.moderation.state).toBe('pending');
    expect(v.stats.views).toBe(0);
    expect(v.cta.type).toBe('shop');
  });
  it('rejects an invalid status enum', () => {
    const v = new Video({ store: new mongoose.Types.ObjectId(), streamUid: 'u', status: 'nope' });
    expect(v.validateSync().errors.status).toBeDefined();
  });
});
