# Share reward visibility + notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each user their total pending and total confirmed share-reward coins on the wallet + profile screens, and send proper `share_pending` / `share_confirmed` notifications.

**Architecture:** The two totals are derived from `ShareEvent` (summed by status) and returned on `GET /api/wallet` — no wallet balance is mutated (preserves the click-confirmed "withhold, no clawback" model). Two new typed notification templates are wired into the existing share-create and confirm paths and render in the existing `NotificationsScreen`.

**Tech Stack:** Node/Express + Mongoose (ESM), Jest. React Native (Expo) + `@tanstack/react-query`.

## Global Constraints

- **Derived-only:** never touch `wallet.coins` / `wallet.pendingCoins` for this — the totals come from aggregating `ShareEvent.coinsAwarded` by `status`.
- **Notifications reuse the `cashback` pref** (no notificationPrefs schema change).
- **Both notify calls are best-effort** — `.catch(() => {})`; a notification failure must never fail a share or a confirm.
- **`share_pending` fires only on a real new pending share** — not on the E11000 duplicate path.
- **Both totals hide when 0** in the UI.
- Copy (verbatim): `share_pending` → title `Share registered ⏳`, body `{coins} CR pending — unlocks when a friend opens your link.`; `share_confirmed` → title `Your share paid off 🎉`, body `Someone opened your shared {itemType} — {coins} CR added to your wallet.`

## File structure

- Modify `backend/src/modules/notifications/notificationTemplates.js` — +2 cases.
- Modify `backend/src/modules/notifications/notificationService.js` — +2 `CATEGORY` entries.
- Modify `backend/src/modules/shares/shareController.js` — re-import `notify`; fire `share_pending`.
- Modify `backend/src/modules/shares/shareRedirectController.js` — swap `wallet_credited` → `share_confirmed`.
- Modify `backend/src/modules/wallet/walletController.js` — `getWallet` returns `shareRewards`.
- Create `backend/src/__tests__/notificationTemplates.test.js`.
- Modify `chingiring-app/src/api/wallet.ts` — `ShareRewards` type.
- Create `chingiring-app/src/components/ShareRewardsSummary.tsx`.
- Modify the 4 screens to render it: `MobileWalletScreen.tsx`, `WalletScreen.tsx`, `MobileProfileScreen.tsx`, `ProfileScreen.tsx`.

---

### Task 1: Backend — `shareRewards` on the wallet + the two notifications

**Files:**
- Modify: `backend/src/modules/notifications/notificationTemplates.js`
- Modify: `backend/src/modules/notifications/notificationService.js`
- Modify: `backend/src/modules/shares/shareController.js`
- Modify: `backend/src/modules/shares/shareRedirectController.js`
- Modify: `backend/src/modules/wallet/walletController.js`
- Test: `backend/src/__tests__/notificationTemplates.test.js`

**Interfaces:**
- Produces: `GET /api/wallet` → `{ status, data: { wallet, shareRewards: { pending: number, confirmed: number } } }`.
- Notification types `share_pending` (`data:{coins}`) and `share_confirmed` (`data:{coins, itemType}`).

- [ ] **Step 1: Write the failing test for the two templates**

```js
// backend/src/__tests__/notificationTemplates.test.js
import { describe, it, expect } from '@jest/globals';
import { buildTemplate } from '../modules/notifications/notificationTemplates.js';

describe('buildTemplate — share notifications', () => {
  it('share_pending', () => {
    expect(buildTemplate('share_pending', { coins: 50 })).toEqual({
      title: 'Share registered ⏳',
      body: '50 CR pending — unlocks when a friend opens your link.',
    });
  });
  it('share_confirmed', () => {
    expect(buildTemplate('share_confirmed', { coins: 50, itemType: 'product' })).toEqual({
      title: 'Your share paid off 🎉',
      body: 'Someone opened your shared product — 50 CR added to your wallet.',
    });
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd backend && npm test -- notificationTemplates`
Expected: FAIL — `buildTemplate` throws `Unknown notification type: share_pending`.

- [ ] **Step 3: Add the two template cases**

In `notificationTemplates.js`, add before `default:`:

```js
    case 'share_pending':
      return {
        title: 'Share registered ⏳',
        body: `${data.coins} CR pending — unlocks when a friend opens your link.`,
      };
    case 'share_confirmed':
      return {
        title: 'Your share paid off 🎉',
        body: `Someone opened your shared ${data.itemType} — ${data.coins} CR added to your wallet.`,
      };
```

- [ ] **Step 4: Run it — verify it passes**

Run: `cd backend && npm test -- notificationTemplates`
Expected: PASS (2 tests).

- [ ] **Step 5: Map both types to the `cashback` pref**

In `notificationService.js`, add to the `CATEGORY` object:

```js
  share_pending: 'cashback',
  share_confirmed: 'cashback',
```

- [ ] **Step 6: Fire `share_pending` from `createShare`**

In `shareController.js`, re-add the import at the top (it was removed when crediting moved out):

```js
import { notify } from '../notifications/notificationService.js';
```

Then, in `createShare`, immediately after the post-insert cap-check block (the `if (after > maxSharesPerDay) { … }`) and before the `res.status(201)` response, add:

```js
  notify({ userId, type: 'share_pending', data: { coins: coinsPerShare } }).catch(() => {});
```

(Do NOT add it on the E11000 duplicate branch — that path early-returns without a new pending share.)

- [ ] **Step 7: Swap the confirm notification to `share_confirmed`**

In `shareRedirectController.js`, replace the existing line:

```js
  notify({ userId: ev.userId, type: 'wallet_credited', data: { amount: ev.coinsAwarded, currency: 'coins' } }).catch(() => {});
```

with:

```js
  notify({ userId: ev.userId, type: 'share_confirmed', data: { coins: ev.coinsAwarded, itemType: ev.itemType } }).catch(() => {});
```

- [ ] **Step 8: Return `shareRewards` from `getWallet`**

In `walletController.js`, add the import:

```js
import ShareEvent from '../shares/shareModel.js';
```

Replace the body of `getWallet` with:

```js
export const getWallet = async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id }).lean();
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id });
    wallet = wallet.toObject();
  }

  // Derived, display-only — never mutates wallet balances.
  const agg = await ShareEvent.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: '$status', coins: { $sum: '$coinsAwarded' } } },
  ]);
  const byStatus = Object.fromEntries(agg.map((r) => [r._id, r.coins]));
  const shareRewards = { pending: byStatus.pending || 0, confirmed: byStatus.confirmed || 0 };

  res.status(200).json({ status: 'success', data: { wallet, shareRewards } });
};
```

- [ ] **Step 9: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS — the new template test + existing suites (the 2 pre-existing DB-timeout suites `deals`/`categories` stay failing for lack of Mongo, unrelated).

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/notifications/notificationTemplates.js backend/src/modules/notifications/notificationService.js backend/src/modules/shares/shareController.js backend/src/modules/shares/shareRedirectController.js backend/src/modules/wallet/walletController.js backend/src/__tests__/notificationTemplates.test.js
git commit -m "feat(shares): shareRewards totals on /api/wallet + share_pending/share_confirmed notifications"
```

---

### Task 2: Frontend — pending/confirmed totals on wallet + profile

**Files:**
- Modify: `chingiring-app/src/api/wallet.ts`
- Create: `chingiring-app/src/components/ShareRewardsSummary.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/MobileWalletScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/WalletScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/MobileProfileScreen.tsx`
- Modify: `chingiring-app/src/screens/Dashboard/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `GET /api/wallet` → `data.shareRewards: { pending, confirmed }` (Task 1).
- Produces: `ShareRewardsSummary({ pending: number; confirmed: number })`.

- [ ] **Step 1: Add the response type**

In `chingiring-app/src/api/wallet.ts`, add:

```ts
export interface ShareRewards { pending: number; confirmed: number; }
```

(`walletAPI.getWallet()` returns the axios body `{ status, data: { wallet, shareRewards } }`; screens read `res?.data?.shareRewards`.)

- [ ] **Step 2: Create the shared display component**

```tsx
// chingiring-app/src/components/ShareRewardsSummary.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ShareRewardsSummary({ pending, confirmed }: { pending: number; confirmed: number }) {
  if (!pending && !confirmed) return null;
  return (
    <View style={s.wrap}>
      {pending > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Pending</Text>
          <Text style={[s.val, { color: '#f79009' }]}>{pending.toLocaleString('en-IN')} CR</Text>
          <Text style={s.hint}>unlocks when friends open your links</Text>
        </View>
      )}
      {confirmed > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Earned from shares</Text>
          <Text style={[s.val, { color: '#12b76a' }]}>{confirmed.toLocaleString('en-IN')} CR</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  val: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 11, color: '#94a3b8' },
});

export default ShareRewardsSummary;
```

- [ ] **Step 3: Wire into `MobileWalletScreen` + `WalletScreen`**

Both already run the `['wallet']` query and invalidate it after a share. In each, read `shareRewards` from that query's result and render the component just below the balance card:

```tsx
import { ShareRewardsSummary } from '../../components/ShareRewardsSummary';
// ...
const shareRewards = (walletRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };
// in JSX, under the coin-balance card:
<ShareRewardsSummary pending={shareRewards.pending} confirmed={shareRewards.confirmed} />
```

Use the actual name of each screen's existing `['wallet']` query result variable (read the file — `MobileWalletScreen.tsx` invalidates `['wallet']` at line 96; `WalletScreen.tsx` at line 94). If a screen doesn't already hold the query result in a variable, read it from the existing `useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() })`.

- [ ] **Step 4: Wire into `MobileProfileScreen`**

It already has `const { data: walletRes } = useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() })` (line ~91) and shows a coins StatCard (line ~170). Add near the coins stat:

```tsx
import { ShareRewardsSummary } from '../../components/ShareRewardsSummary';
// ...
const shareRewards = (walletRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };
// below the stats row:
<ShareRewardsSummary pending={shareRewards.pending} confirmed={shareRewards.confirmed} />
```

- [ ] **Step 5: Wire into `ProfileScreen` (web) — add a `['wallet']` query**

`ProfileScreen.tsx` reads `['walletSummary']`, not `['wallet']`, so add a query for the totals (react-query dedupes it with other `['wallet']` consumers) and render near the `wallet.coins` display (line ~233):

```tsx
import { ShareRewardsSummary } from '../../components/ShareRewardsSummary';
import { walletAPI } from '../../api/wallet';
// ...
const { data: walletRes } = useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() });
const shareRewards = (walletRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };
// near the coins amount:
<ShareRewardsSummary pending={shareRewards.pending} confirmed={shareRewards.confirmed} />
```

- [ ] **Step 6: Typecheck**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors from the touched files (pre-existing `MyAddressScreen.tsx:124` error may remain).

- [ ] **Step 7: Commit**

```bash
git add chingiring-app/src/api/wallet.ts chingiring-app/src/components/ShareRewardsSummary.tsx chingiring-app/src/screens/Dashboard/MobileWalletScreen.tsx chingiring-app/src/screens/Dashboard/WalletScreen.tsx chingiring-app/src/screens/Dashboard/MobileProfileScreen.tsx chingiring-app/src/screens/Dashboard/ProfileScreen.tsx
git commit -m "feat(shares): show pending + earned-from-shares totals on wallet & profile"
```

---

## Self-review

**Spec coverage:** two totals derived from `ShareEvent` by status → Task 1 Step 8. Exposed on `GET /api/wallet` → Task 1 Step 8. `share_pending` on share (best-effort, not on duplicate) → Task 1 Steps 3/6. `share_confirmed` on confirm (replaces `wallet_credited`) → Task 1 Steps 3/7. Reuse `cashback` pref → Step 5. Wallet + profile display, hide at 0 → Task 2 (component + 4 screens). `buildTemplate` unit test → Task 1 Steps 1-4. All spec sections covered.

**Placeholder scan:** every code step is complete; screen-wiring gives the exact query key, variable pattern, and insertion anchor per screen (the implementer reads each file for the local variable name — a concrete, bounded lookup, not a placeholder).

**Type consistency:** `shareRewards: { pending, confirmed }` is identical across Task 1 (backend return) and Task 2 (`ShareRewards` type + `ShareRewardsSummary` props). Notification `data` keys — `share_pending` uses `{coins}`, `share_confirmed` uses `{coins, itemType}` — match the template interpolation and the wiring calls exactly.

## Risks

- `share_pending` fires per share (≤100/day/user), gated by the `cashback` pref — accepted per the product decision.
- The `shareRewards` aggregation runs on every `GET /api/wallet`; it's a small indexed-ish group over the user's own ShareEvents — fine at expected volume.
