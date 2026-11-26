import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  videoUploadsDisabled,
  liveDisabled,
  videoUploadsGateMessage,
  liveGateMessage,
} from '../services/featureGate.js';
import { createUploadUrl } from '../modules/videos/videoController.js';
import { createStream } from '../modules/streams/streamController.js';

// We invoke the controllers DIRECTLY (not through supertest) because the gate
// sits after `protect`, and the test sandbox has no DB for `protect` to load a
// user from. Invoking directly also keeps us on the SAFE path only: with a flag
// ON the controller short-circuits BEFORE touching Mongo or the Mux/Cloudflare
// APIs. We deliberately never exercise the flag-OFF path here — that would mint
// a real Mux live stream against the (prod-shared) database.

// Minimal Express-style res: status() is chainable + recorded, json() is a spy.
const mockRes = () => {
  const r = { statusCode: 200 };
  r.status = jest.fn((code) => { r.statusCode = code; return r; });
  r.json = jest.fn(() => r);
  return r;
};

// Restore the env keys each test touches so cases don't leak into one another.
const SAVED = { ...process.env };
afterEach(() => {
  for (const k of ['VIDEO_UPLOADS_DISABLED', 'LIVE_STREAMING_DISABLED', 'VIDEO_PROVIDER']) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
});

describe('featureGate flags', () => {
  it('parses common truthy spellings; unset/false = enabled', () => {
    for (const v of ['true', 'TRUE', '1', 'yes', 'on', ' On ']) {
      process.env.VIDEO_UPLOADS_DISABLED = v;
      expect(videoUploadsDisabled()).toBe(true);
    }
    process.env.VIDEO_UPLOADS_DISABLED = 'false';
    expect(videoUploadsDisabled()).toBe(false);
    delete process.env.VIDEO_UPLOADS_DISABLED;
    expect(videoUploadsDisabled()).toBe(false);

    process.env.LIVE_STREAMING_DISABLED = 'yes';
    expect(liveDisabled()).toBe(true);
  });

  it('video message names the ACTIVE provider; live message always names Mux', () => {
    process.env.VIDEO_PROVIDER = 'cloudflare';
    expect(videoUploadsGateMessage()).toMatch(/upgrade the Cloudflare plan to continue/);
    process.env.VIDEO_PROVIDER = 'mux';
    expect(videoUploadsGateMessage()).toMatch(/upgrade the Mux plan to continue/);
    expect(liveGateMessage()).toMatch(/upgrade the Mux plan to continue/);
  });
});

describe('the gate fires in-controller before any DB / provider work', () => {
  it('createUploadUrl → 503 with the provider-named message when uploads are paused', async () => {
    process.env.VIDEO_UPLOADS_DISABLED = 'true';
    process.env.VIDEO_PROVIDER = 'cloudflare';
    const res = mockRes();
    await expect(createUploadUrl({ body: {}, user: { _id: 'u1' } }, res))
      .rejects.toThrow(/upgrade the Cloudflare plan to continue/);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('createStream → 503 with the Mux message when going live is paused', async () => {
    process.env.LIVE_STREAMING_DISABLED = 'true';
    const res = mockRes();
    await expect(createStream({ body: { storeId: 's1' }, user: { _id: 'u1' } }, res))
      .rejects.toThrow(/upgrade the Mux plan to continue/);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
