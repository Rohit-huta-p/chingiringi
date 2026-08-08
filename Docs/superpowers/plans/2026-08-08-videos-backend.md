# Videos v1 — Backend Module & Cloudflare Integration (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend for the shoppable business Reels feed — a `videos` module that issues Cloudflare Stream direct-upload URLs, tracks encode status via webhook, and serves a ranked, shoppable feed with engagement + admin moderation.

**Architecture:** Video bytes never touch our server. The client uploads directly to Cloudflare Stream via a short-lived URL our backend mints; Cloudflare webhooks us when encoding finishes; we store only metadata (Stream UID, HLS URL, thumbnail, duration) in Mongo. Everything mirrors the existing module pattern (`modules/<name>/{model,controller,routes}.js`, response envelope `{ status, data }`, `protect`/`admin` middleware, `express-async-errors`).

**Tech Stack:** Node/Express 4, Mongoose 9 (MongoDB), Jest + supertest, native `fetch` (Node 18+, no new deps), Cloudflare Stream REST API. Frontend is a separate plan.

## Global Constraints

- **No new backend dependencies.** Use global `fetch` for Cloudflare calls; `zod` (already installed) for input validation; `crypto` (built-in) for webhook signatures.
- **Response envelope:** every success returns `res.status(2xx).json({ status: 'success', data: {...} })`. Errors: `res.status(code); throw new Error('message')` (handled by `errorMiddleware`).
- **Auth:** reuse `protect`, `admin`, `optionalProtect` from `src/middleware/`. v1 creation/moderation is **admin-only** (`User.role` enum is `['user','admin']` — no business role yet; business self-serve is Plan 4/Phase 2).
- **Ownership:** a `Video` belongs to an existing `Store` (`modules/stores/storeModel.js`) and tags existing `Product`s (`modules/products/productModel.js`).
- **Webhook raw body:** the Cloudflare webhook route MUST be mounted before `express.json()` (same pattern as the Razorpay webhook at `app.js:48`), because signature verification needs the raw bytes.
- **Test style:** mirror `src/__tests__/deals.test.js` — supertest against `app`, resilient to a missing DB (catch `ECONNREFUSED`/`MongoNotConnectedError`/`buffering timed out` and skip). Pure helpers (signature verify, feed query, clamp) get real unit tests with hard assertions.
- **Env vars (never commit secrets):** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.
- **Run tests with:** `npm test` (from `backend/`). Run a single file: `npm test -- videos.test.js`.

---

## File Structure

**Create:**
- `backend/src/services/cloudflareStream.js` — thin Cloudflare Stream REST client + webhook signature verify. Pure/mocked-fetch testable.
- `backend/src/modules/videos/videoModel.js` — `Video` Mongoose schema.
- `backend/src/modules/videos/videoInteractionModel.js` — `VideoInteraction` (like/save) join collection.
- `backend/src/modules/videos/videoRanking.js` — pure feed query + cursor + clamp helpers.
- `backend/src/modules/videos/videoController.js` — all request handlers.
- `backend/src/modules/videos/videoRoutes.js` — JSON API routes (`/api/videos`).
- `backend/src/modules/videos/videoWebhookRoutes.js` — raw-body webhook route.
- `backend/src/scripts/reconcileVideos.js` — cron: rescue videos stuck in `processing`.
- `backend/src/__tests__/videos.test.js` — API + unit tests.

**Modify:**
- `backend/src/app.js` — import + mount `videoWebhookRoutes` (before `express.json()`) and `videoRoutes` (with the other `/api/*` routes).
- `backend/package.json` — add `"cron:reconcile-videos": "node src/scripts/reconcileVideos.js"`.
- `backend/.env.example` — document the three `CLOUDFLARE_*` vars (create the file if absent).

---

## Task 1: Cloudflare Stream service + webhook signature verify

**Files:**
- Create: `backend/src/services/cloudflareStream.js`
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces:
  - `createDirectUpload({ maxDurationSeconds, meta }) → Promise<{ uid, uploadURL }>`
  - `deleteStreamVideo(uid) → Promise<boolean>`
  - `fetchStreamStatus(uid) → Promise<{ state, readyToStream, hls, thumbnail, duration } | null>`
  - `verifyWebhookSignature(rawBody, signatureHeader, secret) → boolean` (pure; HMAC-SHA256 over `time + '.' + rawBody`)

- [ ] **Step 1: Write the failing unit test** (append to `backend/src/__tests__/videos.test.js`; create the file with this content)

```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- videos.test.js`
Expected: FAIL — `Cannot find module '../services/cloudflareStream.js'`.

- [ ] **Step 3: Implement the service**

```js
// backend/src/services/cloudflareStream.js
import crypto from 'crypto';

const API = 'https://api.cloudflare.com/client/v4';
const acct = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const authHeader = () => ({ Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}` });

/** Create a one-time direct-upload URL. Client POSTs the video file to uploadURL. */
export async function createDirectUpload({ maxDurationSeconds = 120, meta = {} } = {}) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/direct_upload`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: false, meta }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Cloudflare direct_upload failed: ${JSON.stringify(json.errors || json)}`);
  }
  return { uid: json.result.uid, uploadURL: json.result.uploadURL };
}

export async function deleteStreamVideo(uid) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/${uid}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  return res.ok;
}

/** Poll a video's status (used by the reconcile cron when a webhook is missed). */
export async function fetchStreamStatus(uid) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/${uid}`, { headers: authHeader() });
  const json = await res.json();
  if (!res.ok || !json.success) return null;
  const r = json.result;
  return {
    state: r.status?.state,
    readyToStream: r.readyToStream,
    hls: r.playback?.hls,
    thumbnail: r.thumbnail,
    duration: r.duration,
  };
}

/**
 * Verify a Cloudflare Stream webhook. Header format:
 *   Webhook-Signature: time=1699999999,sig1=<hex hmac-sha256 of `time.body`>
 * Pure function — no network. Uses timing-safe comparison.
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    String(signatureHeader).split(',').map((kv) => kv.split('=').map((s) => s.trim())),
  );
  const { time, sig1 } = parts;
  if (!time || !sig1) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(`${time}.${body}`).digest('hex');
  if (expected.length !== sig1.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig1));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- videos.test.js`
Expected: the three `verifyWebhookSignature` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/cloudflareStream.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): Cloudflare Stream service + webhook signature verify"
```

---

## Task 2: Video + VideoInteraction models

**Files:**
- Create: `backend/src/modules/videos/videoModel.js`
- Create: `backend/src/modules/videos/videoInteractionModel.js`
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces: `Video` model with fields per PRD §8.5; `VideoInteraction { user, video, type: 'like'|'save' }`.
- Consumes: refs `Store`, `User`, `Product` (existing models).

Mongoose `validateSync()` runs **without a DB connection**, so these are hard-asserted unit tests.

- [ ] **Step 1: Write the failing test** (append to `videos.test.js`)

```js
import Video from '../modules/videos/videoModel.js';
import mongoose from 'mongoose';

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
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- videos.test.js`
Expected: FAIL — `Cannot find module '../modules/videos/videoModel.js'`.

- [ ] **Step 3: Implement the models**

```js
// backend/src/modules/videos/videoModel.js
import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema({
  views: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  watchSec: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  productTaps: { type: Number, default: 0 },
  storeTaps: { type: Number, default: 0 },
}, { _id: false });

const videoSchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  streamUid: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error', 'flagged', 'removed'],
    default: 'processing',
    index: true,
  },
  hlsUrl: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  durationSec: { type: Number, default: 0 },
  caption: { type: String, default: '', maxlength: 300 },
  hashtags: [{ type: String }],
  taggedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  cta: {
    type: { type: String, enum: ['shop', 'store', 'none'], default: 'shop' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    url: { type: String, default: '' },
  },
  stats: { type: statsSchema, default: () => ({}) },
  moderation: {
    state: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    at: { type: Date },
  },
  isFeatured: { type: Boolean, default: false },
  publishedAt: { type: Date },
}, { timestamps: true });

// Feed reads: ready + approved, newest first.
videoSchema.index({ status: 1, 'moderation.state': 1, _id: -1 });
videoSchema.index({ store: 1, status: 1 });

export default mongoose.model('Video', videoSchema);
```

```js
// backend/src/modules/videos/videoInteractionModel.js
import mongoose from 'mongoose';

const videoInteractionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  type: { type: String, enum: ['like', 'save'], required: true },
}, { timestamps: true });

videoInteractionSchema.index({ user: 1, video: 1, type: 1 }, { unique: true });

export default mongoose.model('VideoInteraction', videoInteractionSchema);
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- videos.test.js`
Expected: the `Video model` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoModel.js backend/src/modules/videos/videoInteractionModel.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): Video + VideoInteraction models"
```

---

## Task 3: Pure feed-query, cursor & clamp helpers

**Files:**
- Create: `backend/src/modules/videos/videoRanking.js`
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces:
  - `buildFeedQuery({ cursor, limit }) → { filter, sort, limit }` — only `ready` + `approved`; `_id`-cursor pagination (ObjectId is time-ordered, so no extra sort key needed).
  - `nextCursor(items) → string | null` — last item's `_id` as string, or null.
  - `clampWatchSec(value, durationSec) → number` — non-negative, capped at `durationSec` (or 3600 when duration unknown).

- [ ] **Step 1: Write the failing test** (append)

```js
import { buildFeedQuery, nextCursor, clampWatchSec } from '../modules/videos/videoRanking.js';

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
```

- [ ] **Step 2: Run, expect fail** — `Cannot find module '../modules/videos/videoRanking.js'`.

- [ ] **Step 3: Implement**

```js
// backend/src/modules/videos/videoRanking.js
import mongoose from 'mongoose';

export function buildFeedQuery({ cursor, limit } = {}) {
  const filter = { status: 'ready', 'moderation.state': 'approved' };
  if (cursor && mongoose.isValidObjectId(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const n = Math.min(Math.max(Number(limit) || 5, 1), 20);
  return { filter, sort: { _id: -1 }, limit: n };
}

export function nextCursor(items) {
  if (!items || items.length === 0) return null;
  return String(items[items.length - 1]._id);
}

export function clampWatchSec(value, durationSec) {
  const cap = durationSec > 0 ? durationSec : 3600;
  const v = Number(value) || 0;
  return Math.max(0, Math.min(v, cap));
}
```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoRanking.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): pure feed-query, cursor and watch-time clamp helpers"
```

---

## Task 4: Controller — admin upload URL + create video

**Files:**
- Create: `backend/src/modules/videos/videoController.js`
- Create: `backend/src/modules/videos/videoRoutes.js`
- Modify: `backend/src/app.js` (import + mount `/api/videos`)
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces (controller exports used by routes): `createUploadUrl`, `createVideo`, and (added in later tasks) `getFeed`, `getVideo`, `getStoreVideos`, `trackView`, `toggleLike`, `toggleSave`, `trackShare`, `listPending`, `moderateVideo`, `deleteVideo`.
- Consumes: `cloudflareStream.createDirectUpload`, `Video`, `zod`.

> This task creates `videoController.js` and `videoRoutes.js` with the two admin-create handlers and mounts the router. Later controller tasks **append** handlers to the same files and add routes. Repeated import lines shown so out-of-order readers stay correct.

- [ ] **Step 1: Write the failing test** (append)

```js
describe('POST /api/videos/upload-url', () => {
  it('401s without auth', async () => {
    const res = await request(app).post('/api/videos/upload-url').send({ storeId: 'x' });
    expect(res.statusCode).toBe(401);
  });
});
describe('POST /api/videos', () => {
  it('401s without auth', async () => {
    const res = await request(app).post('/api/videos').send({ streamUid: 'u', storeId: 'x' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run, expect fail** — routes 404 (not 401) because `/api/videos` isn't mounted yet.

- [ ] **Step 3: Implement controller + routes + mount**

```js
// backend/src/modules/videos/videoController.js
import { z } from 'zod';
import mongoose from 'mongoose';
import Video from './videoModel.js';
import { createDirectUpload } from '../../services/cloudflareStream.js';

// @desc  Mint a Cloudflare direct-upload URL   @route POST /api/videos/upload-url  @access admin
export const createUploadUrl = async (req, res) => {
  const { storeId } = req.body;
  if (!mongoose.isValidObjectId(storeId)) {
    res.status(400);
    throw new Error('A valid storeId is required');
  }
  const { uid, uploadURL } = await createDirectUpload({
    maxDurationSeconds: 120,
    meta: { storeId: String(storeId), createdBy: String(req.user._id) },
  });
  res.status(201).json({ status: 'success', data: { streamUid: uid, uploadURL } });
};

const createSchema = z.object({
  streamUid: z.string().min(1),
  storeId: z.string().refine(mongoose.isValidObjectId, 'invalid storeId'),
  caption: z.string().max(300).optional().default(''),
  hashtags: z.array(z.string()).optional().default([]),
  taggedProducts: z.array(z.string().refine(mongoose.isValidObjectId, 'bad id')).optional().default([]),
  cta: z.object({
    type: z.enum(['shop', 'store', 'none']).default('shop'),
    productId: z.string().refine(mongoose.isValidObjectId, 'bad id').optional(),
    url: z.string().optional().default(''),
  }).optional(),
});

// @desc  Create video metadata after the client uploads  @route POST /api/videos  @access admin
export const createVideo = async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  }
  const d = parsed.data;
  const video = await Video.create({
    store: d.storeId,
    createdByAdmin: req.user._id,
    streamUid: d.streamUid,
    caption: d.caption,
    hashtags: d.hashtags,
    taggedProducts: d.taggedProducts,
    cta: d.cta || { type: 'shop' },
    status: 'processing',
  });
  res.status(201).json({ status: 'success', data: { video } });
};
```

```js
// backend/src/modules/videos/videoRoutes.js
import express from 'express';
import { createUploadUrl, createVideo } from './videoController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Admin authoring
router.post('/upload-url', protect, admin, createUploadUrl);
router.post('/', protect, admin, createVideo);

export default router;
```

In `backend/src/app.js`: add the import beside the others (after line 27) and mount it with the other `/api/*` routes (after line 107):

```js
import videoRoutes from './modules/videos/videoRoutes.js';   // near the other route imports
// ...
app.use('/api/videos', videoRoutes);                          // beside app.use('/api/stores', storeRoutes);
```

- [ ] **Step 4: Run tests, expect pass** — both POST routes now return 401 without auth.

Run: `npm test -- videos.test.js`

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoController.js backend/src/modules/videos/videoRoutes.js backend/src/app.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): admin upload-url + create endpoints"
```

---

## Task 5: Cloudflare webhook — encode status → Mongo

**Files:**
- Create: `backend/src/modules/videos/videoWebhookRoutes.js`
- Modify: `backend/src/modules/videos/videoController.js` (append `handleStreamWebhook`)
- Modify: `backend/src/app.js` (mount raw-body webhook BEFORE `express.json()`)
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces: `handleStreamWebhook(req, res)` — reads `req.body` as a raw `Buffer`, verifies signature, updates the `Video` matching `payload.uid`.

- [ ] **Step 1: Write the failing test** (append)

```js
describe('POST /api/webhooks/cloudflare-stream', () => {
  it('401s when the signature is missing or invalid', async () => {
    const res = await request(app)
      .post('/api/webhooks/cloudflare-stream')
      .set('Content-Type', 'application/json')
      .send({ uid: 'abc', status: { state: 'ready' } });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run, expect fail** — route 404 (not mounted).

- [ ] **Step 3: Implement handler + raw route + mount**

Append to `videoController.js`:

```js
import { verifyWebhookSignature } from '../../services/cloudflareStream.js';

// @desc  Cloudflare Stream status callback  @route POST /api/webhooks/cloudflare-stream  @access signed
export const handleStreamWebhook = async (req, res) => {
  const raw = req.body; // Buffer (mounted with express.raw)
  const ok = verifyWebhookSignature(
    raw,
    req.headers['webhook-signature'],
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
  );
  if (!ok) {
    res.status(401);
    throw new Error('Invalid webhook signature');
  }
  const payload = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  const video = await Video.findOne({ streamUid: payload.uid });
  if (!video) return res.status(200).json({ status: 'success', data: { ignored: true } });

  const state = payload.status?.state;
  if (state === 'ready' || payload.readyToStream) {
    video.status = 'ready';
    video.hlsUrl = payload.playback?.hls || video.hlsUrl;
    video.thumbnailUrl = payload.thumbnail || video.thumbnailUrl;
    video.durationSec = Math.round(payload.duration || video.durationSec);
    if (!video.publishedAt) video.publishedAt = new Date();
  } else if (state === 'error') {
    video.status = 'error';
  }
  await video.save();
  res.status(200).json({ status: 'success', data: { uid: payload.uid, status: video.status } });
};
```

```js
// backend/src/modules/videos/videoWebhookRoutes.js
import express from 'express';
import { handleStreamWebhook } from './videoController.js';

const router = express.Router();
router.post('/', handleStreamWebhook);
export default router;
```

In `backend/src/app.js`, mount it next to the Razorpay webhook (before `express.json()`, around line 48):

```js
import videoWebhookRoutes from './modules/videos/videoWebhookRoutes.js';   // with the route imports
// ...
app.use('/api/webhooks/cloudflare-stream', express.raw({ type: '*/*' }), videoWebhookRoutes);
```

- [ ] **Step 4: Run tests, expect pass** — bad-signature request returns 401.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoWebhookRoutes.js backend/src/modules/videos/videoController.js backend/src/app.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): Cloudflare Stream webhook -> encode status"
```

---

## Task 6: Public reads — feed, single, store grid

**Files:**
- Modify: `backend/src/modules/videos/videoController.js` (append `getFeed`, `getVideo`, `getStoreVideos`)
- Modify: `backend/src/modules/videos/videoRoutes.js` (add public GET routes)
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces: `getFeed` (`GET /api/videos/feed?cursor=&limit=`), `getVideo` (`GET /api/videos/:id`), `getStoreVideos` (`GET /api/videos/store/:storeId`).
- Consumes: `buildFeedQuery`, `nextCursor` from `videoRanking.js`.

- [ ] **Step 1: Write the failing test** (append) — mirror the resilient deals style

```js
describe('GET /api/videos/feed', () => {
  it('returns 200 with a videos array + nextCursor (or skips if no DB)', async () => {
    try {
      const res = await request(app).get('/api/videos/feed');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data.videos)).toBe(true);
      expect(res.body.data).toHaveProperty('nextCursor');
    } catch (error) {
      if (/ECONNREFUSED|MongoNotConnectedError|buffering timed out/.test(error.message)) return;
      throw error;
    }
  });
});
describe('GET /api/videos/:id', () => {
  it('404s for a well-formed but missing id', async () => {
    const res = await request(app).get('/api/videos/000000000000000000000000');
    expect([404, 500]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run, expect fail** — `/feed` returns 404 / `data.videos` undefined.

- [ ] **Step 3: Implement** — append to `videoController.js`:

```js
import { buildFeedQuery, nextCursor } from './videoRanking.js';

const STORE_FIELDS = 'name shortName slug logoUrl isVerified';
const PRODUCT_FIELDS = 'name price mrp images slug';

// @desc  Ranked shoppable feed  @route GET /api/videos/feed  @access public
export const getFeed = async (req, res) => {
  const { filter, sort, limit } = buildFeedQuery(req.query);
  const videos = await Video.find(filter)
    .sort(sort)
    .limit(limit)
    .populate('store', STORE_FIELDS)
    .populate('taggedProducts', PRODUCT_FIELDS)
    .lean();
  res.status(200).json({ status: 'success', data: { videos, nextCursor: nextCursor(videos) } });
};

// @desc  Single video  @route GET /api/videos/:id  @access public
export const getVideo = async (req, res) => {
  const video = await Video.findById(req.params.id)
    .populate('store', STORE_FIELDS)
    .populate('taggedProducts', PRODUCT_FIELDS)
    .lean();
  if (!video) { res.status(404); throw new Error('Video not found'); }
  res.status(200).json({ status: 'success', data: { video } });
};

// @desc  A store's ready videos (profile grid)  @route GET /api/videos/store/:storeId  @access public
export const getStoreVideos = async (req, res) => {
  const videos = await Video.find({
    store: req.params.storeId, status: 'ready', 'moderation.state': 'approved',
  }).sort({ _id: -1 }).limit(60).populate('taggedProducts', PRODUCT_FIELDS).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};
```

Add to `videoRoutes.js` (public GETs — place **above** any `/:id`-style catch to avoid shadowing; `/feed` and `/store/:id` are distinct paths so order is safe, but keep `/:id` last):

```js
import { getFeed, getVideo, getStoreVideos } from './videoController.js';
// public reads
router.get('/feed', getFeed);
router.get('/store/:storeId', getStoreVideos);
router.get('/:id', getVideo);
```

- [ ] **Step 4: Run tests, expect pass** (feed shape asserted; DB-less runs skip gracefully).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoController.js backend/src/modules/videos/videoRoutes.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): public feed, single and store-grid reads"
```

---

## Task 7: Engagement — view, like, save, share

**Files:**
- Modify: `backend/src/modules/videos/videoController.js` (append `trackView`, `toggleLike`, `toggleSave`, `trackShare`)
- Modify: `backend/src/modules/videos/videoRoutes.js`
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces: `trackView` (`POST /:id/view`, `optionalProtect`), `toggleLike`/`toggleSave` (`POST /:id/like|save`, `protect`), `trackShare` (`POST /:id/share`, `optionalProtect`).
- Consumes: `clampWatchSec`, `VideoInteraction`.

- [ ] **Step 1: Write the failing test** (append)

```js
describe('video engagement auth', () => {
  it('view works anonymously (200/404/skip)', async () => {
    try {
      const res = await request(app).post('/api/videos/000000000000000000000000/view').send({ watchSec: 5 });
      expect([200, 404]).toContain(res.statusCode);
    } catch (e) { if (/ECONNREFUSED|MongoNotConnected|buffering/.test(e.message)) return; throw e; }
  });
  it('like requires auth', async () => {
    const res = await request(app).post('/api/videos/000000000000000000000000/like');
    expect(res.statusCode).toBe(401);
  });
  it('save requires auth', async () => {
    const res = await request(app).post('/api/videos/000000000000000000000000/save');
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run, expect fail** — routes 404.

- [ ] **Step 3: Implement** — append to `videoController.js`:

```js
import VideoInteraction from './videoInteractionModel.js';
import { clampWatchSec } from './videoRanking.js';

// @desc  Count a view + add watch seconds  @route POST /:id/view  @access optional
export const trackView = async (req, res) => {
  const video = await Video.findById(req.params.id).select('durationSec');
  if (!video) { res.status(404); throw new Error('Video not found'); }
  const watch = clampWatchSec(req.body?.watchSec, video.durationSec);
  await Video.updateOne({ _id: video._id }, { $inc: { 'stats.views': 1, 'stats.watchSec': watch } });
  res.status(200).json({ status: 'success', data: { ok: true } });
};

// Shared like/save toggle. delta +1 on create, -1 on remove; keeps stats counter in sync.
async function toggle(req, res, type, counter) {
  const videoId = req.params.id;
  const existing = await VideoInteraction.findOne({ user: req.user._id, video: videoId, type });
  let active;
  if (existing) {
    await existing.deleteOne();
    await Video.updateOne({ _id: videoId }, { $inc: { [counter]: -1 } });
    active = false;
  } else {
    await VideoInteraction.create({ user: req.user._id, video: videoId, type });
    await Video.updateOne({ _id: videoId }, { $inc: { [counter]: 1 } });
    active = true;
  }
  res.status(200).json({ status: 'success', data: { active } });
}

export const toggleLike = (req, res) => toggle(req, res, 'like', 'stats.likes');
export const toggleSave = (req, res) => toggle(req, res, 'save', 'stats.saves');

// @desc  Count a share  @route POST /:id/share  @access optional
export const trackShare = async (req, res) => {
  const r = await Video.updateOne({ _id: req.params.id }, { $inc: { 'stats.shares': 1 } });
  if (r.matchedCount === 0) { res.status(404); throw new Error('Video not found'); }
  res.status(200).json({ status: 'success', data: { ok: true } });
};
```

Add to `videoRoutes.js`:

```js
import { optionalProtect } from '../../middleware/authMiddleware.js';
import { trackView, toggleLike, toggleSave, trackShare } from './videoController.js';
router.post('/:id/view', optionalProtect, trackView);
router.post('/:id/share', optionalProtect, trackShare);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/save', protect, toggleSave);
```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoController.js backend/src/modules/videos/videoRoutes.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): view/like/save/share engagement"
```

---

## Task 8: Admin moderation — queue, moderate, delete

**Files:**
- Modify: `backend/src/modules/videos/videoController.js` (append `listPending`, `moderateVideo`, `deleteVideo`)
- Modify: `backend/src/modules/videos/videoRoutes.js`
- Test: `backend/src/__tests__/videos.test.js`

**Interfaces:**
- Produces: `listPending` (`GET /api/videos/admin/queue`), `moderateVideo` (`PATCH /api/videos/admin/:id`), `deleteVideo` (`DELETE /api/videos/:id`) — all `protect, admin`.
- Consumes: `deleteStreamVideo` from the Cloudflare service.

- [ ] **Step 1: Write the failing test** (append)

```js
describe('admin video moderation auth', () => {
  it('queue requires auth', async () => {
    const res = await request(app).get('/api/videos/admin/queue');
    expect(res.statusCode).toBe(401);
  });
  it('moderate requires auth', async () => {
    const res = await request(app).patch('/api/videos/admin/000000000000000000000000').send({ action: 'approve' });
    expect(res.statusCode).toBe(401);
  });
  it('delete requires auth', async () => {
    const res = await request(app).delete('/api/videos/000000000000000000000000');
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run, expect fail** — routes 404.

- [ ] **Step 3: Implement** — append to `videoController.js`:

```js
import { deleteStreamVideo } from '../../services/cloudflareStream.js';

// @desc  Moderation queue (pending, newest first)  @route GET /api/videos/admin/queue  @access admin
export const listPending = async (req, res) => {
  const videos = await Video.find({ 'moderation.state': 'pending' })
    .sort({ _id: -1 }).limit(100).populate('store', STORE_FIELDS).lean();
  res.status(200).json({ status: 'success', data: { videos } });
};

// @desc  Approve/reject/feature  @route PATCH /api/videos/admin/:id  @access admin
export const moderateVideo = async (req, res) => {
  const { action, reason, featured } = req.body;
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  if (action === 'approve') {
    video.moderation = { state: 'approved', reviewedBy: req.user._id, reason: '', at: new Date() };
    if (video.status === 'ready' && !video.publishedAt) video.publishedAt = new Date();
  } else if (action === 'reject') {
    video.moderation = { state: 'rejected', reviewedBy: req.user._id, reason: reason || '', at: new Date() };
    video.status = 'removed';
  }
  if (typeof featured === 'boolean') video.isFeatured = featured;
  await video.save();
  res.status(200).json({ status: 'success', data: { video } });
};

// @desc  Hard remove (also best-effort delete from Cloudflare)  @route DELETE /api/videos/:id  @access admin
export const deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) { res.status(404); throw new Error('Video not found'); }
  try { await deleteStreamVideo(video.streamUid); } catch { /* best effort */ }
  await video.deleteOne();
  res.status(200).json({ status: 'success', data: { deleted: true } });
};
```

Add to `videoRoutes.js` — **admin routes must be declared before `/:id`** so `/admin/queue` isn't captured by `getVideo`:

```js
import { listPending, moderateVideo, deleteVideo } from './videoController.js';
// place these ABOVE router.get('/:id', getVideo)
router.get('/admin/queue', protect, admin, listPending);
router.patch('/admin/:id', protect, admin, moderateVideo);
router.delete('/:id', protect, admin, deleteVideo);
```

> **Route-order note:** in `videoRoutes.js` the final order must be: `/upload-url`, `/`, `/feed`, `/store/:storeId`, `/admin/queue`, `/admin/:id`, engagement `/:id/*`, `/:id` (GET) and `/:id` (DELETE) **last**. Express matches in declaration order; a bare `/:id` above `/admin/queue` would swallow it.

- [ ] **Step 4: Run tests, expect pass** (all three 401 without auth).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/videos/videoController.js backend/src/modules/videos/videoRoutes.js backend/src/__tests__/videos.test.js
git commit -m "feat(videos): admin moderation queue, approve/reject, delete"
```

---

## Task 9: Reconcile cron + env docs + full-suite green

**Files:**
- Create: `backend/src/scripts/reconcileVideos.js`
- Modify: `backend/package.json` (add script)
- Modify/Create: `backend/.env.example`
- Test: `backend/src/__tests__/videos.test.js` (unit test the stuck predicate)

**Interfaces:**
- Produces: `isStuck(video, now, thresholdMin) → boolean` (exported pure helper) + a runnable script that polls Cloudflare for stuck `processing` videos and updates them.

- [ ] **Step 1: Write the failing test** (append)

```js
import { isStuck } from '../scripts/reconcileVideos.js';
describe('reconcileVideos.isStuck', () => {
  const now = new Date('2026-08-08T12:00:00Z');
  it('flags processing videos older than the threshold', () => {
    expect(isStuck({ status: 'processing', createdAt: new Date('2026-08-08T11:40:00Z') }, now, 15)).toBe(true);
  });
  it('ignores recent or non-processing videos', () => {
    expect(isStuck({ status: 'processing', createdAt: new Date('2026-08-08T11:55:00Z') }, now, 15)).toBe(false);
    expect(isStuck({ status: 'ready', createdAt: new Date('2026-08-08T10:00:00Z') }, now, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail** — module missing.

- [ ] **Step 3: Implement**

```js
// backend/src/scripts/reconcileVideos.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Video from '../modules/videos/videoModel.js';
import { fetchStreamStatus } from '../services/cloudflareStream.js';

export function isStuck(video, now = new Date(), thresholdMin = 15) {
  if (video.status !== 'processing') return false;
  return (now - new Date(video.createdAt)) / 60000 >= thresholdMin;
}

export async function reconcileOnce(now = new Date()) {
  const candidates = await Video.find({ status: 'processing' });
  let fixed = 0;
  for (const v of candidates) {
    if (!isStuck(v, now)) continue;
    const s = await fetchStreamStatus(v.streamUid);
    if (!s) continue;
    if (s.state === 'ready' || s.readyToStream) {
      v.status = 'ready';
      v.hlsUrl = s.hls || v.hlsUrl;
      v.thumbnailUrl = s.thumbnail || v.thumbnailUrl;
      v.durationSec = Math.round(s.duration || v.durationSec);
      if (!v.publishedAt) v.publishedAt = new Date();
      await v.save(); fixed++;
    } else if (s.state === 'error') {
      v.status = 'error'; await v.save(); fixed++;
    }
  }
  return fixed;
}

// Run directly: `npm run cron:reconcile-videos`
if (process.argv[1] && process.argv[1].endsWith('reconcileVideos.js')) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => reconcileOnce())
    .then((n) => { console.log(`reconciled ${n} video(s)`); return mongoose.disconnect(); })
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

Add to `backend/package.json` scripts:

```json
"cron:reconcile-videos": "node src/scripts/reconcileVideos.js"
```

Add to `backend/.env.example` (create if missing):

```
# Cloudflare Stream (Videos feature)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_API_TOKEN=
CLOUDFLARE_STREAM_WEBHOOK_SECRET=
```

- [ ] **Step 4: Run the whole suite, expect green**

Run: `npm test`
Expected: `videos.test.js` passes; no regressions in existing suites (DB-dependent assertions skip gracefully when Mongo is absent).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/reconcileVideos.js backend/package.json backend/.env.example backend/src/__tests__/videos.test.js
git commit -m "feat(videos): reconcile cron for stuck encodes + env docs"
```

---

## Self-Review (against PRD §8)

- **§8.1 metadata-only / direct upload** → Task 1 (`createDirectUpload`) + Task 4. ✅
- **§8.3 upload sequence + resilience** → Tasks 4, 5, 9 (webhook + reconcile). ✅
- **§8.5 data model (Video + reuse)** → Task 2; `VideoInteraction` for like/save; `shareModel`/`clickModel` reuse deferred to the client plan where those events originate. ✅
- **§8.6 API surface** → upload-url, create, webhook, feed, single, store grid, view/like/save/share, admin queue/moderate, delete — Tasks 4–8. ✅
- **§8.4 access control (public v1)** → public reads, `optionalProtect` on view/share. Signed-URL gating is a documented later switch, not in scope. ✅
- **§11 moderation** → Task 8 (pending→approve/reject; feed filters `moderation.state:'approved'`). ✅
- **Placeholder scan:** no TBD/TODO; every handler has full code. ✅
- **Type consistency:** `streamUid`, `stats.*`, `moderation.state`, `buildFeedQuery/nextCursor/clampWatchSec`, `STORE_FIELDS/PRODUCT_FIELDS` names consistent across tasks. ✅
- **Known gap (intended):** `uniqueViews`, `productTaps`, `storeTaps` counters exist on the model but are written by client-originated events (clicks) in Plan 3 — the model is ready; endpoints land with the analytics task.

---

## Subsequent plans (sequenced)

Each is its own detailed plan, written when it's next — the API shapes above become its inputs.

- **Plan 2 — Client feed & player (M2):** `expo-video` install; replace `MobileVideosScreen` with a paged `FlatList` feed (viewability-gated single active player + preload-next, Zustand `{activeIndex,muted}`); render Direction B overlay (store pill, caption, docked product card, slim rail); TanStack Query on `GET /videos/feed`; batched `POST /:id/view` watch-time; deep link `videos/:id`.
- **Plan 3 — Shoppable + analytics (M3):** product/store tags → existing `ProductDetailScreen`/store screen; wire `productTaps`/`storeTaps` via `clickModel`; emit the §12 event set; surface `stats` counters.
- **Plan 4 — Admin & upload UI + moderation (M4):** admin upload form (pick via `expo-image-picker` → `POST /upload-url` → direct upload → `POST /videos` → poll status), moderation queue screen (`/admin/queue` + `/admin/:id`), feature toggle, seed content.
- **Plan 5 — Hardening (M5):** perf pass (TTFF, recycle players), error/offline states, cost dashboards, Cloudflare webhook registration runbook, launch checklist.
- **Phase 2+ (later):** business self-serve (`role:'business'` + `Store.owner`, authz-only change), share-to-earn coins on video shares (reuse `shareModel`, 100/day cap), comments/follows/boost.
