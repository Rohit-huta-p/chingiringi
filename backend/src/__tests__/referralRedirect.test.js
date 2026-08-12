import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('GET /r/:code interstitial', () => {
  it('returns a 200 HTML page that references the app scheme', async () => {
    const res = await request(app).get('/r/ABCD1234').set('User-Agent', 'Mozilla/5.0 (iPhone)');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('chingiring://signup?ref=ABCD1234');
  });
  it('sanitises the code and never 500s on junk', async () => {
    const res = await request(app).get('/r/!!bad code!!');
    expect(res.statusCode).toBe(200);
    // non-alphanumerics stripped → no raw junk echoed into the scheme
    expect(res.text).not.toContain('!!bad');
    // sanitised (uppercase, alphanumeric only) code appears in the app URL
    expect(res.text).toContain('chingiring://signup?ref=BADCODE');
  });
  it('returns 200 even without User-Agent header', async () => {
    const res = await request(app).get('/r/TEST123');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('chingiring://signup?ref=TEST123');
  });
});
