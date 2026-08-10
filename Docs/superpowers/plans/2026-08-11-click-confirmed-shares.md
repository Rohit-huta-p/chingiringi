# Click-confirmed shares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop crediting a share on trust; credit it only after someone other than the sharer opens the shared link (server-side click confirmation), and drop the per-share reward to 5 paise.

**Architecture:** A share becomes a `pending` `ShareEvent` with no wallet credit. The shared link points at a public backend endpoint `GET /s/:type/:id?ref=cr_<userId>` that logs the open, applies a pure IP/bot/timing heuristic, and — on the first qualifying open — atomically flips the event to `confirmed` and credits the wallet, then serves an interstitial that opens the app (else web). Expiry and a legacy backfill run as cron scripts mirroring `confirmExpiredLocks.js`.

**Tech Stack:** Node/Express + Mongoose (ESM), Jest + supertest. React Native (Expo).

**Scope:** the confirm mechanic + interstitial with **web fallback**. OUT of scope (fast-follow, needs an EAS rebuild): the app's `chingiringapp://` deep-link *routing* — until it ships, the interstitial simply lands every opener on web, which is correct and testable.

## Global Constraints

- **Reward amount** is `AdminSettings.coinsPerShare`; target value `50` (= ₹0.05 at `coinsPerRupee 1000`). Never hardcode the number; read it from settings. Changing 5-paise economics is a `coinsPerShare` change, never a `coinsPerRupee` change.
- **Coins are withheld until confirmed** — no wallet credit and no `Transaction` at share time; both happen only on confirm.
- **Confirm rule** (pure): confirm iff `status==='pending'` AND `!isLikelyBot(visitorUa)` AND `visitorIp && visitorIp !== sharerIp` AND `ageSeconds >= 15`. `deltaPct`-style `null`/reason on every non-confirm.
- **Bot exclusion is mandatory** — link-preview crawlers (WhatsApp/FB/Telegram) fetch the URL before any human; without filtering they auto-confirm every share.
- **`req.ip` is already correct** — `app.set('trust proxy', 1)` is present (`app.js:35`); do not remove it.
- **Idempotent confirm** — the DB flip is an atomic `findOneAndUpdate({_id, status:'pending'}, …)`; only the winning update credits.
- **The `/s` endpoint must never error out to the opener** — wrap logging/confirm in try/catch and always render the interstitial.
- **Self-describing link:** `${SHARE_BASE}/s/${itemType}/${itemId}?ref=cr_${userId}`, `SHARE_BASE = EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'`.

## File structure

- Create `backend/src/modules/shares/shareConfirm.js` — pure `evaluateShareConfirm` + `isLikelyBot`.
- Create `backend/src/__tests__/shareConfirm.test.js` — unit tests for the above.
- Modify `backend/src/modules/shares/shareModel.js` — `status`/`sharerIp`/`sharerUa`/`confirmedAt` + status index.
- Modify `backend/src/modules/shares/shareController.js` — `createShare` → pending (no credit); `getShareQuota` → add `coinsPerShare`.
- Create `backend/src/modules/shares/shareClickModel.js` — inbound-open log.
- Create `backend/src/modules/shares/shareRedirectController.js` — `GET /s/:type/:id` (log → confirm → interstitial).
- Create `backend/src/modules/shares/shareRedirectRoutes.js` — public router for `/s`.
- Modify `backend/src/app.js` — mount `/s`.
- Modify `backend/src/__tests__/shares.test.js` — `createShare`/`/s` route assertions.
- Modify `backend/src/modules/admin/adminController.js` — share-coin sums filter `status:'confirmed'`.
- Create `backend/src/scripts/expirePendingShares.js` + `backfillShareStatus.js` — cron/one-off scripts; add npm scripts.
- Modify `chingiring-app/src/api/shares.ts` — pending result shape + `coinsPerShare` in quota.
- Modify `chingiring-app/src/components/ShareSheet.tsx` — source the coin amount from quota.
- Modify the 4 detail screens — new link + pending copy.

---

### Task 1: Pure confirm heuristic (`evaluateShareConfirm` + `isLikelyBot`)

**Files:**
- Create: `backend/src/modules/shares/shareConfirm.js`
- Test: `backend/src/__tests__/shareConfirm.test.js`

**Interfaces:**
- Produces:
  - `isLikelyBot(ua: string) => boolean`
  - `evaluateShareConfirm({ status, sharerIp, visitorIp, visitorUa, ageSeconds, minAgeSeconds=15 }) => { confirm: boolean, reason: string }` — reason ∈ `ok|already_confirmed|expired|bot|self_ip|no_visitor_ip|too_soon`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from '@jest/globals';
import { evaluateShareConfirm, isLikelyBot } from '../modules/shares/shareConfirm.js';

const base = { status: 'pending', sharerIp: '1.1.1.1', visitorIp: '2.2.2.2', visitorUa: 'Mozilla/5.0 (iPhone)', ageSeconds: 60 };

describe('isLikelyBot', () => {
  it('flags known preview crawlers, passes real browsers', () => {
    expect(isLikelyBot('facebookexternalhit/1.1')).toBe(true);
    expect(isLikelyBot('WhatsApp/2.23')).toBe(true);
    expect(isLikelyBot('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false);
    expect(isLikelyBot('')).toBe(true); // no UA → treat as bot
  });
});

describe('evaluateShareConfirm', () => {
  it('confirms a different-IP human open after the delay', () => {
    expect(evaluateShareConfirm(base)).toEqual({ confirm: true, reason: 'ok' });
  });
  it('rejects the sharer opening their own link (same IP)', () => {
    expect(evaluateShareConfirm({ ...base, visitorIp: '1.1.1.1' })).toEqual({ confirm: false, reason: 'self_ip' });
  });
  it('rejects preview-bot opens', () => {
    expect(evaluateShareConfirm({ ...base, visitorUa: 'facebookexternalhit/1.1' })).toEqual({ confirm: false, reason: 'bot' });
  });
  it('rejects opens within the min-age window', () => {
    expect(evaluateShareConfirm({ ...base, ageSeconds: 3 })).toEqual({ confirm: false, reason: 'too_soon' });
  });
  it('rejects when already confirmed', () => {
    expect(evaluateShareConfirm({ ...base, status: 'confirmed' })).toEqual({ confirm: false, reason: 'already_confirmed' });
  });
  it('rejects when no visitor IP is known', () => {
    expect(evaluateShareConfirm({ ...base, visitorIp: '' })).toEqual({ confirm: false, reason: 'no_visitor_ip' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- shareConfirm`
Expected: FAIL — cannot find module `shareConfirm.js`.

- [ ] **Step 3: Write the implementation**

```js
// backend/src/modules/shares/shareConfirm.js

// Link-preview crawlers fetch a shared URL before any human clicks. Without
// this, every share auto-confirms from the preview bot.
const BOT_RE = /facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|linkedinbot|discordbot|bot|crawler|spider|preview|curl|wget|python-requests|headless/i;

export function isLikelyBot(ua) {
  if (!ua || !ua.trim()) return true; // no UA → not a real browser open
  return BOT_RE.test(ua);
}

// Pure decision — no I/O. The DB confirm is guarded separately (atomic update).
export function evaluateShareConfirm({ status, sharerIp, visitorIp, visitorUa, ageSeconds, minAgeSeconds = 15 }) {
  if (status === 'confirmed') return { confirm: false, reason: 'already_confirmed' };
  if (status === 'expired')   return { confirm: false, reason: 'expired' };
  if (status !== 'pending')   return { confirm: false, reason: 'not_found' };
  if (isLikelyBot(visitorUa)) return { confirm: false, reason: 'bot' };
  if (!visitorIp)             return { confirm: false, reason: 'no_visitor_ip' };
  if (visitorIp === sharerIp) return { confirm: false, reason: 'self_ip' };
  if (ageSeconds < minAgeSeconds) return { confirm: false, reason: 'too_soon' };
  return { confirm: true, reason: 'ok' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- shareConfirm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shares/shareConfirm.js backend/src/__tests__/shareConfirm.test.js
git commit -m "feat(shares): pure click-confirm heuristic + bot filter with tests"
```

---

### Task 2: `ShareEvent` gains lifecycle fields; `createShare` goes pending; quota exposes `coinsPerShare`

**Files:**
- Modify: `backend/src/modules/shares/shareModel.js`
- Modify: `backend/src/modules/shares/shareController.js` (`createShare` ~24-90, `getShareQuota` ~93-101)
- Modify: `backend/src/__tests__/shares.test.js`

**Interfaces:**
- Produces:
  - `ShareEvent` fields `status:'pending'|'confirmed'|'expired'` (default `pending`), `sharerIp:String`, `sharerUa:String`, `confirmedAt:Date`.
  - `POST /api/shares` → `{ status:'success', data: { status:'pending', shareUrl, remainingToday, duplicate? } }`
  - `GET /api/shares/quota` → `{ …, data: { usedToday, remaining, cap, coinsPerShare } }`
- Consumes: nothing from Task 1 yet.

- [ ] **Step 1: Add the model fields + index**

In `shareModel.js`, add inside the schema (after `day`):

```js
    status:      { type: String, enum: ['pending', 'confirmed', 'expired'], default: 'pending' },
    sharerIp:    { type: String },
    sharerUa:    { type: String },
    confirmedAt: { type: Date },
```

And after the existing indexes:

```js
shareEventSchema.index({ status: 1, createdAt: 1 }); // expiry sweep + pending lookups
```

- [ ] **Step 2: Rewrite `createShare` to create a pending event with no credit**

Replace the body of `createShare` from the `// Credit` block onward. The validation, cap check, and E11000 dedup stay; the wallet credit + Transaction + notify are REMOVED (they move to Task 4). New tail:

```js
  const SHARE_BASE = process.env.SHARE_BASE || 'https://chingiringi-backend.onrender.com';
  const shareUrl = `${SHARE_BASE}/s/${itemType}/${itemId}?ref=cr_${userId}`;

  const day = istDayBucket();
  const todayCount = await ShareEvent.countDocuments({ userId, day });
  const quota = evaluateShareQuota({ todayCount, maxSharesPerDay });
  if (!quota.ok) { res.status(429); throw new Error(quota.message); }

  try {
    await ShareEvent.create({
      userId, itemType, itemId, coinsAwarded: coinsPerShare, day,
      status: 'pending', sharerIp: req.ip, sharerUa: req.headers['user-agent'] || '',
    });
  } catch (err) {
    if (err?.code === 11000) {
      // Already shared this item today — the link is self-describing, so hand
      // back the same URL to re-share; no new pending row, no double-anything.
      return res.json({ status: 'success', data: {
        status: 'pending', shareUrl, duplicate: true,
        remainingToday: Math.max(0, maxSharesPerDay - todayCount),
      }});
    }
    throw err;
  }

  const after = await ShareEvent.countDocuments({ userId, day });
  if (after > maxSharesPerDay) {
    await ShareEvent.deleteOne({ userId, itemType, itemId, day });
    res.status(429);
    throw new Error('Daily share limit reached');
  }

  res.status(201).json({ status: 'success', data: {
    status: 'pending', shareUrl,
    remainingToday: Math.max(0, maxSharesPerDay - after),
  }});
};
```

(Delete the old `ensureWallet` credit block, the `Transaction.create`, and the `notify` call from `createShare`. `ensureWallet` stays in the file — Task 4 uses it.)

- [ ] **Step 3: Expose `coinsPerShare` on the quota**

In `getShareQuota`, add `coinsPerShare` to the response:

```js
  res.json({ status: 'success', data: {
    usedToday, remaining: Math.max(0, settings.maxSharesPerDay - usedToday),
    cap: settings.maxSharesPerDay, coinsPerShare: settings.coinsPerShare,
  }});
```

- [ ] **Step 4: Update the auth-boundary test to assert the new contract shape**

`shares.test.js` currently only checks 401s (no DB). Keep those; add a documentation-level assertion that `POST /api/shares` still requires auth (unchanged) — no new DB test (no Mongo harness in this repo). Confirm the file still passes:

```js
it('POST /api/shares still requires auth (pending flow, no anonymous shares)', async () => {
  const res = await request(app).post('/api/shares').send({ itemType: 'product', itemId: 'x' });
  expect(res.statusCode).toBe(401);
});
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npm test -- shares`
Expected: PASS (auth-boundary suite green; nothing credits at share time now).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/shares/shareModel.js backend/src/modules/shares/shareController.js backend/src/__tests__/shares.test.js
git commit -m "feat(shares): createShare creates a pending event (no credit); quota exposes coinsPerShare"
```

---

### Task 3: Inbound-open log model (`ShareClick`)

**Files:**
- Create: `backend/src/modules/shares/shareClickModel.js`

**Interfaces:**
- Produces: `ShareClick` model — `{ shareEventId, sharerUserId, itemType, itemId, visitorIp, visitorUa, confirmed, reason }` + timestamps.

- [ ] **Step 1: Write the model**

```js
// backend/src/modules/shares/shareClickModel.js
import mongoose from 'mongoose';

// One row per inbound open of a /s/... share link. Audit trail + abuse review;
// `confirmed`/`reason` record what evaluateShareConfirm decided for this open.
const shareClickSchema = new mongoose.Schema(
  {
    shareEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShareEvent', index: true },
    sharerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    itemType:     { type: String },
    itemId:       { type: mongoose.Schema.Types.ObjectId },
    visitorIp:    { type: String },
    visitorUa:    { type: String },
    confirmed:    { type: Boolean, default: false },
    reason:       { type: String },
  },
  { timestamps: true },
);

const ShareClick = mongoose.model('ShareClick', shareClickSchema);
export default ShareClick;
```

- [ ] **Step 2: Sanity-check the model loads (no DB)**

Run: `cd backend && node --input-type=module -e "import('./src/modules/shares/shareClickModel.js').then(m=>{console.log(m.default.modelName); process.exit(m.default.modelName==='ShareClick'?0:1)})"`
Expected: prints `ShareClick`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/shares/shareClickModel.js
git commit -m "feat(shares): ShareClick model for inbound-open audit"
```

---

### Task 4: `GET /s/:type/:id` — log, confirm-and-credit, interstitial

**Files:**
- Create: `backend/src/modules/shares/shareRedirectController.js`
- Create: `backend/src/modules/shares/shareRedirectRoutes.js`
- Modify: `backend/src/app.js` (mount `/s`, import near the other route imports + `app.use` after the json body parser, before `notFound`)
- Modify: `backend/src/__tests__/shares.test.js` (route-shape assertions)

**Interfaces:**
- Consumes: `evaluateShareConfirm` (Task 1); `ShareEvent` fields (Task 2); `ShareClick` (Task 3); `istDayBucket`, `Wallet`, `Transaction`, `notify`, `AdminSettings`.
- Produces: `GET /s/:type/:id?ref=cr_<userId>` → 200 HTML interstitial (always), with confirm-and-credit side effect.

- [ ] **Step 1: Write the controller**

```js
// backend/src/modules/shares/shareRedirectController.js
import mongoose from 'mongoose';
import ShareEvent from './shareModel.js';
import ShareClick from './shareClickModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import { notify } from '../notifications/notificationService.js';
import { evaluateShareConfirm } from './shareConfirm.js';

const SCHEME   = process.env.SHARE_APP_SCHEME || 'chingiringapp';
const WEB_BASE = process.env.SHARE_WEB_BASE || 'https://chingiring.com';
const VALID_TYPES = new Set(['product', 'store']);

function parseSharerId(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('cr_')) return null;
  const id = ref.slice(3);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

// Attempts the app; falls back to web after ~1.5s unless the app took over
// (page goes hidden). Manual link covers in-app browsers that block schemes.
function interstitial(type, id) {
  const appUrl = `${SCHEME}://${type}/${id}`;
  const webUrl = `${WEB_BASE}/${type}/${id}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening…</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#1e1b45">
<p style="font-size:16px">Opening in the app…</p>
<p><a id="web" href="${webUrl}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#5b4be6;color:#fff;border-radius:10px;text-decoration:none">Continue on web</a></p>
<script>
(function(){var app=${JSON.stringify(appUrl)},web=${JSON.stringify(webUrl)};
var t=setTimeout(function(){location.href=web},1500);
document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(t)});
location.href=app;})();
</script></body></html>`;
}

async function confirmAndCredit(ev) {
  // Atomic guard: only the update that flips pending→confirmed credits.
  const won = await ShareEvent.findOneAndUpdate(
    { _id: ev._id, status: 'pending' },
    { $set: { status: 'confirmed', confirmedAt: new Date() } },
    { new: true },
  );
  if (!won) return false; // someone else confirmed first
  let wallet = await Wallet.findOne({ userId: ev.userId });
  if (!wallet) wallet = await Wallet.create({ userId: ev.userId });
  wallet.coins += ev.coinsAwarded;
  wallet.lifetimeEarned += ev.coinsAwarded;
  await wallet.save();
  await Transaction.create({
    userId: ev.userId, type: 'coin_credit', amount: ev.coinsAwarded, status: 'confirmed',
    description: `Share reward — ${ev.itemType}`,
    metadata: { reason: 'share', itemType: ev.itemType, itemId: String(ev.itemId) },
  });
  notify({ userId: ev.userId, type: 'wallet_credited', data: { amount: ev.coinsAwarded, currency: 'coins' } }).catch(() => {});
  return true;
}

// GET /s/:type/:id?ref=cr_<userId>
export const shareRedirect = async (req, res) => {
  const { type, id } = req.params;
  // Invalid links still get a graceful landing — never 4xx the opener.
  if (!VALID_TYPES.has(type) || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(200).send(interstitial(VALID_TYPES.has(type) ? type : 'product', id));
  }

  try {
    const sharerId = parseSharerId(req.query.ref);
    if (sharerId) {
      // Most recent still-pending share of this item by this user, within 30d.
      const ev = await ShareEvent.findOne({
        userId: sharerId, itemType: type, itemId: id, status: 'pending',
      }).sort({ createdAt: -1 });

      if (ev) {
        const visitorIp = req.ip;
        const visitorUa = req.headers['user-agent'] || '';
        const ageSeconds = (Date.now() - new Date(ev.createdAt).getTime()) / 1000;
        const decision = evaluateShareConfirm({
          status: ev.status, sharerIp: ev.sharerIp, visitorIp, visitorUa, ageSeconds,
        });
        let confirmed = false;
        if (decision.confirm) confirmed = await confirmAndCredit(ev);
        ShareClick.create({
          shareEventId: ev._id, sharerUserId: sharerId, itemType: type, itemId: id,
          visitorIp, visitorUa, confirmed, reason: decision.reason,
        }).catch(() => {});
      }
    }
  } catch (err) {
    // Never fail the opener's landing on a logging/confirm error.
    console.error('[shareRedirect] confirm error:', err?.message);
  }

  return res.status(200).send(interstitial(type, id));
};
```

- [ ] **Step 2: Write the route + mount it**

```js
// backend/src/modules/shares/shareRedirectRoutes.js
import express from 'express';
import { shareRedirect } from './shareRedirectController.js';

const router = express.Router();
router.get('/:type/:id', shareRedirect); // public, no auth — the opener is a friend
export default router;
```

In `app.js`, import alongside the other route imports:

```js
import shareRedirectRoutes from './modules/shares/shareRedirectRoutes.js';
```

and mount it with the other `app.use('/api/...')` routes (it's public, outside `/api`):

```js
app.use('/s', shareRedirectRoutes);
```

- [ ] **Step 3: Add route-shape tests (no DB)**

Append to `shares.test.js`:

```js
describe('Share redirect /s', () => {
  it('returns a 200 interstitial for a well-formed link', async () => {
    const res = await request(app).get('/s/product/64f8a2b9c1d2e3f4a5b6c7d8?ref=cr_64f8a2b9c1d2e3f4a5b6c7d8');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('chingiringapp://product/');
  });
  it('never 4xxs the opener, even on a garbage id', async () => {
    const res = await request(app).get('/s/product/not-an-id?ref=cr_x');
    expect(res.statusCode).toBe(200);
  });
});
```

(These exercise the no-DB paths: a well-formed link with no matching pending event still renders the interstitial; a bad id still lands gracefully. The confirm/credit logic itself is covered by Task 1's unit tests.)

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test -- shares shareConfirm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shares/shareRedirectController.js backend/src/modules/shares/shareRedirectRoutes.js backend/src/app.js backend/src/__tests__/shares.test.js
git commit -m "feat(shares): /s redirect endpoint — log, confirm+credit, app-or-web interstitial"
```

---

### Task 5: Dashboard counts confirmed share-coins only

**Files:**
- Modify: `backend/src/modules/admin/adminController.js` (`getDashboardStats`)

**Interfaces:**
- Consumes: `ShareEvent.status` (Task 2).

- [ ] **Step 1: Filter every `ShareEvent.coinsAwarded` sum to confirmed**

In `getDashboardStats`, the four aggregations that sum `coinsAwarded` must only count confirmed events (pending/expired coins were never paid). Update:

- all-time coins (was `ShareEvent.aggregate([{ $group: { _id: null, c: { $sum: '$coinsAwarded' } } }])`):
```js
    ShareEvent.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
```
- last-30d coins (`{ $match: last30 }`): change to `{ $match: { ...last30, status: 'confirmed' } }`.
- prior-30d coins (`{ $match: prior30 }`): change to `{ $match: { ...prior30, status: 'confirmed' } }`.
- top sharers `coins`: add a `$match` stage first:
```js
    ShareEvent.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$userId', shares: { $sum: 1 }, coins: { $sum: '$coinsAwarded' } } },
      { $sort: { shares: -1 } }, { $limit: 5 },
    ]),
```

(Share *count* metrics — totalShares, sharesToday, trend, top shared items — stay as-is: they measure share activity, pending included. Only coin sums gate on confirmed, because only confirmed coins exist.)

- [ ] **Step 2: Typecheck-free JS — run the dashboard tests**

Run: `cd backend && npm test -- adminDashboard`
Expected: PASS (pure-helper + route tests unaffected).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/admin/adminController.js
git commit -m "fix(dashboard): count confirmed share-coins only (pending never paid)"
```

---

### Task 6: Expiry sweep + legacy backfill scripts

**Files:**
- Create: `backend/src/scripts/expirePendingShares.js`
- Create: `backend/src/scripts/backfillShareStatus.js`
- Modify: `backend/package.json` (add npm scripts)

**Interfaces:**
- Consumes: `ShareEvent.status`.

- [ ] **Step 1: Write the expiry script (mirror `confirmExpiredLocks.js` shape)**

```js
// backend/src/scripts/expirePendingShares.js
// Pending shares nobody opened within the window never pay. Cron hourly/daily:
//   node src/scripts/expirePendingShares.js   (npm run cron:expire-shares)
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import ShareEvent from '../modules/shares/shareModel.js';

const DAYS = Number(process.env.SHARE_PENDING_DAYS) || 30;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const r = await ShareEvent.updateMany(
    { status: 'pending', createdAt: { $lt: cutoff } },
    { $set: { status: 'expired' } },
  );
  console.log(`[expire-shares] expired ${r.modifiedCount} pending shares older than ${DAYS}d`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Write the one-off backfill (legacy rows predate `status`)**

```js
// backend/src/scripts/backfillShareStatus.js
// Rows created under instant-credit have no `status` and were already paid →
// mark them confirmed so dashboard confirmed-coin sums include them. Run once.
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import ShareEvent from '../modules/shares/shareModel.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await ShareEvent.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'confirmed' } },
  );
  console.log(`[backfill] marked ${r.modifiedCount} legacy shares confirmed`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add npm scripts**

In `backend/package.json` `scripts`, add (matching the existing `cron:confirm-locks` style):

```json
    "cron:expire-shares": "node src/scripts/expirePendingShares.js",
    "migrate:share-status": "node src/scripts/backfillShareStatus.js",
```

- [ ] **Step 4: Verify the scripts parse (no DB connect)**

Run: `cd backend && node --check src/scripts/expirePendingShares.js && node --check src/scripts/backfillShareStatus.js && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/expirePendingShares.js backend/src/scripts/backfillShareStatus.js backend/package.json
git commit -m "feat(shares): pending-share expiry sweep + legacy status backfill scripts"
```

---

### Task 7: App — new share link, pending copy, coin amount from settings

**Files:**
- Modify: `chingiring-app/src/api/shares.ts`
- Modify: `chingiring-app/src/components/ShareSheet.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/ProductDetailScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/MobileProductDetailScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/StoreDetailScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx`

**Interfaces:**
- Consumes: `POST /api/shares` pending shape + `GET /api/shares/quota` `coinsPerShare` (Task 2).

- [ ] **Step 1: Update the API types**

In `shares.ts`: change `ShareResult` and `ShareQuota`:

```ts
export interface ShareResult {
  status: 'pending';
  shareUrl: string;
  remainingToday: number;
  duplicate?: boolean;
}

export interface ShareQuota {
  usedToday: number;
  remaining: number;
  cap: number;
  coinsPerShare: number;
}
```

- [ ] **Step 2: Source the coin amount from settings in `ShareSheet`**

`ShareSheet` currently hardcodes `coins = 100`. Make it read `coinsPerShare` from the quota so the promise matches the payout. Add near the top of the component:

```tsx
import { useQuery } from '@tanstack/react-query';
import { sharesAPI } from '../api/shares';
// ...
const { data: quota } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota, staleTime: 60_000 });
const coinAmount = quota?.data?.coinsPerShare ?? coins; // `coins` prop stays as fallback
```

Then render `coinAmount` in place of `coins` in the "Earn {coins} CR" text (`ShareSheet.tsx:92`).

- [ ] **Step 3: Point the share link at the backend `/s` route (all 4 screens)**

Replace each screen's share-URL construction. The base becomes the backend host and the path becomes `/s/<type>/<id>`:

- `ProductDetailScreen.tsx:200,203,551` and `MobileProductDetailScreen.tsx:493`:
```ts
const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
// product link:
`${base}/s/product/${productId}?ref=cr_${user?.id ?? ''}`
```
- `OfflineStoresScreen.tsx:543` and `StoreDetailScreen.tsx:90` (also fixes the stale `chingiring.app`):
```ts
const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
`${base}/s/store/${store._id}?ref=cr_${user?.id ?? ''}`
```

- [ ] **Step 4: Change the post-share message to "pending"**

Each screen calls `sharesAPI.postShare(...)` in its `onShared` handler and shows a success Alert. Replace the "earned" wording with pending, and read the amount from quota instead of assuming 100. Example (apply the same in all 4):

```tsx
await sharesAPI.postShare(type, id);
Alert.alert('Shared!', `${quota?.data?.coinsPerShare ?? 50} CR pending — it unlocks when a friend opens your link.`);
```

(Remove any copy that says coins were credited immediately. Keep the existing `queryClient.invalidateQueries` for `['wallet']`/`['walletSummary']`/`['shareQuota']`.)

- [ ] **Step 5: Typecheck**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors from the touched files (pre-existing `MyAddressScreen.tsx:124` may remain).

- [ ] **Step 6: Commit**

```bash
git add chingiring-app/src/api/shares.ts chingiring-app/src/components/ShareSheet.tsx chingiring-app/src/screens/Dashboard/ProductDetailScreen.tsx chingiring-app/src/screens/Dashboard/MobileProductDetailScreen.tsx chingiring-app/src/screens/Dashboard/StoreDetailScreen.tsx chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx
git commit -m "feat(shares): app posts pending shares, links via /s backend redirect, reads reward from settings"
```

---

## Self-review

**Spec coverage:** pending lifecycle → Task 2 (model + createShare). Confirm heuristic + bot + trust-proxy → Task 1 (pure) + Task 4 (uses `req.ip`, already trust-proxied). `/s` endpoint + interstitial (app→web) → Task 4. Confirm=credit (moved from createShare) → Task 4 `confirmAndCredit`. Expiry + backfill → Task 6. Daily cap/dedup unchanged → Task 2 keeps them. `coinsPerShare=50` + read-from-settings → Task 2 (quota) + Task 7 (ShareSheet/copy); the value flip itself is a launch step (below). Dashboard confirmed-only → Task 5. App link/copy → Task 7. ShareClick audit → Task 3. All spec sections covered. (Deep-link app *routing* intentionally deferred — noted in Scope.)

**Placeholder scan:** every code step is complete; no TBD/"similar to"; list edits shown per file.

**Type consistency:** `evaluateShareConfirm`/`isLikelyBot` signatures match Task 1 ↔ Task 4 usage. `createShare` returns `{status:'pending', shareUrl, remainingToday}` (Task 2) = `ShareResult` (Task 7). `getShareQuota` adds `coinsPerShare` (Task 2) = `ShareQuota.coinsPerShare` (Task 7). `ShareEvent.status` enum consistent across Tasks 2/4/5/6. `confirmAndCredit` uses `ev.coinsAwarded`/`ev.userId`/`ev.itemType` — all real `ShareEvent` fields.

## Launch steps (config, after merge — not code)

1. Flip stored `coinsPerShare` 100 → 50 (`PATCH /api/admin/settings`), and confirm `coinsPerRupee = 1000`.
2. Run once: `npm run migrate:share-status` (backfill legacy rows to confirmed).
3. Schedule `npm run cron:expire-shares` (hourly/daily) — same as `cron:confirm-locks`.
4. Set env if overriding defaults: `SHARE_BASE`, `SHARE_WEB_BASE`, `SHARE_APP_SCHEME`.
5. App ships via EAS (the link change is in the RN bundle).

## Risks

- IP heuristic: a 2nd device on mobile data self-confirms; same-home-WiFi friends won't confirm. Accepted; `ShareClick` gives an audit trail for later abuse-scoring.
- Bot denylist is UA-based — a UA-less prefetch slips through (rare); min-age is a weak backstop.
- Web fallback needs a real `${SHARE_WEB_BASE}/<type>/:id` page to land on; until then it points at a placeholder.
