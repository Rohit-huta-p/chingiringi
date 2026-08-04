# Share-to-Earn — Backend (`shares` module + coin-rate reset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-validated endpoint that credits users 100 coins for sharing a product or offline store, capped at 100 shares/day with once-per-item-per-day dedup, and reset the coin↔rupee rate so 100 coins = 10 paise.

**Architecture:** New `backend/src/modules/shares/` module. A pure `shareService.js` holds the fraud-critical quota/day-bucket logic (unit-tested, no DB). `shareController.js` does I/O: validates the item exists, enforces the daily cap, inserts a `ShareEvent` whose unique `(userId,itemType,itemId,day)` index is the idempotency guard, then credits coins by reusing the exact `adjustUserWallet` primitive (wallet.coins += → Transaction `coin_credit` → `notify('wallet_credited')`). The app calls this endpoint AFTER the OS share sheet reports a completed share. The backend mints no token; the app shares a plain item link carrying a `cr_<userId>` subid so the existing `clicks/` pipeline can attribute later — that consumer is NOT built now.

**Tech Stack:** Node/Express, Mongoose, Jest + supertest (existing). No new dependencies.

## Global Constraints

- coinsPerShare = **100**; maxSharesPerDay = **100** (products + stores COMBINED); credit once per **(user, itemType, itemId) per IST calendar day** — copied verbatim from spec.
- coinsPerRupee: **10 → 1000** (100 coins = 10 paise). This knob is used at BOTH credit and withdrawal — the existing-doc flip is a gated checkpoint (Task 2).
- All caps/validation are **server-side only** — never trust a client-supplied coin amount.
- REUSE, do not reinvent: the `adjustUserWallet` credit pattern (walletOpsController.js:193-234), `notify({userId,type:'wallet_credited',data})`, `protect` from `middleware/authMiddleware.js`, the `cr_<userId>` subid convention.
- Match existing controller error style: `res.status(n); throw new Error(msg)` (async throws propagate via the existing global handler — proven by `adjustUserWallet`).
- Do NOT touch: withdrawal/Razorpay/payout logic, `importReport`, or any admin screen. Do NOT add dependencies or abstractions.

---

### Task 1: AdminSettings — add share config + reset rate default

**Files:**
- Modify: `backend/src/modules/admin/adminSettingsModel.js:22-24`
- Modify: `backend/src/modules/admin/adminSettingsController.js` (the `ALLOWED`/validation block around :36 and :67)
- Test: `backend/src/__tests__/adminSettings.test.js`

**Interfaces:**
- Produces: `AdminSettings.get()` doc now carries `coinsPerShare:number` (default 100), `maxSharesPerDay:number` (default 100); `coinsPerRupee` default is 1000.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/__tests__/adminSettings.test.js
import { describe, it, expect } from '@jest/globals';
import AdminSettings from '../modules/admin/adminSettingsModel.js';

describe('AdminSettings share-economy defaults', () => {
  it('defaults coinsPerShare=100, maxSharesPerDay=100, coinsPerRupee=1000', () => {
    const s = new AdminSettings(); // Mongoose applies defaults synchronously, no DB
    expect(s.coinsPerShare).toBe(100);
    expect(s.maxSharesPerDay).toBe(100);
    expect(s.coinsPerRupee).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/adminSettings.test.js`
Expected: FAIL — `coinsPerShare` is undefined; `coinsPerRupee` is 10.

- [ ] **Step 3: Implement — add fields + change rate default**

In `adminSettingsModel.js`, change the `coinsPerRupee` default and add two fields:

```js
    coinsPerRupee:      { type: Number, default: 1000, min: 1 }, // 100 coins = 10 paise
    // Share-to-earn economy.
    coinsPerShare:      { type: Number, default: 100,  min: 0 },
    maxSharesPerDay:    { type: Number, default: 100,  min: 0 }, // per user, products+stores combined
```

In `adminSettingsController.js`, allow the two new fields through `updateSettings` (mirror the existing `coinsPerRupee` numeric-validation block):

```js
  for (const key of ['coinsPerShare', 'maxSharesPerDay']) {
    if (updates[key] !== undefined) {
      const n = Number(updates[key]);
      if (!Number.isFinite(n) || n < 0) { res.status(400); throw new Error(`${key} must be >= 0`); }
      updates[key] = n;
    }
  }
```
Add `'coinsPerShare'` and `'maxSharesPerDay'` to the `ALLOWED` field list near line 36.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/__tests__/adminSettings.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/admin/adminSettingsModel.js backend/src/modules/admin/adminSettingsController.js backend/src/__tests__/adminSettings.test.js
git commit -m "feat(settings): add coinsPerShare + maxSharesPerDay, reset coinsPerRupee to 1000"
```

---

### Task 2: 🔴 CHECKPOINT — flip the live coin rate on the existing settings doc

**Files:** none (uses the existing admin settings endpoint).

Changing the schema default (Task 1) only affects a FRESH deploy. An existing DB already has a settings doc with `coinsPerRupee: 10`. `AdminSettings.get()` returns that stored doc unchanged.

- [ ] **Step 1: STOP — confirm no real balances**

Confirm with the product owner that current coin balances are test/pre-launch. Flipping the rate devalues every existing coin balance 100× at withdrawal. If any real user holds coins, HALT and escalate.

- [ ] **Step 2: Flip via the existing admin settings endpoint (no new code)**

As an authenticated admin, send `coinsPerRupee: 1000` to the existing update route (`PUT/PATCH /api/admin/settings`, handled by `updateSettings`). Do this from the Admin profile/settings screen or:

```bash
curl -X PUT "$API/api/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"coinsPerRupee":1000}'
```

- [ ] **Step 3: Verify**

Run: `curl "$API/api/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN"`
Expected: response shows `"coinsPerRupee": 1000`.

- [ ] **Step 4: Sanity-check the app-side hardcoded rate**

`WalletScreen.tsx` and `MobileWalletScreen.tsx` hardcode `COINS_PER_RUPEE = 10` / `RATE = 10` for the withdrawal preview. These are corrected in the App plan (Task 6) — note it here so the two plans stay consistent.

---

### Task 3: ShareEvent model

**Files:**
- Create: `backend/src/modules/shares/shareModel.js`
- Test: `backend/src/__tests__/shareModel.test.js`

**Interfaces:**
- Produces: default export `ShareEvent`; document shape `{ userId, itemType:'product'|'store', itemId, coinsAwarded, day }`. Unique index on `(userId,itemType,itemId,day)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/src/__tests__/shareModel.test.js
import { describe, it, expect } from '@jest/globals';
import ShareEvent from '../modules/shares/shareModel.js';

describe('ShareEvent schema', () => {
  it('accepts product/store itemType and requires itemId + day', () => {
    const ok = new ShareEvent({ userId: '64f8a2b9c1d2e3f4a5b6c7d8', itemType: 'store',
      itemId: '64f8a2b9c1d2e3f4a5b6c7d9', coinsAwarded: 100, day: '2026-08-03' });
    expect(ok.validateSync()).toBeUndefined();
    const bad = new ShareEvent({ userId: '64f8a2b9c1d2e3f4a5b6c7d8', itemType: 'deal',
      itemId: '64f8a2b9c1d2e3f4a5b6c7d9', coinsAwarded: 100, day: '2026-08-03' });
    expect(bad.validateSync()).toBeDefined(); // enum rejects 'deal'
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/shareModel.test.js`
Expected: FAIL — Cannot find module `shareModel.js`.

- [ ] **Step 3: Implement the model**

```js
// backend/src/modules/shares/shareModel.js
import mongoose from 'mongoose';

const shareEventSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemType: { type: String, enum: ['product', 'store'], required: true },
    itemId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    coinsAwarded: { type: Number, required: true },
    // IST calendar-day bucket 'YYYY-MM-DD' — powers daily count + per-item dedup.
    day: { type: String, required: true },
  },
  { timestamps: true },
);

shareEventSchema.index({ userId: 1, day: 1 });                                  // fast daily count
shareEventSchema.index({ userId: 1, itemType: 1, itemId: 1, day: 1 }, { unique: true }); // idempotency: one credit per item per day

const ShareEvent = mongoose.model('ShareEvent', shareEventSchema);
export default ShareEvent;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/__tests__/shareModel.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shares/shareModel.js backend/src/__tests__/shareModel.test.js
git commit -m "feat(shares): ShareEvent model with per-item-per-day unique index"
```

---

### Task 4: shareService — pure quota + IST day bucket (the money logic)

**Files:**
- Create: `backend/src/modules/shares/shareService.js`
- Test: `backend/src/__tests__/shareService.test.js`

**Interfaces:**
- Produces: `evaluateShareQuota({ todayCount, maxSharesPerDay }) → { ok:boolean, code?:string, message?:string }`; `istDayBucket(now?:Date) → 'YYYY-MM-DD'`.

- [ ] **Step 1: Write the failing tests (happy path + cap-exceeded, per spec)**

```js
// backend/src/__tests__/shareService.test.js
import { describe, it, expect } from '@jest/globals';
import { evaluateShareQuota, istDayBucket } from '../modules/shares/shareService.js';

describe('evaluateShareQuota', () => {
  it('allows a share under the cap', () => {
    expect(evaluateShareQuota({ todayCount: 0, maxSharesPerDay: 100 })).toEqual({ ok: true });
    expect(evaluateShareQuota({ todayCount: 99, maxSharesPerDay: 100 }).ok).toBe(true);
  });
  it('rejects at/over the cap with DAILY_LIMIT', () => {
    const r = evaluateShareQuota({ todayCount: 100, maxSharesPerDay: 100 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('DAILY_LIMIT');
  });
});

describe('istDayBucket', () => {
  it('rolls to the next day at IST midnight, not UTC', () => {
    // 2026-08-03 20:00 UTC == 2026-08-04 01:30 IST → IST day is the 4th
    expect(istDayBucket(new Date('2026-08-03T20:00:00Z'))).toBe('2026-08-04');
    // 2026-08-03 10:00 UTC == 2026-08-03 15:30 IST → still the 3rd
    expect(istDayBucket(new Date('2026-08-03T10:00:00Z'))).toBe('2026-08-03');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/shareService.test.js`
Expected: FAIL — Cannot find module `shareService.js`.

- [ ] **Step 3: Implement**

```js
// backend/src/modules/shares/shareService.js

// Pure daily-cap decision — no DB, no I/O. Dedup (once-per-item-per-day) is
// enforced separately by the ShareEvent unique index, not here.
export function evaluateShareQuota({ todayCount, maxSharesPerDay }) {
  if (todayCount >= maxSharesPerDay) {
    return { ok: false, code: 'DAILY_LIMIT', message: 'Daily share limit reached' };
  }
  return { ok: true };
}

// IST calendar-day bucket 'YYYY-MM-DD'. The daily cap resets at IST midnight.
// ponytail: fixed +5:30 offset, not a full tz lib — India-only app.
export function istDayBucket(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/__tests__/shareService.test.js`
Expected: PASS (4 assertions)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shares/shareService.js backend/src/__tests__/shareService.test.js
git commit -m "feat(shares): pure quota + IST day-bucket logic with tests"
```

---

### Task 5: shareController — createShare + getShareQuota

**Files:**
- Create: `backend/src/modules/shares/shareController.js`

**Interfaces:**
- Consumes: `ShareEvent` (Task 3), `evaluateShareQuota`/`istDayBucket` (Task 4), `Wallet`, `Transaction`, `Product`, `Store`, `AdminSettings.get()`, `notify`.
- Produces: `createShare(req,res)`, `getShareQuota(req,res)`. `POST /api/shares` returns `{ status, data:{ coinsAwarded, remainingToday, duplicate? } }`; `GET /api/shares/quota` returns `{ status, data:{ usedToday, remaining, cap } }`.

- [ ] **Step 1: Implement the controller**

```js
// backend/src/modules/shares/shareController.js
import mongoose from 'mongoose';
import ShareEvent from './shareModel.js';
import Wallet from '../wallet/walletModel.js';
import Transaction from '../transactions/transactionModel.js';
import Product from '../products/productModel.js';
import Store from '../stores/storeModel.js';
import AdminSettings from '../admin/adminSettingsModel.js';
import { notify } from '../notifications/notificationService.js';
import { evaluateShareQuota, istDayBucket } from './shareService.js';

const MODEL_BY_TYPE = { product: Product, store: Store };

async function ensureWallet(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

// POST /api/shares  { itemType:'product'|'store', itemId }
// Called by the app AFTER the OS share sheet reports a completed share.
export const createShare = async (req, res) => {
  const userId = req.user._id;
  const { itemType, itemId } = req.body;

  const Model = MODEL_BY_TYPE[itemType];
  if (!Model) { res.status(400); throw new Error("itemType must be 'product' or 'store'"); }
  if (!mongoose.Types.ObjectId.isValid(itemId)) { res.status(400); throw new Error('Invalid itemId'); }

  const item = await Model.findById(itemId).select('_id').lean();
  if (!item) { res.status(404); throw new Error(`${itemType} not found`); }

  const settings = await AdminSettings.get();
  const { coinsPerShare, maxSharesPerDay } = settings;
  const day = istDayBucket();

  const todayCount = await ShareEvent.countDocuments({ userId, day });
  const quota = evaluateShareQuota({ todayCount, maxSharesPerDay });
  if (!quota.ok) { res.status(429); throw new Error(quota.message); }

  // Insert FIRST — the unique (userId,itemType,itemId,day) index is the
  // idempotency guard. Already shared this item today → E11000 → no double-pay.
  try {
    await ShareEvent.create({ userId, itemType, itemId, coinsAwarded: coinsPerShare, day });
  } catch (err) {
    if (err?.code === 11000) {
      const usedToday = await ShareEvent.countDocuments({ userId, day });
      return res.json({ status: 'success', data: {
        coinsAwarded: 0, duplicate: true,
        remainingToday: Math.max(0, maxSharesPerDay - usedToday),
      }});
    }
    throw err;
  }

  // Credit — same primitive as adjustUserWallet. ponytail: non-transactional to
  // match the existing wallet code; worst case on a rare save failure is a
  // ShareEvent with no credit (user short 100 coins), recoverable, not a loss.
  const wallet = await ensureWallet(userId);
  wallet.coins += coinsPerShare;
  await wallet.save();

  await Transaction.create({
    userId, type: 'coin_credit', amount: coinsPerShare, status: 'confirmed',
    description: `Share reward — ${itemType}`,
    metadata: { reason: 'share', itemType, itemId: String(itemId) },
  });

  notify({ userId, type: 'wallet_credited', data: { amount: coinsPerShare, currency: 'coins' } })
    .catch(() => {}); // best-effort; a notif failure must never fail the credit

  const usedToday = await ShareEvent.countDocuments({ userId, day });
  res.status(201).json({ status: 'success', data: {
    coinsAwarded: coinsPerShare,
    remainingToday: Math.max(0, maxSharesPerDay - usedToday),
  }});
};

// GET /api/shares/quota
export const getShareQuota = async (req, res) => {
  const userId = req.user._id;
  const settings = await AdminSettings.get();
  const day = istDayBucket();
  const usedToday = await ShareEvent.countDocuments({ userId, day });
  res.json({ status: 'success', data: {
    usedToday, remaining: Math.max(0, settings.maxSharesPerDay - usedToday), cap: settings.maxSharesPerDay,
  }});
};
```

- [ ] **Step 2: Commit** (integration tests land in Task 6, which wires the route)

```bash
git add backend/src/modules/shares/shareController.js
git commit -m "feat(shares): createShare (cap+dedup+credit) and getShareQuota controllers"
```

---

### Task 6: Routes + mount + auth-guard tests

**Files:**
- Create: `backend/src/modules/shares/shareRoutes.js`
- Modify: `backend/src/app.js` (imports block ~line 27; mounts block ~line 103)
- Test: `backend/src/__tests__/shares.test.js`

**Interfaces:**
- Consumes: `createShare`, `getShareQuota` (Task 5), `protect`.
- Produces: mounted router at `/api/shares`.

- [ ] **Step 1: Write the failing tests (mirror wallet.test.js — auth guard, no DB needed)**

```js
// backend/src/__tests__/shares.test.js
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Shares API auth', () => {
  it('POST /api/shares requires auth', async () => {
    const res = await request(app).post('/api/shares').send({ itemType: 'product', itemId: 'x' });
    expect(res.statusCode).toBe(401);
  });
  it('GET /api/shares/quota requires auth', async () => {
    const res = await request(app).get('/api/shares/quota');
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/shares.test.js`
Expected: FAIL — route 404s (not mounted), so status is 404 not 401.

- [ ] **Step 3: Implement route + mount**

```js
// backend/src/modules/shares/shareRoutes.js
import express from 'express';
import { createShare, getShareQuota } from './shareController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect); // all share routes require auth

router.post('/', createShare);
router.get('/quota', getShareQuota);

export default router;
```

In `backend/src/app.js`, add the import beside the other route imports (~line 27):

```js
import shareRoutes from './modules/shares/shareRoutes.js';
```

And mount it beside the other `/api/*` mounts (~line 103):

```js
app.use('/api/shares', shareRoutes);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/__tests__/shares.test.js`
Expected: PASS (both 401)

- [ ] **Step 5: Run the full backend suite (nothing regressed)**

Run: `cd backend && npx jest`
Expected: all pass, including `wallet.test.js`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/shares/shareRoutes.js backend/src/app.js backend/src/__tests__/shares.test.js
git commit -m "feat(shares): mount /api/shares with auth-guard tests"
```

---

## Backend Done When (binary)

- `POST /api/shares {itemType,itemId}` credits exactly 100 coins, writes one `coin_credit` transaction, returns `remainingToday`.
- The 101st share in an IST day → HTTP 429, zero credit.
- Re-sharing the same item the same day → `duplicate:true`, `coinsAwarded:0`, no second credit.
- `GET /api/admin/settings` shows `coinsPerRupee:1000`.
- `npx jest` fully green; withdrawals/importReport/admin untouched.
