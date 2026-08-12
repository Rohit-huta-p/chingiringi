# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a two-sided referral loop — a shareable code, a smart install link, code capture at signup, and a bonus (referrer ₹25 / referee ₹5) that pays only after the referee logs in via the app.

**Architecture:** Referral state lives on the referee's `User` doc (`referredBy` + new `referralStatus`) — no new collection. A small `referrals/` backend module owns three protected endpoints (`apply` at signup, `claim` on app-login, `stats`) plus a public `/r/:code` interstitial that opens the app or sends the visitor to the right store. Payout reuses the proven `adjustUserWallet` credit primitive (`wallet.coins += n`, `Transaction{type:'referral'}`, `notify('wallet_credited')`). Decidable logic is extracted into a pure `referralService.js` so it's unit-testable without a DB (the repo's test bar).

**Tech Stack:** Node/Express (ESM), Mongoose 9, Zod 4, Jest 30 + supertest (no test DB — pure + 401-gate tests only). App: React Native / Expo, axios `apiClient`, Zustand store, React Query.

## Global Constraints

- **Coin exchange rate:** `coinsPerRupee = 1000` (1 coin = ₹0.001). Reward amounts are **separate knobs** — NEVER change `coinsPerRupee` to alter a reward.
- **Reward amounts:** referrer **25,000 coins (₹25)**, referee **5,000 coins (₹5)**. Config-driven via `AdminSettings`.
- **Payout gate:** bonus is `pending` at signup, `confirmed` only when the **referee's app client** calls `claim` (native only — the web client must never call it).
- **Deep-link scheme:** `chingiring://` (from `app.json` — one trailing `i`). NOT `chingiringi://`, NOT `chingiringapp://`.
- **Credit target:** referral coins go to spendable `wallet.coins` (not `pendingCoins`).
- **Best-effort side-effects:** every `notify(...)` and every `claim()`/`apply()` client call is wrapped so a failure never breaks the trigger (signup, login, redirect).
- **Test bar:** no DB in tests. Test pure functions directly; test routes only for the 401/200 gate via supertest. Do NOT add `mongodb-memory-server`.
- **Money path:** the pure decision helpers (`canApplyReferral`, `referralConfirmDecision`, `pickStoreUrl`) MUST have unit tests.
- **App ships via EAS**, not a main merge. The deep-link autofill needs an EAS rebuild; manual code entry is the fallback until then.

---

## File Structure

**Backend (new):**
- `backend/src/modules/referrals/referralService.js` — pure helpers (no I/O).
- `backend/src/modules/referrals/referralController.js` — apply / claim / stats + local credit helper.
- `backend/src/modules/referrals/referralRoutes.js` — protected `/api/referrals` router.
- `backend/src/modules/referrals/referralRedirect.js` — public `GET /r/:code` interstitial handler.
- `backend/src/scripts/backfillReferralCodes.js` — one-off migration.
- `backend/src/__tests__/referralService.test.js`, `backend/src/__tests__/referrals.test.js`.

**Backend (modified):**
- `backend/src/modules/users/userModel.js` — add `referralStatus`.
- `backend/src/modules/admin/adminSettingsModel.js` — add two knobs.
- `backend/src/app.js` — mount `/api/referrals` and `/r`.

**App (new):**
- `chingiring-app/src/api/referrals.ts` — `apply` / `claim` / `getStats`.

**App (modified):**
- `chingiring-app/src/store/index.ts` — native-only `claim()` in `hydrate`.
- `chingiring-app/src/screens/Auth/SignupScreen.tsx` — referral field + autofill + `apply`.
- `chingiring-app/src/navigation/linking.ts` — add `chingiring://` prefix + `ref` param on Signup.
- `chingiring-app/src/screens/Dashboard/MobileProfileScreen.tsx` — wire stats + fix copy + link.

---

## Task 1: AdminSettings referral knobs

**Files:**
- Modify: `backend/src/modules/admin/adminSettingsModel.js:28` (after `coinsPerShare`)
- Test: `backend/src/__tests__/referralSettings.test.js` (create)

**Interfaces:**
- Produces: `AdminSettings.get()` resolves a doc with `coinsPerReferralReferrer` (default 25000) and `coinsPerReferralReferee` (default 5000).

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/referralSettings.test.js
import { describe, it, expect } from '@jest/globals';
import AdminSettings from '../modules/admin/adminSettingsModel.js';

describe('AdminSettings referral knobs', () => {
  it('schema defaults are 25000 / 5000', () => {
    const path = AdminSettings.schema.path('coinsPerReferralReferrer');
    expect(path).toBeTruthy();
    expect(path.options.default).toBe(25000);
    expect(AdminSettings.schema.path('coinsPerReferralReferee').options.default).toBe(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- referralSettings`
Expected: FAIL — `path` is undefined.

- [ ] **Step 3: Add the knobs**

In `adminSettingsModel.js`, immediately after the `coinsPerShare` line:

```javascript
    // Referral economy — separate knobs from coinsPerRupee. ₹25 / ₹5 at 1000.
    coinsPerReferralReferrer: { type: Number, default: 25000, min: 0 },
    coinsPerReferralReferee:  { type: Number, default: 5000,  min: 0 },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- referralSettings`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/admin/adminSettingsModel.js backend/src/__tests__/referralSettings.test.js
git commit -m "feat(referral): add referrer/referee coin reward knobs to AdminSettings"
```

---

## Task 2: User `referralStatus` field + code backfill

**Files:**
- Modify: `backend/src/modules/users/userModel.js:57` (after `referredBy`)
- Create: `backend/src/scripts/backfillReferralCodes.js`
- Test: `backend/src/__tests__/referralUserModel.test.js` (create)

**Interfaces:**
- Produces: `User.referralStatus` — enum `'pending' | 'confirmed' | 'expired'`, indexed, absent by default.

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/referralUserModel.test.js
import { describe, it, expect } from '@jest/globals';
import User from '../modules/users/userModel.js';

describe('User referralStatus', () => {
  it('is an indexed pending/confirmed/expired enum with no default', () => {
    const p = User.schema.path('referralStatus');
    expect(p).toBeTruthy();
    expect(p.enumValues).toEqual(['pending', 'confirmed', 'expired']);
    expect(p.options.default).toBeUndefined();
    expect(p.options.index).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- referralUserModel`
Expected: FAIL — path undefined.

- [ ] **Step 3: Add the field**

In `userModel.js`, right after the `referredBy` field block:

```javascript
    // Referral lifecycle for a REFERRED user. Absent for organic signups.
    // pending = code applied at signup; confirmed = paid on first app login;
    // expired = never opened the app within the lock window.
    referralStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'expired'],
      index: true,
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- referralUserModel`
Expected: PASS

- [ ] **Step 5: Write the backfill script**

`referralCode` has a schema `default`, so new users always get one; only users created before the field existed can be blank. The `unique` index is NOT `sparse`, so 2+ blank codes collide — backfill before that bites.

```javascript
// backend/src/scripts/backfillReferralCodes.js
import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../modules/users/userModel.js';

// Give any user without a referralCode a unique one. Idempotent; safe to re-run.
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const blanks = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }] }).select('_id');
  let fixed = 0;
  for (const u of blanks) {
    // Retry on the rare unique collision.
    for (let i = 0; i < 5; i++) {
      try {
        u.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        await u.save({ validateBeforeSave: false });
        fixed++;
        break;
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }
    }
  }
  console.log(`Backfilled ${fixed}/${blanks.length} referral codes.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/users/userModel.js backend/src/scripts/backfillReferralCodes.js backend/src/__tests__/referralUserModel.test.js
git commit -m "feat(referral): add User.referralStatus + referralCode backfill script"
```

---

## Task 3: Pure decision helpers (`referralService.js`)

**Files:**
- Create: `backend/src/modules/referrals/referralService.js`
- Test: `backend/src/__tests__/referralService.test.js`

**Interfaces:**
- Produces:
  - `pickStoreUrl(ua, { ios, android, web }) → string`
  - `canApplyReferral({ referrerId, refereeId, refereeReferredBy, refereeCreatedAtMs, nowMs, windowMs }) → { ok: boolean, reason: string }` — reasons: `ok | invalid_code | self | already_referred | too_old`
  - `referralConfirmDecision({ status, refereeCreatedAtMs, nowMs, lockDays }) → { confirm: boolean, reason: string }` — reasons: `ok | not_pending | expired`
  - `APPLY_WINDOW_MS = 48h`

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/referralService.test.js
import { describe, it, expect } from '@jest/globals';
import { pickStoreUrl, canApplyReferral, referralConfirmDecision, APPLY_WINDOW_MS } from '../modules/referrals/referralService.js';

const URLS = { ios: 'IOS', android: 'AND', web: 'WEB' };

describe('pickStoreUrl', () => {
  it('routes by device UA, defaults to web', () => {
    expect(pickStoreUrl('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', URLS)).toBe('IOS');
    expect(pickStoreUrl('Mozilla/5.0 (iPad)', URLS)).toBe('IOS');
    expect(pickStoreUrl('Mozilla/5.0 (Linux; Android 14)', URLS)).toBe('AND');
    expect(pickStoreUrl('Mozilla/5.0 (Windows NT 10.0)', URLS)).toBe('WEB');
    expect(pickStoreUrl('', URLS)).toBe('WEB');
  });
});

describe('canApplyReferral', () => {
  const base = { referrerId: 'A', refereeId: 'B', refereeReferredBy: null, refereeCreatedAtMs: 1000, nowMs: 1000, windowMs: APPLY_WINDOW_MS };
  it('accepts a fresh, un-referred, non-self referee', () => {
    expect(canApplyReferral(base)).toEqual({ ok: true, reason: 'ok' });
  });
  it('rejects a missing referrer (invalid code)', () => {
    expect(canApplyReferral({ ...base, referrerId: null })).toEqual({ ok: false, reason: 'invalid_code' });
  });
  it('rejects self-referral', () => {
    expect(canApplyReferral({ ...base, refereeId: 'A' })).toEqual({ ok: false, reason: 'self' });
  });
  it('rejects an already-referred user', () => {
    expect(canApplyReferral({ ...base, refereeReferredBy: 'X' })).toEqual({ ok: false, reason: 'already_referred' });
  });
  it('rejects an account older than the apply window', () => {
    expect(canApplyReferral({ ...base, nowMs: 1000 + APPLY_WINDOW_MS + 1 })).toEqual({ ok: false, reason: 'too_old' });
  });
});

describe('referralConfirmDecision', () => {
  const base = { status: 'pending', refereeCreatedAtMs: 1000, nowMs: 1000, lockDays: 30 };
  it('confirms a fresh pending referral', () => {
    expect(referralConfirmDecision(base)).toEqual({ confirm: true, reason: 'ok' });
  });
  it('does not confirm a non-pending referral', () => {
    expect(referralConfirmDecision({ ...base, status: 'confirmed' })).toEqual({ confirm: false, reason: 'not_pending' });
    expect(referralConfirmDecision({ ...base, status: undefined })).toEqual({ confirm: false, reason: 'not_pending' });
  });
  it('expires a pending referral past the lock window', () => {
    const past = 1000 + 31 * 24 * 60 * 60 * 1000;
    expect(referralConfirmDecision({ ...base, nowMs: past })).toEqual({ confirm: false, reason: 'expired' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- referralService`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// backend/src/modules/referrals/referralService.js
// Pure helpers — no DB, no req/res. Everything decidable about a referral.

export const APPLY_WINDOW_MS = 48 * 60 * 60 * 1000; // ponytail: retro-apply guard; widen if support asks

// Which store/page a not-installed visitor should land on, by device UA.
export function pickStoreUrl(ua, { ios, android, web }) {
  const s = String(ua || '');
  if (/iphone|ipad|ipod/i.test(s)) return ios;
  if (/android/i.test(s)) return android;
  return web;
}

// Can this code be captured onto this new user? (guards, not I/O)
export function canApplyReferral({ referrerId, refereeId, refereeReferredBy, refereeCreatedAtMs, nowMs, windowMs = APPLY_WINDOW_MS }) {
  if (!referrerId) return { ok: false, reason: 'invalid_code' };
  if (String(referrerId) === String(refereeId)) return { ok: false, reason: 'self' };
  if (refereeReferredBy) return { ok: false, reason: 'already_referred' };
  if (nowMs - refereeCreatedAtMs > windowMs) return { ok: false, reason: 'too_old' };
  return { ok: true, reason: 'ok' };
}

// Should a claim confirm+pay this referee's referral right now?
export function referralConfirmDecision({ status, refereeCreatedAtMs, nowMs, lockDays = 30 }) {
  if (status !== 'pending') return { confirm: false, reason: 'not_pending' };
  if (nowMs - refereeCreatedAtMs > lockDays * 24 * 60 * 60 * 1000) return { confirm: false, reason: 'expired' };
  return { confirm: true, reason: 'ok' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- referralService`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/referrals/referralService.js backend/src/__tests__/referralService.test.js
git commit -m "feat(referral): pure decision helpers (store routing, apply/confirm guards)"
```

---

## Task 4: Referral API — apply / claim / stats

**Files:**
- Create: `backend/src/modules/referrals/referralController.js`
- Create: `backend/src/modules/referrals/referralRoutes.js`
- Modify: `backend/src/app.js` (import + mount `/api/referrals`)
- Test: `backend/src/__tests__/referrals.test.js`

**Interfaces:**
- Consumes: `referralService` (Task 3), `AdminSettings` knobs (Task 1), `User.referralStatus` (Task 2), `Wallet`, `Transaction`, `notify`.
- Produces (routes, all `protect`ed):
  - `POST /api/referrals/apply { code }` → `{ status, data: { applied: boolean, reason } }`
  - `POST /api/referrals/claim` → `{ status, data: { credited: boolean, refereeCoins? } }`
  - `GET /api/referrals/stats` → `{ status, data: { referralCode, confirmedCount, pendingCount, earningsCoins, referrerRupees, refereeRupees } }`

- [ ] **Step 1: Write the failing test (auth gate — the repo's route-test bar)**

```javascript
// backend/src/__tests__/referrals.test.js
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Referrals API auth', () => {
  it('POST /api/referrals/apply requires auth', async () => {
    const res = await request(app).post('/api/referrals/apply').send({ code: 'ABCD1234' });
    expect(res.statusCode).toBe(401);
  });
  it('POST /api/referrals/claim requires auth', async () => {
    const res = await request(app).post('/api/referrals/claim').send({});
    expect(res.statusCode).toBe(401);
  });
  it('GET /api/referrals/stats requires auth', async () => {
    const res = await request(app).get('/api/referrals/stats');
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- referrals`
Expected: FAIL — 404 (routes not mounted) instead of 401.

- [ ] **Step 3: Write the controller**

```javascript
// backend/src/modules/referrals/referralController.js
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../users/userModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import { canApplyReferral, referralConfirmDecision } from './referralService.js';

async function ensureWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

// Credit spendable coins the way adjustUserWallet does: wallet + ledger + notify,
// in lock-step so the audit trail can never disagree with the balance.
async function creditReferralCoins(userId, coins, role) {
  const wallet = await ensureWallet(userId);
  wallet.coins += coins;
  wallet.lifetimeEarned += coins;
  await wallet.save();
  await Transaction.create({
    userId,
    type: 'referral',
    amount: coins,
    status: 'confirmed',
    description: `Referral bonus (${role})`,
    metadata: { reason: 'referral', role },
  });
  try {
    await notify({ userId, type: 'wallet_credited', data: { amount: coins, currency: 'coins' } });
  } catch (e) { /* best-effort: notification must never break the credit */ }
}

// POST /api/referrals/apply { code } — capture a code onto the CALLER at signup.
export const applyReferral = async (req, res) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
  const referee = req.user;

  const referrer = await User.findOne({ referralCode: code.trim().toUpperCase() }).select('_id');
  const decision = canApplyReferral({
    referrerId: referrer?._id,
    refereeId: referee._id,
    refereeReferredBy: referee.referredBy,
    refereeCreatedAtMs: new Date(referee.createdAt).getTime(),
    nowMs: Date.now(),
  });
  if (!decision.ok) {
    return res.json({ status: 'success', data: { applied: false, reason: decision.reason } });
  }

  // Set only if still un-referred (guards a double-apply race).
  await User.updateOne(
    { _id: referee._id, referredBy: { $exists: false } },
    { $set: { referredBy: referrer._id, referralStatus: 'pending' } },
  );
  res.json({ status: 'success', data: { applied: true, reason: 'ok' } });
};

// POST /api/referrals/claim — confirm+pay the CALLER's pending referral.
// The app calls this on launch/login (native only). No-op unless pending.
export const claimReferral = async (req, res) => {
  const referee = await User.findById(req.user._id).select('_id referredBy referralStatus createdAt');
  const decision = referralConfirmDecision({
    status: referee?.referralStatus,
    refereeCreatedAtMs: new Date(referee?.createdAt).getTime(),
    nowMs: Date.now(),
    lockDays: (await AdminSettings.get()).defaultLockDays,
  });

  if (!decision.confirm) {
    if (decision.reason === 'expired') {
      await User.updateOne({ _id: referee._id, referralStatus: 'pending' }, { $set: { referralStatus: 'expired' } });
    }
    return res.json({ status: 'success', data: { credited: false, reason: decision.reason } });
  }

  // Atomic, idempotent: only the pending→confirmed winner pays.
  const flipped = await User.findOneAndUpdate(
    { _id: referee._id, referralStatus: 'pending' },
    { $set: { referralStatus: 'confirmed' } },
    { new: true },
  );
  if (!flipped) return res.json({ status: 'success', data: { credited: false, reason: 'race' } });

  const s = await AdminSettings.get();
  if (flipped.referredBy) await creditReferralCoins(flipped.referredBy, s.coinsPerReferralReferrer, 'referrer');
  await creditReferralCoins(flipped._id, s.coinsPerReferralReferee, 'referee');

  res.json({ status: 'success', data: { credited: true, refereeCoins: s.coinsPerReferralReferee } });
};

// GET /api/referrals/stats — for the referral card. Lazy-expires stale pendings.
export const getReferralStats = async (req, res) => {
  const me = req.user._id;
  const s = await AdminSettings.get();
  const cutoff = new Date(Date.now() - s.defaultLockDays * 24 * 60 * 60 * 1000);

  // Lazy-expire this user's own referral if it went stale (cheap, on read).
  await User.updateOne(
    { _id: me, referralStatus: 'pending', createdAt: { $lt: cutoff } },
    { $set: { referralStatus: 'expired' } },
  );

  const [confirmedCount, pendingCount, earn] = await Promise.all([
    User.countDocuments({ referredBy: me, referralStatus: 'confirmed' }),
    User.countDocuments({ referredBy: me, referralStatus: 'pending' }),
    Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(me), type: 'referral' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({ status: 'success', data: {
    referralCode: req.user.referralCode,
    confirmedCount,
    pendingCount,
    earningsCoins: earn[0]?.total || 0,
    referrerRupees: s.coinsPerReferralReferrer / s.coinsPerRupee,
    refereeRupees: s.coinsPerReferralReferee / s.coinsPerRupee,
  }});
};
```

- [ ] **Step 4: Write the routes**

```javascript
// backend/src/modules/referrals/referralRoutes.js
import express from 'express';
import { applyReferral, claimReferral, getReferralStats } from './referralController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // all referral API routes require auth

router.post('/apply', applyReferral);
router.post('/claim', claimReferral);
router.get('/stats', getReferralStats);

export default router;
```

- [ ] **Step 5: Mount in app.js**

In `backend/src/app.js`, add the import beside the other module imports (after the `shareRoutes` import, line ~18):

```javascript
import referralRoutes from './modules/referrals/referralRoutes.js';
```

And add the mount beside the other `/api/*` mounts (after `app.use('/api/shares', shareRoutes);`, line ~108):

```javascript
app.use('/api/referrals', referralRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npm test -- referrals`
Expected: PASS — all three now return 401.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/referrals/referralController.js backend/src/modules/referrals/referralRoutes.js backend/src/app.js backend/src/__tests__/referrals.test.js
git commit -m "feat(referral): apply/claim/stats API with two-sided credit on app-login"
```

---

## Task 5: Public `/r/:code` smart-link interstitial

**Files:**
- Create: `backend/src/modules/referrals/referralRedirect.js`
- Modify: `backend/src/app.js` (import + mount `/r`)
- Test: `backend/src/__tests__/referralRedirect.test.js`

**Interfaces:**
- Consumes: `pickStoreUrl` (Task 3).
- Produces: `GET /r/:code` → 200 HTML interstitial that (a) tries `chingiring://signup?ref=<code>`, (b) falls back to the device store after ~1.5s, (c) shows manual buttons. Never 500s; unknown codes still render a generic "get the app" page.
- Env: `IOS_STORE_URL`, `ANDROID_STORE_URL`, `WEB_SIGNUP_URL` (all optional; safe placeholders).

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/referralRedirect.test.js
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- referralRedirect`
Expected: FAIL — 404 (route not mounted).

- [ ] **Step 3: Write the redirect handler**

`helmet()` sets a strict default CSP that would block the inline script, so this route sets its own permissive CSP. The code is sanitised to `[A-Z0-9]` (referral codes are hex) before it ever reaches HTML/JS — no injection surface.

```javascript
// backend/src/modules/referrals/referralRedirect.js
import express from 'express';
import { pickStoreUrl } from './referralService.js';

const router = express.Router();

const STORES = () => ({
  ios:     process.env.IOS_STORE_URL     || 'https://apps.apple.com/app/id0000000000',
  android: process.env.ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.vcrohithuta.chingiringapp',
  web:     process.env.WEB_SIGNUP_URL    || 'https://chingiringi.com/signup',
});

function page({ code, appUrl, storeUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Join Chingiringi</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0F172A;color:#fff;text-align:center;padding:48px 20px}
.btn{display:block;max-width:320px;margin:12px auto;padding:16px;border-radius:12px;font-weight:700;text-decoration:none}
.p{background:#6d28d9;color:#fff}.s{background:#1E293B;color:#cbd5e1}.code{font-size:22px;letter-spacing:2px;font-weight:800;margin:8px 0 24px}</style>
</head><body>
<h2>You've been invited 🎁</h2>
<p>Your referral code</p><div class="code">${code || '—'}</div>
<a class="btn p" href="${appUrl}">Open in app</a>
<a class="btn s" href="${storeUrl}">Get the app</a>
<script>
  // Try the installed app; if nothing takes over, send to the store.
  try { window.location.href = ${JSON.stringify(appUrl)}; } catch (e) {}
  setTimeout(function(){ window.location.href = ${JSON.stringify(storeUrl)}; }, 1500);
</script>
</body></html>`;
}

// GET /r/:code — best-effort, always 200s.
router.get('/:code', (req, res) => {
  const code = String(req.params.code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 16);
  const storeUrl = pickStoreUrl(req.headers['user-agent'], STORES());
  const appUrl = `chingiring://signup?ref=${code}`;
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:");
  res.type('html').send(page({ code, appUrl, storeUrl }));
});

export default router;
```

- [ ] **Step 4: Mount in app.js**

Add the import (after the `referralRoutes` import from Task 4):

```javascript
import referralRedirectRoutes from './modules/referrals/referralRedirect.js';
```

Mount it OUTSIDE `/api` — put it next to the API mounts (order doesn't matter; `/r` can't collide with `/api/*`):

```javascript
app.use('/r', referralRedirectRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npm test -- referralRedirect`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/referrals/referralRedirect.js backend/src/app.js backend/src/__tests__/referralRedirect.test.js
git commit -m "feat(referral): public /r/:code smart-link interstitial (app -> store fallback)"
```

---

## Task 6: App referral API client

**Files:**
- Create: `chingiring-app/src/api/referrals.ts`

**Interfaces:**
- Consumes: `apiClient` (`api/client.ts`).
- Produces: `referralsAPI.apply(code)`, `referralsAPI.claim()`, `referralsAPI.getStats()` — each returns `response.data`.

- [ ] **Step 1: Write the client (mirrors `api/auth.ts`)**

```typescript
// chingiring-app/src/api/referrals.ts
import apiClient from './client';

export const referralsAPI = {
  apply: async (code: string) => {
    const res = await apiClient.post('/api/referrals/apply', { code });
    return res.data;
  },
  claim: async () => {
    const res = await apiClient.post('/api/referrals/claim');
    return res.data;
  },
  getStats: async () => {
    const res = await apiClient.get('/api/referrals/stats');
    return res.data;
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add chingiring-app/src/api/referrals.ts
git commit -m "feat(referral): app API client (apply/claim/stats)"
```

---

## Task 7: Native-only `claim()` on app bootstrap (the payout gate)

**Files:**
- Modify: `chingiring-app/src/store/index.ts` (import + inside `hydrate` success)

**Interfaces:**
- Consumes: `referralsAPI.claim` (Task 6), `isNative` (already imported from `../api/client`).
- Effect: on every native app launch/login where the user is authenticated, fire `claim()` best-effort. Web never calls it — this is what enforces the "download the app to get paid" gate.

- [ ] **Step 1: Add the import**

At the top of `store/index.ts`, beside the other api imports:

```typescript
import { referralsAPI } from '../api/referrals';
```

- [ ] **Step 2: Call claim on native, after getMe confirms auth**

In `hydrate`, inside the `if (response?.data?.user) { ... }` block (right after `set({ isAuthenticated: true, user: response.data.user, isReady: true });`), add:

```typescript
        // Confirm a pending referral now that we know this is a real app login.
        // Native only — the web client must never call claim (that's the gate).
        // Best-effort: a failure here must never break hydrate.
        if (isNative) { referralsAPI.claim().catch(() => {}); }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/store/index.ts
git commit -m "feat(referral): confirm pending referral on native app login (payout gate)"
```

---

## Task 8: Signup referral field + deep-link autofill

**Files:**
- Modify: `chingiring-app/src/screens/Auth/SignupScreen.tsx`
- Modify: `chingiring-app/src/navigation/linking.ts`

**Interfaces:**
- Consumes: `referralsAPI.apply` (Task 6).
- Effect: a "Referral code (optional)" field on signup, prefilled from `route.params.ref` (deep link) or typed manually; on successful signup the code is applied BEFORE `hydrate` (so the pending referral exists before native `claim()` runs).

- [ ] **Step 1: Fix the linking config so `chingiring://` actually routes**

In `linking.ts`, change the `prefixes` array (line ~25) to include the real app scheme:

```typescript
  prefixes: [
    'chingiring://',            // ← real app.json scheme (OS registers this)
    'chingiringi://',           // legacy, kept harmless
    'https://chingiringi.com',
    'https://www.chingiringi.com',
  ],
```

(The existing `Signup: 'signup'` route already accepts a `?ref=` query — React Navigation passes it through as `route.params.ref`. No new route needed.)

- [ ] **Step 2: Read the code param + add the field in SignupScreen**

Change the component signature to accept `route`, add state seeded from the param, render an input, and apply on success. Concretely:

Signature (line 12):
```typescript
export const SignupScreen = ({ navigation, route }: any) => {
```

Add state (after the `password` state, line ~17):
```typescript
  const [referralCode, setReferralCode] = useState(route?.params?.ref ?? '');
```

Apply the code on success — change the mutation's `onSuccess` (line ~25) to:
```typescript
    onSuccess: async (data: any) => {
      setErrorMsg('');
      // Capture the referral BEFORE hydrate — hydrate() triggers the native
      // claim(), which can only confirm a referral that's already pending.
      const code = referralCode.trim();
      if (code) { try { await referralsAPI.apply(code); } catch { /* bad code: ignore, signup still succeeds */ } }
      if (data?.isNewUser) setShowWelcome(true);
      await hydrate();
    },
```

Add the import (beside `authAPI`, line ~8):
```typescript
import { referralsAPI } from '../../api/referrals';
```

Render the input (after the Password `Input`, line ~64):
```tsx
      <Input label="Referral code (optional)" placeholder="e.g. A1B2C3D4" autoCapitalize="characters" value={referralCode} onChangeText={setReferralCode} />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/screens/Auth/SignupScreen.tsx chingiring-app/src/navigation/linking.ts
git commit -m "feat(referral): signup referral field + chingiring:// deep-link autofill"
```

> **Scope note (not a placeholder):** if the mobile app's primary signup is the phone→OTP screen rather than `SignupScreen`, add the same field + the exact `if (code) await referralsAPI.apply(code)` call there too, before its `hydrate()`. The native `claim()` in Task 7 is signup-method-agnostic, so confirmation already works everywhere; only the *code entry* is per-screen.

---

## Task 9: Wire the referral card (stats + copy + link)

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/MobileProfileScreen.tsx`

**Interfaces:**
- Consumes: `referralsAPI.getStats` (Task 6).
- Effect: real referred-count + earnings from the backend; correct reward copy (₹25 / friend gets ₹5); share link points at the backend `/r/<code>` that actually exists.

- [ ] **Step 1: Replace the hardcoded stats with a query**

Add the import (beside the other api imports at the top of the file):
```typescript
import { referralsAPI } from '../../api/referrals';
```

Replace the hardcoded block (lines ~104-109) with:
```typescript
  const { data: referralStats } = useQuery({
    queryKey: ['referralStats'],
    queryFn: referralsAPI.getStats,
  });
  const referralCount    = referralStats?.data?.confirmedCount ?? 0;
  const referralEarnings = referralStats?.data?.earningsCoins ?? 0; // coins
  const referralCode     = user?.referralCode || '';
```

(`useQuery` is already used in this file — reuse the existing `@tanstack/react-query` import. `Earnings` now renders coins; keep the existing `inr()`/`num()` formatter used for the card — if it shows coins, use `num(referralEarnings)`; if you prefer ₹, divide by 1000 first. Match the neighbouring COINS stat which uses `num(coins)`.)

- [ ] **Step 2: Fix the reward copy**

Change line ~194:
```tsx
                <Text style={s.referralSubtitle}>Earn ₹25 — your friend gets ₹5</Text>
```

- [ ] **Step 3: Point the share link at the real redirect host**

Change the share message (line ~132) to use the backend `/r/` host (env-driven, same convention as shares):
```typescript
      const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
      await Share.share({
        message: `Join Chingiringi with my code ${referralCode} — get ₹5 to start! ${base}/r/${referralCode}`,
      });
```

- [ ] **Step 4: Verify it compiles**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add chingiring-app/src/screens/Dashboard/MobileProfileScreen.tsx
git commit -m "feat(referral): wire profile referral card to live stats + correct copy/link"
```

> **Scope note:** the desktop drawer `ReferScreen` (`src/screens/.../ReferScreen`) is a second referral surface. If it shows the same stats/code, wire it the same way (`referralsAPI.getStats`, `${base}/r/${code}`). Fold into this task if it's in scope; otherwise track as a fast follow.

---

## Task 10: Deploy gates & config (checklist — do at ship time, not code)

These are runtime flips, not commits. Verify each before real users hit the flow.

- [ ] **AdminSettings stored doc** — the schema defaults (Task 1) do NOT touch an existing singleton row. Flip the stored values:
  `db.adminsettings.updateOne({key:'default'}, {$set:{ coinsPerReferralReferrer:25000, coinsPerReferralReferee:5000 }})` (or the admin Wallet-Ops settings UI). Also confirm `coinsPerRupee` is `1000` (the existing gate).
- [ ] **Store URLs** — set `IOS_STORE_URL`, `ANDROID_STORE_URL`, `WEB_SIGNUP_URL` env on Render once the apps are published. Until then the placeholders render but the store fallback isn't live; installed-app + web paths work now.
- [ ] **Run the backfill** — `node backend/src/scripts/backfillReferralCodes.js` against the live DB if any users predate the `referralCode` field.
- [ ] **EAS** — the deep-link autofill (`chingiring://signup?ref=…`) and the linking-prefix fix reach users only via `eas update` / `eas build`, not a main merge. Manual code entry covers the gap until the rebuild ships.

---

## Self-Review

**Spec coverage:**
- Unique code → exists; backfill in Task 2. ✅
- Smart link (app else store by device) → Task 5 (`pickStoreUrl` + interstitial). ✅
- Capture at signup (autofill + manual) → Task 8 (`route.params.ref` + field + `apply`). ✅
- ₹25/₹5 reward → Task 1 knobs + Task 4 credit. ✅
- App-login payout gate → Task 7 native-only `claim`. ✅
- Stats/dashboard → Task 4 `getReferralStats` + Task 9 wiring. ✅
- Anti-abuse (self, one-per-referee, window, expiry) → Task 3 guards + Task 4 atomic flip + lazy-expire. ✅

**Placeholder scan:** the two "Scope note" blocks carry the exact code to reuse (not "similar to Task N"); store URLs are explicit env with real fallbacks. No TBD/TODO left. ✅

**Type consistency:** `referralStatus` enum, `canApplyReferral`/`referralConfirmDecision`/`pickStoreUrl` signatures, and `referralsAPI.{apply,claim,getStats}` names match across Tasks 3/4/6/7/8/9. Credit uses `Transaction{type:'referral'}` (enum already exists) and `notify('wallet_credited')` (CATEGORY-mapped). ✅

**Known honest limits (from spec):** the `claim` gate is a product gate (web client just doesn't call it); IP-match / SDK deferred-autofill and abuse-scoring are explicit follow-ups.
