import { describe, it, expect, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

// GET /api/config is public and touches no DB, so we can drive it end-to-end
// through app.js with supertest. Flipping the env between requests also proves
// featureStatus() reads the flags LAZILY (not frozen at module load).
afterEach(() => {
  delete process.env.VIDEO_UPLOADS_DISABLED;
  delete process.env.LIVE_STREAMING_DISABLED;
  delete process.env.VIDEO_PROVIDER;
});

describe('GET /api/config', () => {
  it('reports both features enabled by default', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.features.videoUploads.disabled).toBe(false);
    expect(res.body.data.features.videoUploads.message).toBe('');
    expect(res.body.data.features.live.disabled).toBe(false);
  });

  it('reflects the env flags lazily, with provider-named messages', async () => {
    process.env.VIDEO_UPLOADS_DISABLED = 'true';
    process.env.VIDEO_PROVIDER = 'cloudflare';
    process.env.LIVE_STREAMING_DISABLED = 'true';

    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.data.features.videoUploads.disabled).toBe(true);
    expect(res.body.data.features.videoUploads.message).toMatch(/upgrade the Cloudflare plan to continue/);
    expect(res.body.data.features.live.disabled).toBe(true);
    expect(res.body.data.features.live.message).toMatch(/upgrade the Mux plan to continue/);
  });
});
