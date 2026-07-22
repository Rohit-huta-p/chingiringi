# Offline Stores — Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an admin-managed offline-store directory — a real backend `stores` module with admin CRUD — and wire the existing user Offline Stores screen to it, replacing the static `MOCK_STORES`.

**Architecture:** New backend module `backend/src/modules/stores/` mirrors the existing `deals`/`products` modules (Mongoose model + controller + Express routes, admin writes gated by `protect`+`admin`). Public store responses strip the commercial terms (commission, payout). The React Native app gets a `storesAPI` client, an `AdminStoresScreen` (+ mobile) cloned from the Deals admin, and the user `OfflineStoresScreen` swaps `MOCK_STORES` for a react-query fetch. Distance is computed client-side (haversine from a city center) so no device-geolocation dependency is introduced.

**Tech Stack:** Node/Express (ESM), Mongoose 9, Jest + Supertest (ESM via `--experimental-vm-modules`), React Native + Expo, TypeScript, `@tanstack/react-query`, axios (`apiClient`), `lucide-react-native`.

## Global Constraints

- Backend is ESM (`"type": "module"`) — use `import`/`export`, `.js` extensions in relative imports.
- Response envelope is always `{ status: 'success', data: { ... } }` (errors thrown with `res.status(n); throw new Error(msg)`).
- Admin write routes are `POST/PUT/DELETE /api/stores` behind `protect` + `admin`; admin list is `GET /api/admin/stores`.
- **Never expose `platformCommissionPercent` or `payoutAccount` on any public (`/api/stores`) response.**
- The `StoreCategory` enum stays exactly as defined in `chingiring-app/src/data/offlineStores.ts` — the 8 values `Fashion, Electronics, Grocery, Food & Cafe, Health, Jewellery, Sports, Beauty`. No `Category` ref, no picker. The backend enum inlines these same 8 strings verbatim.
- Frontend has **no test runner** — verify frontend tasks with `npx tsc --noEmit` (run from `chingiring-app/`) plus the browser preview. Backend uses Jest TDD.
- Backend tests must degrade gracefully when MongoDB is not connected (mirror `backend/src/__tests__/deals.test.js`): wrap DB-touching assertions in try/catch that returns early on `ECONNREFUSED` / `MongoNotConnectedError` / `buffering timed out`. Auth-gate assertions (401) run without a DB.
- Theme tokens come from `chingiring-app/src/constants/theme.ts` (`Colors.primary = #4784E2`, `Gradient.brand`, etc.). Match the Deals/Products admin visual exactly.

---

## File Structure

**Backend — create:**
- `backend/src/modules/stores/storeHours.js` — pure open-hours helpers (`parseTime`, `formatTime`, `isOpenNow`).
- `backend/src/modules/stores/storeModel.js` — Mongoose `Store` schema.
- `backend/src/modules/stores/storeController.js` — public + admin handlers.
- `backend/src/modules/stores/storeRoutes.js` — route table.
- `backend/src/scripts/seedStores.js` — seed the 8 stores.
- `backend/src/__tests__/storeHours.test.js` — unit tests (no DB).
- `backend/src/__tests__/stores.test.js` — API smoke + auth-gate tests.

**Backend — modify:**
- `backend/src/app.js` — mount `/api/stores`.
- `backend/src/modules/admin/adminRoutes.js` — add `GET /stores` → `getAllStoresAdmin`.
- `backend/package.json` — add `seed:stores` script.

**Frontend — create:**
- `chingiring-app/src/api/stores.ts` — `Store` interface + `storesAPI`.
- `chingiring-app/src/utils/geo.ts` — `haversineKm`.
- `chingiring-app/src/screens/Admin/AdminStoresScreen.tsx` — desktop table + form modal.
- `chingiring-app/src/screens/Admin/MobileAdminStores.tsx` — mobile list.

**Frontend — modify:**
- `chingiring-app/src/api/admin.ts` — store CRUD methods.
- `chingiring-app/src/navigation/AdminNavigator.tsx` — mobile `Stack.Screen`.
- `chingiring-app/src/navigation/DesktopAdminDrawer.tsx` — `Drawer.Screen`.
- `chingiring-app/src/components/AdminSidebar.tsx` — `ADMIN_NAV` entry.
- `chingiring-app/src/components/MobileAdminNav.tsx` — `ADMIN_NAV_ITEMS` entry.
- `chingiring-app/src/navigation/linking.ts` — `AdminStores` path.
- `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx` — fetch from API.
- `chingiring-app/src/components/StoreMap.tsx` — use API `Store` type + `userDiscountPercent`.
- `chingiring-app/src/data/offlineStores.ts` — keep category/center exports, drop `MOCK_STORES` + old `Store` type.

---

### Task 1: Store open-hours utility

**Files:**
- Create: `backend/src/modules/stores/storeHours.js`
- Test: `backend/src/__tests__/storeHours.test.js`

**Interfaces:**
- Produces:
  - `parseTime(hhmm: string) => number | null` — minutes since midnight, or null if malformed.
  - `formatTime(hhmm: string) => string` — `"22:00"` → `"10:00 PM"`, `""` if malformed.
  - `isOpenNow(openTime: string, closeTime: string, openDays: number[], now?: Date) => boolean` — `openDays` uses `Date.getDay()` (Sun=0); empty array = every day; handles overnight windows (close < open).

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/storeHours.test.js
import { describe, it, expect } from '@jest/globals';
import { parseTime, formatTime, isOpenNow } from '../modules/stores/storeHours.js';

describe('storeHours', () => {
  it('parseTime handles valid and invalid input', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('22:00')).toBe(1320);
    expect(parseTime('7:5')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it('formatTime renders 12-hour clock', () => {
    expect(formatTime('22:00')).toBe('10:00 PM');
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('00:15')).toBe('12:15 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('nope')).toBe('');
  });

  it('isOpenNow respects a same-day window', () => {
    // Wed 2026-07-22, 14:00
    const now = new Date(2026, 6, 22, 14, 0);
    expect(isOpenNow('10:00', '22:00', [], now)).toBe(true);
    expect(isOpenNow('10:00', '13:00', [], now)).toBe(false);
  });

  it('isOpenNow respects open days', () => {
    const wed = new Date(2026, 6, 22, 14, 0); // getDay() === 3
    expect(isOpenNow('10:00', '22:00', [1, 2, 3, 4, 5], wed)).toBe(true);
    expect(isOpenNow('10:00', '22:00', [0, 6], wed)).toBe(false);
  });

  it('isOpenNow handles an overnight window', () => {
    const lateNight = new Date(2026, 6, 22, 1, 0); // 01:00
    expect(isOpenNow('18:00', '02:00', [], lateNight)).toBe(true);
    const midday = new Date(2026, 6, 22, 12, 0);
    expect(isOpenNow('18:00', '02:00', [], midday)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- storeHours`
Expected: FAIL — `Cannot find module '../modules/stores/storeHours.js'`.

- [ ] **Step 3: Write the implementation**

```javascript
// backend/src/modules/stores/storeHours.js
// Pure open-hours helpers — no DB, no external deps, fully unit-testable.

// "HH:mm" (24h) → minutes since midnight, or null if malformed.
export function parseTime(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// "HH:mm" (24h) → "h:mm AM/PM". Empty string if malformed.
export function formatTime(hhmm) {
  const mins = parseTime(hhmm);
  if (mins === null) return '';
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Open at `now`? openDays: array of 0–6 (Sun=0); empty = every day.
// Handles overnight windows where closeTime < openTime (e.g. 18:00–02:00).
export function isOpenNow(openTime, closeTime, openDays, now = new Date()) {
  const open = parseTime(openTime);
  const close = parseTime(closeTime);
  if (open === null || close === null) return false;

  const days = Array.isArray(openDays) ? openDays : [];
  if (days.length && !days.includes(now.getDay())) return false;

  const cur = now.getHours() * 60 + now.getMinutes();
  if (close > open) return cur >= open && cur < close; // same-day
  if (close < open) return cur >= open || cur < close; // overnight
  return true; // open === close → treat as 24h
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- storeHours`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/stores/storeHours.js backend/src/__tests__/storeHours.test.js
git commit -m "feat(stores): add open-hours utility"
```

---

### Task 2: Store model

**Files:**
- Create: `backend/src/modules/stores/storeModel.js`
- Test: add a `describe('Store model')` block to `backend/src/__tests__/stores.test.js` (created here; API tests added in Task 3).

**Interfaces:**
- Produces: default export `Store` (Mongoose model). Schema paths used by later tasks: `name, shortName, slug, category, description, logoUrl, images[], phone, address, area, city, lat, lng, location, openTime, closeTime, openDays[], userDiscountPercent, platformCommissionPercent, maxDiscountCap, minBillAmount, settlementCycle, payoutAccount, isActive, isFeatured, isVerified, rating, reviewsCount, totalGmv, totalTxns`.

- [ ] **Step 1: Write the failing test**

```javascript
// backend/src/__tests__/stores.test.js
import { describe, it, expect } from '@jest/globals';
import Store from '../modules/stores/storeModel.js';

describe('Store model', () => {
  it('requires the core fields', () => {
    expect(Store.schema.path('name').isRequired).toBe(true);
    expect(Store.schema.path('shortName').isRequired).toBe(true);
    expect(Store.schema.path('address').isRequired).toBe(true);
    expect(Store.schema.path('lat').isRequired).toBe(true);
    expect(Store.schema.path('lng').isRequired).toBe(true);
    expect(Store.schema.path('userDiscountPercent').isRequired).toBe(true);
    expect(Store.schema.path('platformCommissionPercent').isRequired).toBe(true);
  });

  it('constrains category to the 8 store categories', () => {
    const values = Store.schema.path('category').enumValues;
    expect(values).toEqual([
      'Fashion', 'Electronics', 'Grocery', 'Food & Cafe',
      'Health', 'Jewellery', 'Sports', 'Beauty',
    ]);
  });

  it('defaults city, flags and settlement cycle', () => {
    expect(Store.schema.path('city').defaultValue).toBe('Bengaluru');
    expect(Store.schema.path('isActive').defaultValue).toBe(true);
    expect(Store.schema.path('isFeatured').defaultValue).toBe(false);
    expect(Store.schema.path('settlementCycle').defaultValue).toBe('monthly');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- stores`
Expected: FAIL — `Cannot find module '../modules/stores/storeModel.js'`.

- [ ] **Step 3: Write the implementation**

```javascript
// backend/src/modules/stores/storeModel.js
import mongoose from 'mongoose';

export const STORE_CATEGORIES = [
  'Fashion', 'Electronics', 'Grocery', 'Food & Cafe',
  'Health', 'Jewellery', 'Sports', 'Beauty',
];

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const storeSchema = new mongoose.Schema(
  {
    // ── Profile ──────────────────────────────────────────────
    name: { type: String, required: [true, 'Store name is required'], trim: true },
    shortName: { type: String, required: [true, 'Short name is required'], trim: true },
    slug: { type: String, unique: true, sparse: true },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: STORE_CATEGORIES,
    },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    images: [{ type: String }],
    phone: { type: String, default: '' },

    // ── Location ─────────────────────────────────────────────
    address: { type: String, required: [true, 'Address is required'], trim: true },
    area: { type: String, default: '' },
    city: { type: String, default: 'Bengaluru' },
    lat: { type: Number, required: [true, 'Latitude is required'] },
    lng: { type: Number, required: [true, 'Longitude is required'] },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    // ── Hours ("HH:mm" 24h) ──────────────────────────────────
    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '22:00' },
    openDays: [{ type: Number, min: 0, max: 6 }], // empty = every day

    // ── Deal terms (admin-only; stripped from public responses) ──
    userDiscountPercent: {
      type: Number, required: [true, 'User discount % is required'], min: 0, max: 100,
    },
    platformCommissionPercent: {
      type: Number, required: [true, 'Commission % is required'], min: 0, max: 100,
    },
    maxDiscountCap: { type: Number, default: 0, min: 0 }, // 0 = no cap
    minBillAmount: { type: Number, default: 0, min: 0 },
    settlementCycle: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },
    payoutAccount: {
      method: { type: String, default: '' },
      upiId: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountLast4: { type: String, default: '' },
    },

    // ── Flags ────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    // ── Denormalised stats (Tier 3 fills these) ──────────────
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    totalGmv: { type: Number, default: 0 },
    totalTxns: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Derive slug + GeoJSON point from name/lat/lng before saving.
storeSchema.pre('save', function preSave(next) {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name);
  if (typeof this.lat === 'number' && typeof this.lng === 'number') {
    this.location = { type: 'Point', coordinates: [this.lng, this.lat] };
  }
  next();
});

storeSchema.index({ category: 1 });
storeSchema.index({ city: 1 });
storeSchema.index({ isActive: 1 });
storeSchema.index({ isFeatured: 1 });
storeSchema.index({ location: '2dsphere' });
storeSchema.index({ name: 'text', address: 'text' });

const Store = mongoose.model('Store', storeSchema);

export default Store;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- stores`
Expected: PASS (3 Store-model tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/stores/storeModel.js backend/src/__tests__/stores.test.js
git commit -m "feat(stores): add Store model"
```

---

### Task 3: Store controller + routes (public + admin)

**Files:**
- Create: `backend/src/modules/stores/storeController.js`
- Create: `backend/src/modules/stores/storeRoutes.js`
- Modify: `backend/src/app.js` (import + `app.use('/api/stores', storeRoutes)`)
- Modify: `backend/src/modules/admin/adminRoutes.js` (import `getAllStoresAdmin` + `router.get('/stores', getAllStoresAdmin)`)
- Test: extend `backend/src/__tests__/stores.test.js`

**Interfaces:**
- Consumes: `Store` (Task 2), `formatTime`/`isOpenNow` (Task 1), `protect` (`../../middleware/authMiddleware.js`), `admin` (`../../middleware/adminMiddleware.js`).
- Produces (named exports): `getStores, getStore, createStore, updateStore, deleteStore, getAllStoresAdmin`.
- Public responses (`getStores`, `getStore`) exclude `platformCommissionPercent` and `payoutAccount`, and add computed `isOpen` + `opensAt`.

- [ ] **Step 1: Write the failing test** (append to `stores.test.js`)

```javascript
import request from 'supertest';
import app from '../app.js';

describe('Stores API', () => {
  it('GET /api/stores returns 200 with stores + pagination', async () => {
    try {
      const res = await request(app).get('/api/stores');
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('stores');
      expect(Array.isArray(res.body.data.stores)).toBe(true);
    } catch (error) {
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('MongoNotConnectedError') ||
        error.message.includes('buffering timed out')
      ) { console.warn('Skipping: MongoDB not connected'); return; }
      throw error;
    }
  });

  it('POST /api/stores is 401 without auth', async () => {
    const res = await request(app).post('/api/stores').send({ name: 'X' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/stores/:bad is 404 or 500', async () => {
    const res = await request(app).get('/api/stores/000000000000000000000000');
    expect([404, 500]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- stores`
Expected: FAIL — POST returns 404 (route not mounted yet), not 401.

- [ ] **Step 3a: Write the controller**

```javascript
// backend/src/modules/stores/storeController.js
import Store from './storeModel.js';
import { formatTime, isOpenNow } from './storeHours.js';

// Fields that must never reach a public (non-admin) client.
const PUBLIC_EXCLUDE = '-platformCommissionPercent -payoutAccount';

// Attach computed display/status fields to a lean store object.
const decorate = (s) => ({
  ...s,
  isOpen: isOpenNow(s.openTime, s.closeTime, s.openDays),
  opensAt: formatTime(s.openTime),
});

// @desc Get active stores (public — deal terms stripped)
// @route GET /api/stores
// @access Public
export const getStores = async (req, res) => {
  const { page = 1, limit = 50, category, search, featured, sort = '-createdAt' } = req.query;

  const filter = { isActive: true };
  if (category && category !== 'All') filter.category = category;
  if (featured === 'true') filter.isFeatured = true;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [stores, total] = await Promise.all([
    Store.find(filter).select(PUBLIC_EXCLUDE).sort(sort).skip(skip).limit(Number(limit)).lean(),
    Store.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stores: stores.map(decorate),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

// @desc Get single store (public)
// @route GET /api/stores/:id
// @access Public
export const getStore = async (req, res) => {
  const store = await Store.findById(req.params.id).select(PUBLIC_EXCLUDE).lean();
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  res.status(200).json({ status: 'success', data: { store: decorate(store) } });
};

// @desc Create store (admin)
// @route POST /api/stores
// @access Private/Admin
export const createStore = async (req, res) => {
  const store = await Store.create(req.body);
  res.status(201).json({ status: 'success', data: { store } });
};

// @desc Update store (admin)
// @route PUT /api/stores/:id
// @access Private/Admin
export const updateStore = async (req, res) => {
  const store = await Store.findById(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  Object.assign(store, req.body);
  await store.save(); // re-runs pre-save (slug + geo point)
  res.status(200).json({ status: 'success', data: { store } });
};

// @desc Delete store (admin)
// @route DELETE /api/stores/:id
// @access Private/Admin
export const deleteStore = async (req, res) => {
  const store = await Store.findByIdAndDelete(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }
  res.status(200).json({ status: 'success', message: 'Store deleted' });
};

// @desc Admin list (all stores incl. inactive, WITH deal terms)
// @route GET /api/admin/stores
// @access Private/Admin
export const getAllStoresAdmin = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const search = req.query.search || '';

  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const [stores, total] = await Promise.all([
    Store.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Store.countDocuments(query),
  ]);

  res.json({
    status: 'success',
    data: { stores: stores.map(decorate), total, page, pages: Math.ceil(total / limit) },
  });
};
```

- [ ] **Step 3b: Write the routes**

```javascript
// backend/src/modules/stores/storeRoutes.js
import express from 'express';
import {
  getStores, getStore, createStore, updateStore, deleteStore,
} from './storeController.js';
import { protect } from '../../middleware/authMiddleware.js';
import { admin } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// Public
router.get('/', getStores);
router.get('/:id', getStore);

// Admin
router.post('/', protect, admin, createStore);
router.put('/:id', protect, admin, updateStore);
router.delete('/:id', protect, admin, deleteStore);

export default router;
```

- [ ] **Step 3c: Mount in `app.js`**

Add the import beside the other route imports (after line 23, `import notificationRoutes ...`):

```javascript
import storeRoutes from './modules/stores/storeRoutes.js';
```

Add the mount beside the other `app.use` route lines (after `app.use('/api/notifications', notificationRoutes);`):

```javascript
app.use('/api/stores', storeRoutes);
```

- [ ] **Step 3d: Add the admin list route in `adminRoutes.js`**

Add to the imports from the products/stores controllers:

```javascript
import { getAllStoresAdmin } from '../stores/storeController.js';
```

Add beside `router.get('/products', getAllProductsAdmin);`:

```javascript
router.get('/stores', getAllStoresAdmin);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- stores`
Expected: PASS — POST is now 401; GET is 200-or-skipped; bad id is 404/500.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/stores/storeController.js backend/src/modules/stores/storeRoutes.js backend/src/app.js backend/src/modules/admin/adminRoutes.js backend/src/__tests__/stores.test.js
git commit -m "feat(stores): add public + admin store routes"
```

---

### Task 4: Seed script

**Files:**
- Create: `backend/src/scripts/seedStores.js`
- Modify: `backend/package.json` (add `"seed:stores": "node src/scripts/seedStores.js"`)

**Interfaces:**
- Consumes: `connectDB` (`../config/db.js`), `Store` (Task 2).

- [ ] **Step 1: Write the seed script**

```javascript
// backend/src/scripts/seedStores.js
import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Store from '../modules/stores/storeModel.js';

const stores = [
  { name: 'Croma Electronics', shortName: 'Croma', category: 'Electronics', description: 'Electronics megastore', address: 'Shop No. 12, Orion Mall, Rajajinagar', area: 'Rajajinagar', lat: 12.9921, lng: 77.5547, openTime: '10:30', closeTime: '22:00', userDiscountPercent: 8, platformCommissionPercent: 5, rating: 4.4, reviewsCount: 211 },
  { name: 'Apollo Pharmacy', shortName: 'Apollo', category: 'Health', description: '24x7 pharmacy', address: 'Near Manhi Hall, Hebbal, Bengaluru', area: 'Hebbal', lat: 12.9650, lng: 77.6260, openTime: '08:30', closeTime: '22:30', userDiscountPercent: 5, platformCommissionPercent: 4, rating: 4.2, reviewsCount: 87 },
  { name: 'Lifestyle Mega Store', shortName: 'Lifestyle', category: 'Fashion', description: 'Fashion & lifestyle', address: 'Ground Floor, Phoenix MarketCity, Whitefield', area: 'Whitefield', lat: 12.9970, lng: 77.6960, openTime: '10:00', closeTime: '22:00', userDiscountPercent: 8, platformCommissionPercent: 6, isFeatured: true, rating: 4.6, reviewsCount: 1240 },
  { name: "Nature's Basket", shortName: "Nat's Basket", category: 'Grocery', description: 'Gourmet grocery', address: '101 Koramangala Road, 5th Block, Bengaluru', area: 'Koramangala', lat: 12.9352, lng: 77.6245, openTime: '08:00', closeTime: '22:00', userDiscountPercent: 6, platformCommissionPercent: 4, rating: 4.7, reviewsCount: 342 },
  { name: 'Nike Factory Store', shortName: 'Nike', category: 'Sports', description: 'Sportswear & shoes', address: 'Block 1, Forum Shantiniketan Mall, Marathahalli', area: 'Marathahalli', lat: 12.9591, lng: 77.6974, openTime: '11:00', closeTime: '21:30', userDiscountPercent: 7, platformCommissionPercent: 5, isActive: false, rating: 4.0, reviewsCount: 263 },
  { name: 'Nykaa Beauty Studio', shortName: 'Nykaa', category: 'Beauty', description: 'Beauty & cosmetics', address: '46 Bangalore Habitat, Residency Rd, Richmond Town', area: 'Richmond Town', lat: 12.9698, lng: 77.5950, openTime: '10:30', closeTime: '21:00', userDiscountPercent: 9, platformCommissionPercent: 6, rating: 4.3, reviewsCount: 198 },
  { name: 'Tanishq Jewellers', shortName: 'Tanishq', category: 'Jewellery', description: 'Fine jewellery', address: '40, Main Road, Sadashiv Nagar, Bengaluru', area: 'Sadashiv Nagar', lat: 13.0067, lng: 77.5825, openTime: '10:00', closeTime: '20:00', userDiscountPercent: 2, platformCommissionPercent: 3, rating: 4.8, reviewsCount: 891 },
  { name: 'Third Wave Coffee', shortName: 'Third Wave', category: 'Food & Cafe', description: 'Specialty coffee', address: '12, Indiranagar 100ft Road, Bengaluru', area: 'Indiranagar', lat: 12.9716, lng: 77.6412, openTime: '07:30', closeTime: '23:00', userDiscountPercent: 5, platformCommissionPercent: 4, rating: 4.5, reviewsCount: 670 },
];

const seed = async () => {
  try {
    await connectDB();
    await Store.deleteMany({});
    // insertMany bypasses the pre('save') hook, so set slug + location here.
    const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const docs = stores.map((s) => ({
      ...s,
      slug: slugify(s.name),
      location: { type: 'Point', coordinates: [s.lng, s.lat] },
    }));
    const created = await Store.insertMany(docs);
    console.log(`Seeded ${created.length} stores`);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();
```

- [ ] **Step 2: Add the npm script**

In `backend/package.json` `scripts`, after `"seed:products": ...`, add:

```json
"seed:stores": "node src/scripts/seedStores.js",
```

- [ ] **Step 3: Run the seed (requires `MONGO_URI` in `backend/.env`)**

Run: `cd backend && npm run seed:stores`
Expected: `Seeded 8 stores`. (If no DB is configured locally, note it and defer to the deploy environment — do not fake success.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/seedStores.js backend/package.json
git commit -m "feat(stores): add seed script for 8 partner stores"
```

---

### Task 5: Frontend API client

**Files:**
- Create: `chingiring-app/src/api/stores.ts`
- Modify: `chingiring-app/src/api/admin.ts` (add store CRUD)

**Interfaces:**
- Consumes: `apiClient` (`./client`), `StoreCategory` (`../data/offlineStores`).
- Produces: `Store` interface + `storesAPI.list(params?)` / `storesAPI.get(id)`; `adminAPI.getStores/createStore/updateStore/deleteStore`.

- [ ] **Step 1: Write `api/stores.ts`**

```typescript
// chingiring-app/src/api/stores.ts
import apiClient from './client';
import type { StoreCategory } from '../data/offlineStores';

export interface Store {
  _id: string;
  name: string;
  shortName: string;
  slug?: string;
  category: StoreCategory;
  description?: string;
  logoUrl?: string;
  images?: string[];
  phone?: string;
  address: string;
  area?: string;
  city?: string;
  lat: number;
  lng: number;
  openTime?: string;
  closeTime?: string;
  openDays?: number[];
  /** Computed server-side for display. */
  opensAt?: string;
  isOpen?: boolean;
  /** The public discount the shopper gets. */
  userDiscountPercent: number;
  isActive: boolean;
  isFeatured: boolean;
  isVerified?: boolean;
  rating: number;
  reviewsCount: number;
  // ── admin-only (present only on /api/admin/stores) ──
  platformCommissionPercent?: number;
  maxDiscountCap?: number;
  minBillAmount?: number;
  settlementCycle?: 'weekly' | 'monthly';
  payoutAccount?: { method?: string; upiId?: string; bankName?: string; accountLast4?: string };
  totalGmv?: number;
  totalTxns?: number;
  createdAt?: string;
  /** Added client-side from geolocation/city-center. */
  distanceKm?: number;
}

export const storesAPI = {
  list: async (params?: {
    page?: number; limit?: number; category?: string; search?: string; featured?: string; sort?: string;
  }) => {
    const response = await apiClient.get('/api/stores', { params });
    return response.data;
  },
  get: async (id: string) => {
    const response = await apiClient.get(`/api/stores/${id}`);
    return response.data;
  },
};
```

- [ ] **Step 2: Add store methods to `api/admin.ts`**

Insert a new block before the closing `};` of the `adminAPI` object (after the Coupons block, matching the existing method style):

```typescript
  // ─── Offline Stores ─────────────────────────────────────────────────────────
  getStores: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/api/admin/stores', { params });
    return response.data;
  },
  createStore: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/stores', data);
    return response.data;
  },
  updateStore: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/stores/${id}`, data);
    return response.data;
  },
  deleteStore: async (id: string) => {
    const response = await apiClient.delete(`/api/stores/${id}`);
    return response.data;
  },
```

- [ ] **Step 3: Type-check**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors referencing `api/stores.ts` or `api/admin.ts`.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/api/stores.ts chingiring-app/src/api/admin.ts
git commit -m "feat(stores): add stores API client + admin CRUD methods"
```

---

### Task 6: Admin Stores screens (desktop + mobile)

**Files:**
- Create: `chingiring-app/src/screens/Admin/AdminStoresScreen.tsx`
- Create: `chingiring-app/src/screens/Admin/MobileAdminStores.tsx`

**Interfaces:**
- Consumes: `adminAPI` (Task 5), `Store` type, `ImageUploader` (`{ value, onChange, folder? }`), `STORE_CATEGORIES` (`../../data/offlineStores`), theme (`Colors, Spacing, Gradient`), `@tanstack/react-query`.
- Produces: named exports `AdminStoresScreen`, `MobileAdminStores`.

- [ ] **Step 1: Create `AdminStoresScreen.tsx` by cloning the Deals admin**

Start from the structure and **reuse the entire `StyleSheet`** of `chingiring-app/src/screens/Admin/AdminDealsScreen.tsx` (read it in the repo). Produce `AdminStoresScreen.tsx` with a `StoreFormModal` + list screen. The differences from the Deals version:

- Query key `['admin', 'stores']`; `queryFn: () => adminAPI.getStores({ limit: 50 })`; list at `data?.data?.stores || []`.
- Category is a **plain segmented select** over `STORE_CATEGORIES` (no `CategoryPicker`, no `categoriesAPI`).
- Delete → `adminAPI.deleteStore`; toggle active → `adminAPI.updateStore(id, { isActive: !isActive })`.
- Table columns: **Store** (name + address subtext) · **Category** · **Discount** (`{store.userDiscountPercent}%`) · **Commission** (`{store.platformCommissionPercent}%`) · **Status** (Active/Inactive) · **Actions** (toggle/edit/delete).
- Stats row: Total = `data?.data?.total ?? stores.length`; Active = `stores.filter(s => s.isActive).length`; Featured = `stores.filter(s => s.isFeatured).length`.
- Form modal fields + submit payload:

```tsx
// buildInitial(store) — the form state shape
const buildInitial = (s: any) => ({
  name: s?.name || '',
  shortName: s?.shortName || '',
  category: s?.category || 'Fashion',
  description: s?.description || '',
  phone: s?.phone || '',
  address: s?.address || '',
  area: s?.area || '',
  city: s?.city || 'Bengaluru',
  lat: s?.lat?.toString() || '',
  lng: s?.lng?.toString() || '',
  openTime: s?.openTime || '10:00',
  closeTime: s?.closeTime || '22:00',
  logoUrl: s?.logoUrl || '',
  userDiscountPercent: s?.userDiscountPercent?.toString() || '',
  platformCommissionPercent: s?.platformCommissionPercent?.toString() || '',
  maxDiscountCap: s?.maxDiscountCap?.toString() || '',
  minBillAmount: s?.minBillAmount?.toString() || '',
  settlementCycle: s?.settlementCycle || 'monthly',
  isActive: s?.isActive ?? true,
  isFeatured: s?.isFeatured || false,
  isVerified: s?.isVerified || false,
});

// handleSubmit — validation + payload
const handleSubmit = () => {
  if (!form.name || !form.shortName || !form.address || !form.lat || !form.lng
      || !form.userDiscountPercent || !form.platformCommissionPercent) {
    Alert.alert('Validation', 'Please fill all required fields (name, short name, address, lat, lng, discount %, commission %)');
    return;
  }
  mutation.mutate({
    name: form.name,
    shortName: form.shortName,
    category: form.category,
    description: form.description,
    phone: form.phone,
    address: form.address,
    area: form.area,
    city: form.city,
    lat: parseFloat(form.lat),
    lng: parseFloat(form.lng),
    openTime: form.openTime,
    closeTime: form.closeTime,
    logoUrl: form.logoUrl,
    userDiscountPercent: parseFloat(form.userDiscountPercent),
    platformCommissionPercent: parseFloat(form.platformCommissionPercent),
    maxDiscountCap: form.maxDiscountCap ? parseFloat(form.maxDiscountCap) : 0,
    minBillAmount: form.minBillAmount ? parseFloat(form.minBillAmount) : 0,
    settlementCycle: form.settlementCycle,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    isVerified: form.isVerified,
  });
};
```

The mutation mirrors the Deals modal exactly (create vs update by `!!store`, `invalidateQueries(['admin','stores'])`, image via `<ImageUploader value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} folder="chingiringi/stores" />`). Category select: render `STORE_CATEGORIES.map(...)` as tappable pills that set `form.category` (reuse the Deals `segmentRow`/`segmentBtn` styles). Include a note under the commission field: `"Admin only — never shown to shoppers."`

- [ ] **Step 2: Create `MobileAdminStores.tsx`**

Mirror `chingiring-app/src/screens/Admin/MobileAdminDeals.tsx` (read it in the repo): same `MobileAdminNav active="AdminStores"` header, a searchable card list of stores showing name, category, `{userDiscountPercent}% off`, and Active/Inactive, with edit/delete. Reuse the same `StoreFormModal` exported from `AdminStoresScreen.tsx`.

- [ ] **Step 3: Type-check**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/screens/Admin/AdminStoresScreen.tsx chingiring-app/src/screens/Admin/MobileAdminStores.tsx
git commit -m "feat(stores): add admin stores screens (desktop + mobile)"
```

---

### Task 7: Register Stores in admin navigation

**Files:**
- Modify: `chingiring-app/src/navigation/AdminNavigator.tsx`
- Modify: `chingiring-app/src/navigation/DesktopAdminDrawer.tsx`
- Modify: `chingiring-app/src/components/AdminSidebar.tsx`
- Modify: `chingiring-app/src/components/MobileAdminNav.tsx`
- Modify: `chingiring-app/src/navigation/linking.ts`

**Interfaces:**
- Consumes: `AdminStoresScreen`, `MobileAdminStores` (Task 6). Route name is `"AdminStores"` everywhere.

- [ ] **Step 1: `AdminNavigator.tsx`** — add imports + a mobile stack screen.

Imports (beside the other Mobile/Admin screen imports):
```tsx
import { MobileAdminStores } from '../screens/Admin/MobileAdminStores';
import { AdminStoresScreen } from '../screens/Admin/AdminStoresScreen';
```
Screen (after the `AdminAllProducts` line, inside `MobileAdminNavigator`'s `Stack.Navigator`):
```tsx
<Stack.Screen name="AdminStores" component={isMobile ? MobileAdminStores : AdminStoresScreen} options={{ headerShown: !isMobile, title: 'Offline Stores' }} />
```

- [ ] **Step 2: `DesktopAdminDrawer.tsx`** — add import + drawer screen.

Import (beside `AdminProductsScreen`):
```tsx
import { AdminStoresScreen } from '../screens/Admin/AdminStoresScreen';
```
Screen (after the `AdminAllProducts` drawer screen):
```tsx
<Drawer.Screen name="AdminStores" component={AdminStoresScreen} />
```

- [ ] **Step 3: `AdminSidebar.tsx`** — add a nav entry with the `Store` icon.

Add `Store` to the `lucide-react-native` import, then add to `ADMIN_NAV` (after the `products` group):
```tsx
{ key: 'AdminStores', label: 'Offline Stores', icon: Store },
```

- [ ] **Step 4: `MobileAdminNav.tsx`** — add to the shared `ADMIN_NAV_ITEMS`.

Add `Store` to the `lucide-react-native` import, then add after the `AdminAllProducts` item:
```tsx
{ key: 'AdminStores', label: 'Stores', icon: Store },
```

- [ ] **Step 5: `linking.ts`** — add the web path (after `AdminAllProducts: 'admin/products',`):
```tsx
AdminStores: 'admin/stores',
```

- [ ] **Step 6: Type-check + preview**

Run: `cd chingiring-app && npx tsc --noEmit` → no new errors.
Then start the web preview (`.claude/launch.json` "web", or `npm run web`), sign in as an admin, and confirm **Offline Stores** appears in the sidebar and opens the (empty or seeded) table.

- [ ] **Step 7: Commit**

```bash
git add chingiring-app/src/navigation/AdminNavigator.tsx chingiring-app/src/navigation/DesktopAdminDrawer.tsx chingiring-app/src/components/AdminSidebar.tsx chingiring-app/src/components/MobileAdminNav.tsx chingiring-app/src/navigation/linking.ts
git commit -m "feat(stores): register Offline Stores in admin nav"
```

---

### Task 8: Wire the user Offline Stores screen to the API

**Files:**
- Create: `chingiring-app/src/utils/geo.ts`
- Modify: `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx`
- Modify: `chingiring-app/src/components/StoreMap.tsx`
- Modify: `chingiring-app/src/data/offlineStores.ts`

**Interfaces:**
- Consumes: `storesAPI` (Task 5), `Store` type, `BENGALURU_CENTER` / `STORE_CATEGORIES` / `CATEGORY_COLOR` (`../data/offlineStores`).
- Produces: `haversineKm(a, b)`.

- [ ] **Step 1: Create `utils/geo.ts`**

```typescript
// chingiring-app/src/utils/geo.ts
type LatLng = { lat: number; lng: number };

// Great-circle distance in km, rounded to 1 dp.
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(s));
  return Math.round(km * 10) / 10;
}
```

- [ ] **Step 2: Trim `data/offlineStores.ts`**

Keep `StoreCategory`, `STORE_CATEGORIES`, `CATEGORY_COLOR`, and `BENGALURU_CENTER`. **Delete** the old `Store` type and the `MOCK_STORES` array (their only consumer, the screen, stops using them this task; `StoreMap` moves to the API `Store` type in Step 4). Add `CATEGORY_COLOR` here if it currently lives in the screen — otherwise leave it. Verify with grep that nothing else imports `MOCK_STORES`:

Run: `grep -rn "MOCK_STORES" chingiring-app/src` → expect no matches after this step.

- [ ] **Step 3: Rewrite the data layer of `OfflineStoresScreen.tsx`**

Replace the mock import + `filtered` memo. Keep ALL existing JSX/styles; only change the data source, the sort keys, and the card's reward badge.

```tsx
// imports
import { useQuery } from '@tanstack/react-query';
import { storesAPI, type Store } from '../../api/stores';
import { haversineKm } from '../../utils/geo';
import { BENGALURU_CENTER, STORE_CATEGORIES, type StoreCategory } from '../../data/offlineStores';

// sort keys: 'near' | 'discount' | 'rating'  (was 'coins')
type SortKey = 'near' | 'discount' | 'rating';

// inside the component:
const { data, isLoading } = useQuery({
  queryKey: ['stores'],
  queryFn: () => storesAPI.list({ limit: 50 }),
});

const stores: Store[] = useMemo(() => {
  const list = (data?.data?.stores ?? []) as Store[];
  return list.map((s) => ({ ...s, distanceKm: haversineKm(BENGALURU_CENTER, { lat: s.lat, lng: s.lng }) }));
}, [data]);

const filtered = useMemo(() => {
  let list = [...stores];
  if (activeCategory !== 'All') list = list.filter((s) => s.category === activeCategory);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q));
  }
  if (sort === 'near') list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  if (sort === 'discount') list.sort((a, b) => b.userDiscountPercent - a.userDiscountPercent);
  if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  return list;
}, [stores, search, activeCategory, sort]);

const openCount = filtered.filter((s) => s.isOpen).length;
```

Field renames in the existing JSX:
- Sort pill `Coins` → `Discount`, icon `Coins` → `Tag` (from `lucide-react-native`), `sort==='coins'` → `sort==='discount'`.
- Card reward badge: replace the coin badge `{store.coins} Coins` with `{store.userDiscountPercent}% OFF` (icon `Tag`).
- `store.reviews` → `store.reviewsCount`; `store.isHottest` → `store.isFeatured`; `store.opensAt` and `store.isOpen` now come from the API (already present).
- Add a loading branch: when `isLoading`, render an `ActivityIndicator` in the list column; keep the existing empty-state when `filtered.length === 0`.

- [ ] **Step 4: Update `StoreMap.tsx` to the API `Store` type**

Read `chingiring-app/src/components/StoreMap.tsx`. Change its `Store` import to `import type { Store } from '../api/stores';`. Replace any use of `cashbackPercent` or `coins` on markers with `userDiscountPercent` (rendered as `{store.userDiscountPercent}%`). Marker open/closed styling uses `store.isOpen`. No other logic changes.

- [ ] **Step 5: Type-check + preview**

Run: `cd chingiring-app && npx tsc --noEmit` → no new errors.
Preview (web): with the backend seeded (Task 4), open the Offline Stores screen and confirm the 8 stores load from the API, the map renders pins, discount badges read e.g. "8% OFF", the "Near" sort orders by distance, and category filtering works. If the backend isn't reachable, confirm the loading + empty states render without crashing.

- [ ] **Step 6: Commit**

```bash
git add chingiring-app/src/utils/geo.ts chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx chingiring-app/src/components/StoreMap.tsx chingiring-app/src/data/offlineStores.ts
git commit -m "feat(stores): wire Offline Stores screen to the API"
```

---

## Verification (end-to-end)

1. `cd backend && npm test` → `storeHours` + `stores` suites green (DB-touching specs skip cleanly if no local Mongo).
2. `cd backend && npm run seed:stores` (with `MONGO_URI`) → `Seeded 8 stores`.
3. `cd chingiring-app && npx tsc --noEmit` → clean.
4. Admin (web, signed in as admin): **Offline Stores** in the sidebar → table lists the 8 stores with discount + commission → create a new store via the modal → it appears in the table.
5. User Offline Stores screen → the newly created store appears with its discount badge, on the map and in the list.

## Notes for the implementer

- Commission and payout details must never appear in `/api/stores` responses — the `PUBLIC_EXCLUDE` select is the guard; don't remove it.
- `open/closed` is computed from `openTime`/`closeTime`/`openDays` in server local time — acceptable for a single-timezone (India) launch. Real per-request timezone handling is out of scope for Tier 1.
- Distance is computed client-side from `BENGALURU_CENTER` (no device-geolocation permission). Swapping in real geolocation is a later enhancement.
