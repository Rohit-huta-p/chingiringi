# Share-economy dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin dashboard around the share-to-earn economy (shares, sharers, coins-from-shares, ₹ liability, top sharers/items) with real period-over-period deltas, keeping affiliate revenue as a compact strip — Direction B (Momentum).

**Architecture:** One backend endpoint (`getDashboardStats`) feeds both admin screens. Pure date/delta/fill logic is extracted to a unit-tested module; the controller does only Mongo aggregation. The two React Native screens compose a shared set of Momentum presentational parts; the trend chart is generalised to a single series.

**Tech Stack:** Node/Express + Mongoose (ESM), Jest. React Native (Expo) + `react-native-svg`, `@tanstack/react-query`.

**Design source of truth (visual):** the published mockup, Direction B — https://claude.ai/code/artifact/ceaca81c-e560-40a8-8e96-a776999b2e82 — and the spec at `docs/superpowers/specs/2026-08-09-share-economy-dashboard-design.md`.

## Global Constraints

- **IST day buckets for all day math.** Reuse `istDayBucket` from `backend/src/modules/shares/shareService.js` (fixed +5:30, India-only). Never use UTC `createdAt` for day windows.
- **`deltaPct === null` when the prior window is 0** (no baseline). The view renders **no** delta pill in that case — never "+0%", never "NaN".
- **Affiliate `purchases` EXCLUDES `metadata.reason: 'share'`.** This is the bug fix — share rewards create `coin_credit` txns and must not count as purchases/conversions.
- **₹ liability = `circulation / AdminSettings.coinsPerRupee`.** The same stored value gates withdrawals; if the live `AdminSettings` doc still holds `10` instead of `1000`, liability reads **100× high**. Not a code bug — a data/deploy gate; note it, don't "correct" it in code.
- **On-screen numbers use tabular figures and are rounded** (`Math.round` / `toLocaleString`) — no float artifacts.
- **Direction B (Momentum) tokens:** screen bg `#f3f3fb`, card `#fff`, ink `#161334`, ink-2 `#6c6a89`, hairline `#ecebf5`; hero bg `#1e1b45`, hero label `#b9b4f0`, hero sub `#a29de0`; accent indigo `#5b4be6`; good `#12b76a`, bad `#f04438`; card accent stripes `#f79009` / `#12b76a` / `#5b4be6` / `#f04438`; avatar palette `#5b4be6 #f79009 #12b76a #e87ba4 #2a78d6`.

## File structure

- Create `backend/src/modules/admin/dashboardStats.js` — pure helpers: `pctDelta`, `dayWindows`, `trendDays`, `fillTrend`. No I/O.
- Create `backend/src/__tests__/adminDashboard.test.js` — unit tests for the above.
- Modify `backend/src/modules/admin/adminController.js` — rewrite `getDashboardStats` (only this export).
- Modify `backend/src/modules/shares/shareModel.js` — add `index({ day: 1 })`.
- Create `chingiring-app/src/components/TrendChart.tsx` — single-series area chart (generalises `RevenueTrendChart`).
- Create `chingiring-app/src/components/dashboard/parts.tsx` — `DashboardData` type, `M` tokens, and parts: `HeroPanel`, `MetricCard`, `SharersBoard`, `SharedItemsBoard`, `RevenueStrip`.
- Modify `chingiring-app/src/screens/Admin/MobileAdminDashboard.tsx` — compose parts (single column).
- Modify `chingiring-app/src/screens/Admin/AdminDashboardScreen.tsx` — compose parts (wide layout).
- Delete `chingiring-app/src/components/RevenueTrendChart.tsx` — after both screens migrate.

---

### Task 1: Pure dashboard helpers (date windows, delta, trend fill)

**Files:**
- Create: `backend/src/modules/admin/dashboardStats.js`
- Test: `backend/src/__tests__/adminDashboard.test.js`

**Interfaces:**
- Consumes: `istDayBucket(now: Date) => 'YYYY-MM-DD'` from `../shares/shareService.js`.
- Produces:
  - `pctDelta(curr: number, prev: number) => number | null`
  - `dayWindows(now?: Date) => { today, yesterday, start30, start60 }` (IST day strings)
  - `trendDays(now?: Date, count=30) => { day: string, label: string }[]` (oldest→newest, ends today)
  - `fillTrend(days, rows: {_id: string, shares: number}[]) => { label: string, shares: number }[]`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from '@jest/globals';
import { pctDelta, dayWindows, trendDays, fillTrend } from '../modules/admin/dashboardStats.js';

describe('pctDelta', () => {
  it('computes signed percent to 1dp', () => {
    expect(pctDelta(120, 100)).toBe(20);
    expect(pctDelta(80, 100)).toBe(-20);
    expect(pctDelta(133, 120)).toBe(10.8);
  });
  it('returns null when prior is zero/absent (no baseline)', () => {
    expect(pctDelta(5, 0)).toBeNull();
    expect(pctDelta(5, undefined)).toBeNull();
  });
});

describe('dayWindows', () => {
  it('derives IST day boundaries around now', () => {
    const w = dayWindows(new Date('2026-08-09T06:00:00Z')); // 11:30 IST on the 9th
    expect(w.today).toBe('2026-08-09');
    expect(w.yesterday).toBe('2026-08-08');
    expect(w.start30).toBe('2026-07-11'); // 29 days before today = 30-day inclusive window
    expect(w.start60).toBe('2026-06-11'); // start of the prior 30-day window
  });
});

describe('trendDays + fillTrend', () => {
  it('zero-fills gaps and preserves order and labels', () => {
    const days = trendDays(new Date('2026-08-09T06:00:00Z'), 3); // Aug 7,8,9 IST
    const filled = fillTrend(days, [{ _id: '2026-08-08', shares: 4 }]);
    expect(filled.map((d) => d.shares)).toEqual([0, 4, 0]);
    expect(filled[2].label).toBe('Aug 9');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- adminDashboard`
Expected: FAIL — cannot find module `../modules/admin/dashboardStats.js`.

- [ ] **Step 3: Write the implementation**

```js
// backend/src/modules/admin/dashboardStats.js
import { istDayBucket } from '../shares/shareService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Signed percent change to 1 dp. null when prev is 0/absent (no baseline).
export function pctDelta(curr, prev) {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

// IST day-string boundaries. "last 30d" = day >= start30 (30 days incl today);
// "prior 30d" = start60 <= day < start30.
export function dayWindows(now = new Date()) {
  return {
    today: istDayBucket(now),
    yesterday: istDayBucket(new Date(now.getTime() - DAY_MS)),
    start30: istDayBucket(new Date(now.getTime() - 29 * DAY_MS)),
    start60: istDayBucket(new Date(now.getTime() - 59 * DAY_MS)),
  };
}

function labelFor(d) {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return `${MONTHS[ist.getUTCMonth()]} ${ist.getUTCDate()}`;
}

// count IST day-strings, oldest→newest, ending today.
export function trendDays(now = new Date(), count = 30) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    out.push({ day: istDayBucket(d), label: labelFor(d) });
  }
  return out;
}

// Merge [{_id: day, shares}] onto the skeleton, 0-filling missing days.
export function fillTrend(days, rows) {
  const by = new Map(rows.map((r) => [r._id, r.shares]));
  return days.map((d) => ({ label: d.label, shares: by.get(d.day) || 0 }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- adminDashboard`
Expected: PASS (3 suites).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/admin/dashboardStats.js backend/src/__tests__/adminDashboard.test.js
git commit -m "feat(dashboard): pure date-window/delta/trend helpers with tests"
```

---

### Task 2: Rewrite `getDashboardStats` + add `{day:1}` index

**Files:**
- Modify: `backend/src/modules/admin/adminController.js` (replace the `getDashboardStats` export, lines ~1-115; add imports)
- Modify: `backend/src/modules/shares/shareModel.js` (add one index)
- Test: `backend/src/__tests__/adminDashboard.route.test.js` (route auth guard)

**Interfaces:**
- Consumes: helpers from Task 1; models `ShareEvent`, `Wallet`, `Transaction`, `ClickEvent`, `Product`, `Store`, `User`, `AdminSettings`.
- Produces: `GET /api/admin/dashboard` → `{ status, data }` with the shape in Global Constraints / spec (`hero`, `cards`, `coinsEconomy`, `shareTrend`, `topSharers`, `topSharedItems`, `revenue`).

- [ ] **Step 1: Add the `{day:1}` index**

In `backend/src/modules/shares/shareModel.js`, after the existing two indexes:

```js
shareEventSchema.index({ day: 1 }); // dashboard: bare day-bucket counts (not covered by the userId-prefixed compounds)
```

- [ ] **Step 2: Add imports to `adminController.js`**

At the top of `backend/src/modules/admin/adminController.js`, add:

```js
import ShareEvent from '../shares/shareModel.js';
import Product from '../products/productModel.js';
import Store from '../stores/storeModel.js';
import AdminSettings from './adminSettingsModel.js';
import { pctDelta, dayWindows, trendDays, fillTrend } from './dashboardStats.js';
```

(Keep the existing `User`, `Deal`, `Wallet`, `Transaction`, `ClickEvent` imports — `Deal` is still used by other exports in this file.)

- [ ] **Step 3: Replace the `getDashboardStats` export**

Replace the entire current `getDashboardStats` (from `export const getDashboardStats` through its closing `};`) with:

```js
// Every number is aggregated live — no seed/mock. Fresh install → all zeros.
export const getDashboardStats = async (req, res) => {
  const now = new Date();
  const { today, yesterday, start30, start60 } = dayWindows(now);
  const settings = await AdminSettings.get();
  const coinsPerRupee = settings.coinsPerRupee || 1000;

  const last30 = { day: { $gte: start30 } };
  const prior30 = { day: { $gte: start60, $lt: start30 } };
  const notShare = { type: 'coin_credit', 'metadata.reason': { $ne: 'share' } };

  const [
    totalShares, sharesToday, sharesYesterday, shares30, sharesPrev30,
    uniq30, uniqPrev30, coinsAllAgg, coins30Agg, coinsPrev30Agg,
    wallets, creditAgg, debitAgg, trendRows, sharersRows, itemsRows,
    clicks, purchases, commissionAgg,
  ] = await Promise.all([
    ShareEvent.estimatedDocumentCount(),
    ShareEvent.countDocuments({ day: today }),
    ShareEvent.countDocuments({ day: yesterday }),
    ShareEvent.countDocuments(last30),
    ShareEvent.countDocuments(prior30),
    ShareEvent.distinct('userId', last30),
    ShareEvent.distinct('userId', prior30),
    ShareEvent.aggregate([{ $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    ShareEvent.aggregate([{ $match: last30 }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    ShareEvent.aggregate([{ $match: prior30 }, { $group: { _id: null, c: { $sum: '$coinsAwarded' } } }]),
    Wallet.find({}).select('coins pendingCoins').lean(),
    Transaction.aggregate([{ $match: { type: 'coin_credit' } }, { $group: { _id: null, c: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { type: 'coin_debit' } }, { $group: { _id: null, c: { $sum: { $abs: '$amount' } } } }]),
    ShareEvent.aggregate([{ $match: last30 }, { $group: { _id: '$day', shares: { $sum: 1 } } }]),
    ShareEvent.aggregate([
      { $group: { _id: '$userId', shares: { $sum: 1 }, coins: { $sum: '$coinsAwarded' } } },
      { $sort: { shares: -1 } }, { $limit: 5 },
    ]),
    ShareEvent.aggregate([
      { $group: { _id: { itemType: '$itemType', itemId: '$itemId' }, shares: { $sum: 1 } } },
      { $sort: { shares: -1 } }, { $limit: 5 },
    ]),
    ClickEvent.estimatedDocumentCount(),
    Transaction.countDocuments(notShare),
    Transaction.aggregate([{ $match: notShare }, { $group: { _id: null, c: { $sum: { $ifNull: ['$metadata.commissionPaid', 0] } } } }]),
  ]);

  let circulation = 0;
  for (const w of wallets) circulation += (w.coins || 0) + (w.pendingCoins || 0);

  // Resolve top-sharer names.
  const users = await User.find({ _id: { $in: sharersRows.map((r) => r._id).filter(Boolean) } })
    .select('name email').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const topSharers = sharersRows.map((r) => {
    const u = userById.get(String(r._id)) || {};
    return { name: u.name || 'Unknown', email: u.email || '', shares: r.shares, coins: r.coins };
  });

  // Resolve top-item names (split by type, two batched finds).
  const productIds = itemsRows.filter((r) => r._id.itemType === 'product').map((r) => r._id.itemId);
  const storeIds = itemsRows.filter((r) => r._id.itemType === 'store').map((r) => r._id.itemId);
  const [products, stores] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('title brand').lean(),
    Store.find({ _id: { $in: storeIds } }).select('name').lean(),
  ]);
  const prodById = new Map(products.map((p) => [String(p._id), p]));
  const storeById = new Map(stores.map((s) => [String(s._id), s]));
  const topSharedItems = itemsRows.map((r) => {
    if (r._id.itemType === 'product') {
      const p = prodById.get(String(r._id.itemId)) || {};
      return { itemType: 'product', name: p.title || 'Unknown product', brand: p.brand || '', shares: r.shares };
    }
    const s = storeById.get(String(r._id.itemId)) || {};
    return { itemType: 'store', name: s.name || 'Unknown store', brand: '', shares: r.shares };
  });

  const uniq30Count = uniq30.length;
  const coins30 = coins30Agg[0]?.c || 0;
  const shareTrend = fillTrend(trendDays(now), trendRows);

  res.json({
    status: 'success',
    data: {
      hero: {
        totalShares,
        sharesToday,
        coinsFromShares: coinsAllAgg[0]?.c || 0,
        liabilityRupees: Math.round(circulation / coinsPerRupee),
      },
      cards: {
        sharesToday:      { value: sharesToday,  deltaPct: pctDelta(sharesToday, sharesYesterday) },
        shares30d:        { value: shares30,     deltaPct: pctDelta(shares30, sharesPrev30) },
        uniqueSharers30d: { value: uniq30Count,  deltaPct: pctDelta(uniq30Count, uniqPrev30.length) },
        coinsIssued30d:   { value: coins30,      deltaPct: pctDelta(coins30, coinsPrev30Agg[0]?.c || 0) },
      },
      coinsEconomy: {
        issued: creditAgg[0]?.c || 0,
        redeemed: debitAgg[0]?.c || 0,
        circulation,
      },
      shareTrend,
      topSharers,
      topSharedItems,
      revenue: { clicks, purchases, commission: commissionAgg[0]?.c || 0 },
    },
  });
};
```

- [ ] **Step 4: Write a route-guard test**

```js
// backend/src/__tests__/adminDashboard.route.test.js
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';

describe('Admin dashboard route', () => {
  it('GET /api/admin/dashboard requires auth', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect([401, 403]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS — Task 1 helper tests, the new route test, and all existing suites stay green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/admin/adminController.js backend/src/modules/shares/shareModel.js backend/src/__tests__/adminDashboard.route.test.js
git commit -m "feat(dashboard): share-economy stats endpoint (deltas, liability, leaderboards, purchase-pollution fix)"
```

---

### Task 3: Single-series `TrendChart` component

**Files:**
- Create: `chingiring-app/src/components/TrendChart.tsx`

**Interfaces:**
- Produces: `TrendChart({ data: { label: string; value: number }[]; color?: string; fillOpacity?: number })` and `interface SeriesPoint { label: string; value: number }`.

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

export interface SeriesPoint { label: string; value: number; }

const VB_H = 200, PAD_L = 40, PAD_R = 16, PAD_T = 14, PAD_B = 28;
const CHART_H = VB_H - PAD_T - PAD_B;
const GRID = '#ecebf5', AXIS_TXT = '#9aa1ad';

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ data, color = '#5b4be6', fillOpacity = 0.12 }: {
  data: SeriesPoint[]; color?: string; fillOpacity?: number;
}) {
  const [width, setWidth] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - width) > 1) setWidth(w);
  };
  const pts = Array.isArray(data) ? data : [];
  const n = pts.length;
  const rawMax = Math.max(0, ...pts.map((d) => d.value || 0));
  const step = rawMax > 0 ? niceCeil(rawMax / 4) : 25;
  const maxY = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const chartW = Math.max(0, width - PAD_L - PAD_R);
  const xFor = (i: number) => PAD_L + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yFor = (v: number) => PAD_T + (1 - (v || 0) / maxY) * CHART_H;
  const linePts = pts.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
  const baseline = PAD_T + CHART_H;
  const line = smoothPath(linePts);
  const area = n > 0 ? `${line} L ${linePts[n - 1].x.toFixed(1)} ${baseline} L ${linePts[0].x.toFixed(1)} ${baseline} Z` : '';
  const xEvery = Math.max(1, Math.ceil(n / 8));
  const hasData = rawMax > 0;
  const end = linePts[n - 1];

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={VB_H} viewBox={`0 0 ${width} ${VB_H}`}>
          {ticks.map((t, i) => {
            const y = yFor(t);
            return (
              <React.Fragment key={`g${i}`}>
                <Line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke={GRID} strokeWidth={1} />
                <SvgText x={PAD_L - 8} y={y + 3} fontSize={11} fill={AXIS_TXT} textAnchor="end">{fmtK(t)}</SvgText>
              </React.Fragment>
            );
          })}
          {pts.map((d, i) => (i % xEvery === 0 || i === n - 1 ? (
            <SvgText key={`x${i}`} x={xFor(i)} y={VB_H - 8} fontSize={10} fill={AXIS_TXT} textAnchor="middle">{d.label}</SvgText>
          ) : null))}
          {n > 0 && <Path d={area} fill={color} fillOpacity={fillOpacity} />}
          {n > 0 && <Path d={line} stroke={color} strokeWidth={2.5} fill="none" />}
          {n > 0 && end && <Circle cx={end.x} cy={end.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />}
        </Svg>
      )}
      {!hasData && <Text style={st.empty}>No shares in the last 30 days yet — the trend fills in as users share.</Text>}
    </View>
  );
}

const st = StyleSheet.create({ empty: { fontSize: 12, color: '#9aa1ad', textAlign: 'center', marginTop: 8 } });
export default TrendChart;
```

- [ ] **Step 2: Typecheck**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors from `TrendChart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add chingiring-app/src/components/TrendChart.tsx
git commit -m "feat(dashboard): generalised single-series area TrendChart"
```

---

### Task 4: Momentum dashboard parts + payload type

**Files:**
- Create: `chingiring-app/src/components/dashboard/parts.tsx`

**Interfaces:**
- Consumes: `TrendChart` (Task 3).
- Produces:
  - `interface Delta { value: number; deltaPct: number | null }`
  - `interface DashboardData { hero:{totalShares;sharesToday;coinsFromShares;liabilityRupees}; cards:{sharesToday:Delta;shares30d:Delta;uniqueSharers30d:Delta;coinsIssued30d:Delta}; coinsEconomy:{issued;redeemed;circulation}; shareTrend:{label;shares}[]; topSharers:{name;email;shares;coins}[]; topSharedItems:{itemType;name;brand?;shares}[]; revenue:{clicks;purchases;commission} }`
  - `EMPTY_DASHBOARD: DashboardData` (all zeros / empty arrays)
  - `fmt(n)`, `cur(n)`, `M` (tokens)
  - Components: `HeroPanel({hero,trend})`, `MetricCard({label,c,accent,money?})`, `SharersBoard({rows})`, `SharedItemsBoard({rows})`, `RevenueStrip({revenue})`

- [ ] **Step 1: Write the parts module**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { TrendChart } from '../TrendChart';

export interface Delta { value: number; deltaPct: number | null; }
export interface DashboardData {
  hero: { totalShares: number; sharesToday: number; coinsFromShares: number; liabilityRupees: number };
  cards: { sharesToday: Delta; shares30d: Delta; uniqueSharers30d: Delta; coinsIssued30d: Delta };
  coinsEconomy: { issued: number; redeemed: number; circulation: number };
  shareTrend: { label: string; shares: number }[];
  topSharers: { name: string; email: string; shares: number; coins: number }[];
  topSharedItems: { itemType: 'product' | 'store'; name: string; brand?: string; shares: number }[];
  revenue: { clicks: number; purchases: number; commission: number };
}

export const EMPTY_DASHBOARD: DashboardData = {
  hero: { totalShares: 0, sharesToday: 0, coinsFromShares: 0, liabilityRupees: 0 },
  cards: {
    sharesToday: { value: 0, deltaPct: null }, shares30d: { value: 0, deltaPct: null },
    uniqueSharers30d: { value: 0, deltaPct: null }, coinsIssued30d: { value: 0, deltaPct: null },
  },
  coinsEconomy: { issued: 0, redeemed: 0, circulation: 0 },
  shareTrend: [], topSharers: [], topSharedItems: [],
  revenue: { clicks: 0, purchases: 0, commission: 0 },
};

export const M = {
  bg: '#f3f3fb', card: '#fff', ink: '#161334', ink2: '#6c6a89', line: '#ecebf5',
  hero: '#1e1b45', heroLabel: '#b9b4f0', heroSub: '#a29de0',
  indigo: '#5b4be6', good: '#12b76a', bad: '#f04438',
  amber: '#f79009', green: '#12b76a', red: '#f04438',
  avatars: ['#5b4be6', '#f79009', '#12b76a', '#e87ba4', '#2a78d6'],
};

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K` : Math.round(n).toLocaleString();
export const cur = (n: number) => (n >= 100_000 ? `₹${(n / 1_000).toFixed(1)}K` : `₹${Math.round(n).toLocaleString()}`);

function initials(name: string) {
  const p = (name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <View style={[s.pill, { backgroundColor: up ? 'rgba(18,183,106,0.14)' : 'rgba(240,68,56,0.14)' }]}>
      <Text style={[s.pillTxt, { color: up ? M.good : M.bad }]}>{up ? '▲' : '▼'} {Math.abs(pct)}%</Text>
    </View>
  );
}

export function HeroPanel({ hero, trend }: { hero: DashboardData['hero']; trend: DashboardData['shareTrend'] }) {
  const vals = trend.map((t) => t.shares);
  const max = Math.max(1, ...vals);
  const w = 118, h = 30, n = vals.length;
  const pts = vals.map((v, i) => `${(n <= 1 ? w / 2 : (i / (n - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
  return (
    <View style={s.hero}>
      <Text style={s.heroLabel}>Total shares</Text>
      <Text style={s.heroBig}>{hero.totalShares.toLocaleString()}</Text>
      <View style={s.heroRow}>
        <View style={s.heroPill}><Text style={s.heroPillTxt}>▲ {hero.sharesToday} today</Text></View>
        {n > 1 && (
          <Svg width={w} height={h} style={{ marginLeft: 'auto' }}>
            <Polyline points={pts} fill="none" stroke={M.heroLabel} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={s.heroSubRow}>
        <View><Text style={s.heroSubK}>Coins from shares</Text><Text style={s.heroSubV}>{fmt(hero.coinsFromShares)} CR</Text></View>
        <View><Text style={s.heroSubK}>Coin liability</Text><Text style={s.heroSubV}>{cur(hero.liabilityRupees)}</Text></View>
      </View>
    </View>
  );
}

export function MetricCard({ label, c, accent, money }: { label: string; c: Delta; accent: string; money?: boolean }) {
  return (
    <View style={s.metric}>
      <View style={[s.stripe, { backgroundColor: accent }]} />
      <View style={s.metricTop}><DeltaPill pct={c.deltaPct} /></View>
      <Text style={s.metricV}>{money ? fmt(c.value) : c.value.toLocaleString()}</Text>
      <Text style={s.metricL}>{label}</Text>
    </View>
  );
}

export function SharersBoard({ rows }: { rows: DashboardData['topSharers'] }) {
  if (!rows.length) return <Text style={s.empty}>No sharers yet — rankings appear as users share.</Text>;
  const top = rows[0]?.shares || 1;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={s.lr}>
          <View style={[s.avatar, { backgroundColor: M.avatars[i % M.avatars.length] }]}><Text style={s.avatarTxt}>{initials(r.name)}</Text></View>
          <View style={s.lmid}>
            <Text style={s.lname} numberOfLines={1}>{r.name}</Text>
            <View style={s.bar}><View style={[s.barFill, { width: `${Math.round((r.shares / top) * 100)}%` }]} /></View>
          </View>
          <Text style={s.lval}>{r.shares}</Text>
        </View>
      ))}
    </View>
  );
}

export function SharedItemsBoard({ rows }: { rows: DashboardData['topSharedItems'] }) {
  if (!rows.length) return <Text style={s.empty}>No shared items yet.</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={s.ir}>
          <Text style={s.irank}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={s.iname} numberOfLines={1}>{r.name}</Text>
          <View style={[s.tag, { borderColor: M.line }]}><Text style={s.tagTxt}>{r.itemType}</Text></View>
          <Text style={s.ival}>{r.shares}</Text>
        </View>
      ))}
    </View>
  );
}

export function RevenueStrip({ revenue }: { revenue: DashboardData['revenue'] }) {
  const cells = [
    { v: fmt(revenue.clicks), l: 'Clicks' },
    { v: revenue.purchases.toLocaleString(), l: 'Purchases' },
    { v: cur(revenue.commission), l: 'Commission' },
  ];
  return (
    <View style={s.rev}>
      {cells.map((c, i) => (
        <View key={i} style={s.revCell}><Text style={s.revV}>{c.v}</Text><Text style={s.revL}>{c.l}</Text></View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: M.hero, borderRadius: 20, padding: 18, marginBottom: 12 },
  heroLabel: { color: M.heroLabel, fontSize: 12, fontWeight: '600' },
  heroBig: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroPill: { backgroundColor: 'rgba(43,209,134,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillTxt: { color: '#4ade9a', fontSize: 12, fontWeight: '700' },
  heroSubRow: { flexDirection: 'row', gap: 28, marginTop: 16 },
  heroSubK: { color: M.heroSub, fontSize: 11 },
  heroSubV: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },

  metric: { flex: 1, minWidth: '46%', backgroundColor: M.card, borderRadius: 15, padding: 13, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  metricTop: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 20 },
  metricV: { fontSize: 22, fontWeight: '800', color: M.ink, marginTop: 6, fontVariant: ['tabular-nums'] },
  metricL: { fontSize: 11, color: M.ink2, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  lr: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: M.line },
  avatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  lmid: { flex: 1, minWidth: 0 },
  lname: { fontSize: 13, fontWeight: '600', color: M.ink },
  bar: { height: 5, borderRadius: 3, backgroundColor: M.line, marginTop: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: M.indigo },
  lval: { fontSize: 14, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },

  ir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: M.line },
  irank: { fontSize: 11, color: M.ink2, width: 18, fontVariant: ['tabular-nums'] },
  iname: { flex: 1, fontSize: 13, color: M.ink },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  tagTxt: { fontSize: 10, color: M.ink2 },
  ival: { fontSize: 13, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },

  rev: { flexDirection: 'row', backgroundColor: M.card, borderRadius: 14, padding: 12 },
  revCell: { flex: 1, alignItems: 'center' },
  revV: { fontSize: 15, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },
  revL: { fontSize: 10, color: M.ink2, marginTop: 2 },
  empty: { fontSize: 12, color: M.ink2, textAlign: 'center', paddingVertical: 20 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors. (Parts aren't consumed until Task 5.)

- [ ] **Step 3: Commit**

```bash
git add chingiring-app/src/components/dashboard/parts.tsx
git commit -m "feat(dashboard): Momentum presentational parts + payload types"
```

---

### Task 5: Rewrite `MobileAdminDashboard` (primary, single column)

**Files:**
- Modify: `chingiring-app/src/screens/Admin/MobileAdminDashboard.tsx`

**Interfaces:**
- Consumes: `DashboardData`, `EMPTY_DASHBOARD`, `M`, `fmt`, `HeroPanel`, `MetricCard`, `SharersBoard`, `RevenueStrip` from `../../components/dashboard/parts`; `TrendChart` from `../../components/TrendChart`.

- [ ] **Step 1: Replace imports + body**

Remove the old stat/coins/table imports (`MousePointerClick`, `CheckCircle`, `DollarSign`, `RevenueTrendChart`, the local `StatCard`/`CoinsPill`/`RankRow`, and `FB`). Keep `MobileAdminNav`, `SafeAreaView`, `ScrollView`, `ActivityIndicator`, `useQuery`. Add:

```tsx
import { Coins, TrendingUp } from 'lucide-react-native';
import { TrendChart } from '../../components/TrendChart';
import {
  DashboardData, EMPTY_DASHBOARD, M, fmt,
  HeroPanel, MetricCard, SharersBoard, RevenueStrip,
} from '../../components/dashboard/parts';
```

Replace the component body (data wiring + JSX) with:

```tsx
export const MobileAdminDashboard = () => {
  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboardStats(),
  });
  const d: DashboardData = res?.data ?? EMPTY_DASHBOARD;

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={M.indigo} /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <MobileAdminNav active="AdminDashboard" />

        <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <HeroPanel hero={d.hero} trend={d.shareTrend} />

          <View style={s.grid}>
            <MetricCard label="Shares today" c={d.cards.sharesToday} accent={M.amber} />
            <MetricCard label="Shares · 30d" c={d.cards.shares30d} accent={M.green} />
            <MetricCard label="Unique sharers · 30d" c={d.cards.uniqueSharers30d} accent={M.indigo} />
            <MetricCard label="Coins issued · 30d" c={d.cards.coinsIssued30d} accent={M.red} money />
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sHead}><Coins size={16} color={M.ink} /><Text style={s.sTitle}>Coins economy</Text></View>
          <View style={s.pills}>
            <View style={[s.pill, { backgroundColor: 'rgba(18,183,106,0.10)' }]}><Text style={[s.pillV, { color: M.good }]}>{fmt(d.coinsEconomy.issued)}</Text><Text style={s.pillL}>Issued</Text></View>
            <View style={[s.pill, { backgroundColor: 'rgba(240,68,56,0.10)' }]}><Text style={[s.pillV, { color: M.bad }]}>{fmt(d.coinsEconomy.redeemed)}</Text><Text style={s.pillL}>Redeemed</Text></View>
            <View style={[s.pill, { backgroundColor: 'rgba(91,75,230,0.10)' }]}><Text style={[s.pillV, { color: M.indigo }]}>{fmt(d.coinsEconomy.circulation)}</Text><Text style={s.pillL}>Circulating</Text></View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sHead}><TrendingUp size={16} color={M.ink} /><Text style={s.sTitle}>Share momentum · 30 days</Text></View>
          <TrendChart data={d.shareTrend.map((p) => ({ label: p.label, value: p.shares }))} color={M.indigo} />
        </View>

        <View style={s.section}>
          <Text style={s.sTitle}>Top sharers</Text>
          <View style={{ marginTop: 8 }}><SharersBoard rows={d.topSharers} /></View>
        </View>

        <View style={{ paddingHorizontal: 12 }}><RevenueStrip revenue={d.revenue} /></View>
      </ScrollView>
    </SafeAreaView>
  );
};
```

- [ ] **Step 2: Update the stylesheet**

Replace the old `s` StyleSheet with (keep `root`; drop stat/coin/rank/chart styles):

```tsx
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: M.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { backgroundColor: M.card, borderRadius: 16, marginHorizontal: 12, marginTop: 12, padding: 16 },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sTitle: { fontSize: 16, fontWeight: '700', color: M.ink },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  pillV: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pillL: { fontSize: 11, color: M.ink2, marginTop: 4 },
});
```

- [ ] **Step 3: Typecheck**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no errors in `MobileAdminDashboard.tsx`.

- [ ] **Step 4: Visual verification**

Launch the app (Expo — iOS simulator, or `npx expo start --web`), sign in as admin, open the dashboard. Confirm against the mockup (Direction B): indigo hero with total shares + "▲ N today" + sparkline; 2×2 accent-striped cards with delta pills (and NO pill where data is a fresh-install zero baseline); coins-economy pills; share-momentum area chart; top-sharers list with avatars + bars; revenue strip. Screenshot it.

- [ ] **Step 5: Commit**

```bash
git add chingiring-app/src/screens/Admin/MobileAdminDashboard.tsx
git commit -m "feat(dashboard): Momentum mobile admin dashboard"
```

---

### Task 6: Rewrite `AdminDashboardScreen` (web/desktop, wide) + delete old chart

**Files:**
- Modify: `chingiring-app/src/screens/Admin/AdminDashboardScreen.tsx`
- Delete: `chingiring-app/src/components/RevenueTrendChart.tsx`

**Interfaces:**
- Consumes: same parts as Task 5, plus `SharedItemsBoard`.

- [ ] **Step 1: Rewrite the screen**

Replace the whole file body. Reuse the parts; on wide screens put the hero full-width, the four cards in one row, the two leaderboards side by side, and the trend + revenue below.

```tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Coins } from 'lucide-react-native';
import { adminAPI } from '../../api/admin';
import { TrendChart } from '../../components/TrendChart';
import {
  DashboardData, EMPTY_DASHBOARD, M, fmt,
  HeroPanel, MetricCard, SharersBoard, SharedItemsBoard, RevenueStrip,
} from '../../components/dashboard/parts';

export function AdminDashboardScreen() {
  const { data } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminAPI.getDashboardStats });
  const d: DashboardData = data?.data ?? EMPTY_DASHBOARD;
  const isDesktop = Dimensions.get('window').width >= 768;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Dashboard</Text>

      <HeroPanel hero={d.hero} trend={d.shareTrend} />

      <View style={[s.cards, !isDesktop && s.wrap]}>
        <MetricCard label="Shares today" c={d.cards.sharesToday} accent={M.amber} />
        <MetricCard label="Shares · 30d" c={d.cards.shares30d} accent={M.green} />
        <MetricCard label="Unique sharers · 30d" c={d.cards.uniqueSharers30d} accent={M.indigo} />
        <MetricCard label="Coins issued · 30d" c={d.cards.coinsIssued30d} accent={M.red} money />
      </View>

      <View style={s.section}>
        <View style={s.sHead}><Coins size={18} color={M.ink} /><Text style={s.sTitle}>Coins economy</Text></View>
        <View style={s.pills}>
          <View style={[s.pill, { backgroundColor: 'rgba(18,183,106,0.10)' }]}><Text style={[s.pillV, { color: M.good }]}>{fmt(d.coinsEconomy.issued)}</Text><Text style={s.pillL}>Issued</Text></View>
          <View style={[s.pill, { backgroundColor: 'rgba(240,68,56,0.10)' }]}><Text style={[s.pillV, { color: M.bad }]}>{fmt(d.coinsEconomy.redeemed)}</Text><Text style={s.pillL}>Redeemed</Text></View>
          <View style={[s.pill, { backgroundColor: 'rgba(91,75,230,0.10)' }]}><Text style={[s.pillV, { color: M.indigo }]}>{fmt(d.coinsEconomy.circulation)}</Text><Text style={s.pillL}>Circulating</Text></View>
        </View>
      </View>

      <View style={s.section}>
        <View style={s.sHead}><TrendingUp size={18} color={M.ink} /><Text style={s.sTitle}>Share momentum · 30 days</Text></View>
        <TrendChart data={d.shareTrend.map((p) => ({ label: p.label, value: p.shares }))} color={M.indigo} />
      </View>

      <View style={[s.boards, !isDesktop && s.wrap]}>
        <View style={[s.board, !isDesktop && s.boardMobile]}><Text style={s.sTitle}>Top sharers</Text><View style={{ marginTop: 8 }}><SharersBoard rows={d.topSharers} /></View></View>
        <View style={[s.board, !isDesktop && s.boardMobile]}><Text style={s.sTitle}>Top shared items</Text><View style={{ marginTop: 8 }}><SharedItemsBoard rows={d.topSharedItems} /></View></View>
      </View>

      <RevenueStrip revenue={d.revenue} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },
  content: { padding: 20, gap: 16 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: M.ink },
  cards: { flexDirection: 'row', gap: 12 },
  wrap: { flexWrap: 'wrap' },
  section: { backgroundColor: M.card, borderRadius: 12, padding: 16 },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sTitle: { fontSize: 16, fontWeight: '600', color: M.ink },
  pills: { flexDirection: 'row', gap: 12 },
  pill: { flex: 1, minWidth: 130, borderRadius: 10, padding: 14, alignItems: 'center' },
  pillV: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillL: { fontSize: 12, color: M.ink2, marginTop: 4 },
  boards: { flexDirection: 'row', gap: 16 },
  board: { flex: 1, backgroundColor: M.card, borderRadius: 12, padding: 16 },
  boardMobile: { marginBottom: 12 },
});
```

- [ ] **Step 2: Delete the old chart**

```bash
git rm chingiring-app/src/components/RevenueTrendChart.tsx
```

- [ ] **Step 3: Typecheck (confirms nothing else imports the deleted chart)**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no errors, no unresolved import of `RevenueTrendChart`.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/screens/Admin/AdminDashboardScreen.tsx
git commit -m "feat(dashboard): Momentum web admin dashboard; drop RevenueTrendChart"
```

---

## Self-review

**Spec coverage:** hero (totalShares/sharesToday/coinsFromShares/liability) → Task 2 + HeroPanel (4/5). Four PoP cards → Task 2 `cards` + MetricCard (4/5). Coins economy + ₹ liability → Task 2 + screens (5). 30d share trend → `fillTrend`/`trendDays` (1) + `TrendChart` (3) + screens (5/6). Top sharers / shared items → Task 2 resolves names + SharersBoard/SharedItemsBoard (4). Revenue strip w/ purchase-pollution fix → `notShare` filter (2) + RevenueStrip (4). `{day:1}` index → Task 2 step 1. Deltas null-when-no-baseline → `pctDelta` (1) + `DeltaPill` early-return (4). Deleted legacy cards/topDeals/revenueTrend → Tasks 5/6. All spec sections covered.

**Placeholder scan:** no TBD/TODO; every code step is complete; list rendering is data-driven (`.map`), not "similar to".

**Type consistency:** `DashboardData` (Task 4) matches the Task 2 payload field-for-field (`hero`, `cards.{sharesToday,shares30d,uniqueSharers30d,coinsIssued30d}` as `{value,deltaPct}`, `coinsEconomy`, `shareTrend:{label,shares}`, `topSharers`, `topSharedItems`, `revenue`). `TrendChart` consumes `{label,value}`; screens map `shareTrend.shares → value`. `pctDelta` returns `number|null`; `Delta.deltaPct` is `number|null`; `DeltaPill` handles null.

## Risks

- `AdminSettings.coinsPerRupee` may be the stale `10` in the live doc → liability 100× high. Same fix as the withdrawal deploy gate; verify the stored value before showing this to anyone.
- `estimatedDocumentCount()` is O(1) but approximate; acceptable for headline totals.
- Visual verification depends on being able to run Expo as admin; if the simulator isn't available, at minimum `tsc --noEmit` gates the wiring and the mockup remains the visual contract.
