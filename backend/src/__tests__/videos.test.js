import { describe, it, expect, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import { verifyWebhookSignature } from '../services/cloudflareStream.js';
import Video from '../modules/videos/videoModel.js';
import mongoose from 'mongoose';
import { buildFeedQuery, nextCursor, clampWatchSec } from '../modules/videos/videoRanking.js';

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

describe('videoRanking helpers', () => {
  it('buildFeedQuery filters ready+approved and clamps limit to 20', () => {
    const q = buildFeedQuery({ limit: 999 });
    expect(q.filter.status).toBe('ready');
    expect(q.filter['moderation.state']).toBe('approved');
    expect(q.limit).toBe(20);
    expect(q.sort).toEqual({ _id: -1 });
    expect(q.filter._id).toBeUndefined();
  });
  it('buildFeedQuery adds an _id cursor when provided', () => {
    const q = buildFeedQuery({ cursor: '650000000000000000000001', limit: 5 });
    expect(q.filter._id.$lt.toString()).toBe('650000000000000000000001');
    expect(q.limit).toBe(5);
  });
  it('nextCursor returns the last id or null', () => {
    expect(nextCursor([{ _id: 'a' }, { _id: 'b' }])).toBe('b');
    expect(nextCursor([])).toBeNull();
  });
  it('clampWatchSec bounds the value', () => {
    expect(clampWatchSec(-5, 30)).toBe(0);
    expect(clampWatchSec(45, 30)).toBe(30);
    expect(clampWatchSec(10, 30)).toBe(10);
    expect(clampWatchSec(99999, 0)).toBe(3600);
  });
});
