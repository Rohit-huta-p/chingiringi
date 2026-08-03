# Share-to-Earn — App Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on:** `2026-08-03-share-to-earn-backend.md` — `/api/shares` must be deployed first.

**Goal:** Turn every product and offline-store share into a 100-coin credit, reflected in the wallet immediately, and remove the affiliate "Shop Now / Buy Now" buy path from user-facing product/store screens.

**Architecture:** A new `sharesAPI` client mirrors the existing `walletAPI` object shape. The two product-detail screens (`ProductDetailScreen` web, `MobileProductDetailScreen` mobile) already own a `handleShareProduct` — we open the OS share sheet FIRST, and only credit (call `sharesAPI.postShare()`) after it reports a completed share (`sharedAction` on native, a resolved `navigator.share` on web), then invalidate the React-Query wallet caches so the balance updates on next focus. The shared link is a plain item URL carrying `?ref=cr_<userId>` so the existing `clicks/` pipeline can attribute later. Offline stores get a Share button on `StoreCard`. Buy CTAs are removed; Share becomes the primary CTA.

**Tech Stack:** React Native + Expo, axios (`apiClient`), @tanstack/react-query, built-in `Share` + `Alert`. No new dependencies.

## Global Constraints

- Credit flow: build a plain link `${SHARE_BASE}/${itemType}/${itemId}?ref=cr_${userId}` (SHARE_BASE = `process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app'`; `userId` from `useAuthStore`) → `Share.share({ message with link })` → **credit only if the sheet completed** (`result.action === Share.sharedAction` on native; a resolved `navigator.share`/clipboard copy on web) → `sharesAPI.postShare(itemType,id)` → invalidate `['wallet']`, `['walletSummary']`, `['shareQuota']` → `Alert`. On `duplicate:true`/`coinsAwarded:0`, show "You've already earned for this today". **Caveat:** Android's `Share` result is unreliable (`sharedAction` can fire on dismiss and vice-versa) — accepted trade-off of crediting after the sheet rather than on tap. Abuse is bounded by the server's daily cap + per-item-per-day dedup.
- Reflect balance via React-Query invalidation only — never write coin math on the client.
- Share-only: REMOVE Shop Now / Buy Now CTAs from `ProductDetailScreen` + `MobileProductDetailScreen`. Do NOT touch admin screens or `MobileAdminDeals` (its `Linking.openURL` is admin tooling).
- Use the existing `apiClient`, the `xxxAPI` object pattern, built-in `Share`/`Alert`. No new deps.
- After the backend rate reset (backend Task 2), the app's hardcoded `COINS_PER_RUPEE = 10` / `RATE = 10` is wrong — fix to 1000 (Task 6).

---

### Task 1: sharesAPI client

**Files:**
- Create: `chingiring-app/src/api/shares.ts`

**Interfaces:**
- Produces: `sharesAPI.postShare(itemType:'product'|'store', itemId:string) → Promise<{status,data:{shareToken,shareUrl,coinsAwarded,remainingToday,duplicate?}}>`; `sharesAPI.getQuota() → Promise<{status,data:{usedToday,remaining,cap}}>`.

- [ ] **Step 1: Implement (mirrors api/wallet.ts object style)**

```ts
// chingiring-app/src/api/shares.ts
import apiClient from './client';

export interface ShareResult {
  coinsAwarded: number;
  remainingToday: number;
  duplicate?: boolean;
}

export interface ShareQuota {
  usedToday: number;
  remaining: number;
  cap: number;
}

export const sharesAPI = {
  postShare: async (itemType: 'product' | 'store', itemId: string) => {
    const res = await apiClient.post('/api/shares', { itemType, itemId });
    return res.data as { status: string; data: ShareResult };
  },
  getQuota: async () => {
    const res = await apiClient.get('/api/shares/quota');
    return res.data as { status: string; data: ShareQuota };
  },
};
```

- [ ] **Step 2: Type-check**

Run: `cd chingiring-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add chingiring-app/src/api/shares.ts
git commit -m "feat(app): sharesAPI client for /api/shares"
```

---

### Task 2: Wire share→credit + remove Buy CTA — MobileProductDetailScreen

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/MobileProductDetailScreen.tsx` (`handleShareProduct` ~394-415; the inner "Shop Now · price" CTA ~333-340; props ~101-110)

**Interfaces:**
- Consumes: `sharesAPI` (Task 1), the screen's existing `queryClient` (~376), `productForView?._id || productId`.

- [ ] **Step 1: Imports**

Add near the other api imports at the top of the file:

```ts
import { sharesAPI } from '../../api/shares';
import { useAuthStore } from '../../store'; // if not already imported
```
In the component body (if `user` isn't already in scope): `const user = useAuthStore((s) => s.user);`

- [ ] **Step 2: Reward on share — replace `handleShareProduct` body (~394-415)**

```ts
    const handleShareProduct = async () => {
      const pid = productForView?._id || productId;
      const shareTitle = productForView?.name || 'Check out this product';
      const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app';
      const shareUrl = pid && pid !== 'sample' ? `${base}/product/${pid}?ref=cr_${user?._id ?? ''}` : '';
      const message = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle;

      // 1) Open the share sheet. 2) Credit ONLY if it reports a completed share.
      let shared = false;
      try {
        if (Platform.OS === 'web') {
          const nav: any = (globalThis as any).navigator;
          if (nav?.share) { await nav.share({ title: shareTitle, text: shareTitle, url: shareUrl || undefined }); shared = true; }
          else if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(message); shared = true; }
        } else {
          const result = await Share.share({ message, title: shareTitle });
          shared = result.action === Share.sharedAction; // credit only on a real share
        }
      } catch { shared = false; /* dismissed / AbortError → no credit */ }

      if (!shared || !pid || pid === 'sample') return;
      try {
        const { data } = await sharesAPI.postShare('product', pid);
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
        queryClient.invalidateQueries({ queryKey: ['shareQuota'] });
        Alert.alert(
          data.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
          data.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
        );
      } catch { /* cap reached or offline; the share already happened */ }
    };
```

- [ ] **Step 3: Make Share the CTA — replace the Buy CTA (~333-340)**

Delete the `onShopNow` "Shop Now · price" `TouchableOpacity` and render a share button instead. Thread an `onShare` prop into the inner card component (mirror how `onShopNow` is declared at ~101/110 and passed from the outer component), pointing at `handleShareProduct`:

```tsx
        <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={pStyles.ctaWrap}>
          <Text style={pStyles.ctaText}>Share &amp; Earn 100 CR</Text>
        </TouchableOpacity>
```

Remove the now-unused `onShopNow` prop + `handleBuyProduct` (~419-439) and its `clicksAPI` usage if nothing else references them.

- [ ] **Step 4: Verify on web preview**

Start the app preview, open a product, tap Share & Earn. Confirm: Alert shows the reward, wallet coins increase after returning to the Wallet tab, and no "Shop Now" button remains.

- [ ] **Step 5: Commit**

```bash
git add chingiring-app/src/screens/Dashboard/MobileProductDetailScreen.tsx
git commit -m "feat(app): mobile product share credits 100 CR; remove buy CTA"
```

---

### Task 3: Wire share→credit + remove Buy CTA — ProductDetailScreen (web)

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/ProductDetailScreen.tsx` (share handler around the `Share.share` at ~244 and message build ~229; CTAs "Buy Now ↗" ~534 and "Shop Now & Earn Cashback ↗" ~698; `handleShopNow` ~174, product buy ~197)

**Interfaces:**
- Consumes: `sharesAPI`; add `useQueryClient` if not already imported.

- [ ] **Step 1: Imports**

```ts
import { sharesAPI } from '../../api/shares';
import { useAuthStore } from '../../store';
// ensure present: import { useQueryClient } from '@tanstack/react-query';
```
In the component: `const qc = useQueryClient();` and `const user = useAuthStore((s) => s.user);`

- [ ] **Step 2: Build the ref link, share, then credit after the sheet**

Replace the handler's message/share block (around the `Share.share` at ~244). Credit only when the sheet completes:

```ts
      const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app';
      const pid = product?._id || productId;
      const shareUrl = isProductMode && pid && pid !== 'sample'
        ? `${base}/product/${pid}?ref=cr_${user?._id ?? ''}` : '';
      const message = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle;

      let shared = false;
      try {
        if (Platform.OS === 'web') {
          const nav: any = (globalThis as any).navigator;
          if (nav?.share) { await nav.share({ title: shareTitle, text: shareTitle, url: shareUrl || undefined }); shared = true; }
          else if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(message); shared = true; }
        } else {
          const result = await Share.share({ message, title: shareTitle });
          shared = result.action === Share.sharedAction;
        }
      } catch { shared = false; }

      if (shared && isProductMode && pid && pid !== 'sample') {
        try {
          const { data } = await sharesAPI.postShare('product', pid);
          qc.invalidateQueries({ queryKey: ['wallet'] });
          qc.invalidateQueries({ queryKey: ['walletSummary'] });
          qc.invalidateQueries({ queryKey: ['shareQuota'] });
          Alert.alert(
            data.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
            data.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
          );
        } catch { /* cap/offline — share already happened */ }
      }
```

- [ ] **Step 3: Remove the buy CTAs**

Delete/replace the "Buy Now ↗" button (~533-539) and the "Shop Now & Earn Cashback ↗" button (~698-699, `onPress={handleShopNow}`). Make the share action the primary CTA. Remove `handleShopNow` (~174-189) and the product `handleBuyProduct` (~197-217) if unreferenced after removal.

- [ ] **Step 4: Verify (web preview)** — open a product on web, share, confirm reward + wallet update + no buy button.

- [ ] **Step 5: Commit**

```bash
git add chingiring-app/src/screens/Dashboard/ProductDetailScreen.tsx
git commit -m "feat(app): web product share credits 100 CR; remove buy CTA"
```

---

### Task 4: Offline-store share on StoreCard

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx` (`StoreCard` ~404; add `useQueryClient`; import `Share`, `Alert`, `sharesAPI`)

**Interfaces:**
- Consumes: `sharesAPI`, `store._id`, `store.name`.

- [ ] **Step 1: Imports** — add `Share, Alert` to the `react-native` import; add `import { useQueryClient } from '@tanstack/react-query';` and `import { sharesAPI } from '../../api/shares';`. `useAuthStore` is already imported at the top of this file. Inside `StoreCard`, add `const qc = useQueryClient();` and `const user = useAuthStore((s) => s.user);` (the outer screen's `user` is out of scope in this child component).

- [ ] **Step 2: Add a share handler + button to StoreCard (~404)**

Inside `StoreCard`, add (uses a `qc = useQueryClient()`):

```tsx
  const shareStore = async () => {
    const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app';
    const url = `${base}/store/${store._id}?ref=cr_${user?._id ?? ''}`;
    const msg = `${store.name}\n${url}`;

    let shared = false;
    try {
      if (Platform.OS === 'web') {
        const nav: any = (globalThis as any).navigator;
        if (nav?.share) { await nav.share({ title: store.name, text: store.name, url }); shared = true; }
        else if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(msg); shared = true; }
      } else {
        const result = await Share.share({ message: msg, title: store.name });
        shared = result.action === Share.sharedAction;
      }
    } catch { shared = false; }

    if (!shared) return;
    try {
      const { data } = await sharesAPI.postShare('store', store._id);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['walletSummary'] });
      qc.invalidateQueries({ queryKey: ['shareQuota'] });
      Alert.alert(
        data.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
        data.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
      );
    } catch { /* cap/offline — share already happened */ }
  };
```

Render a small "Share & Earn" button in the card footer (match the card's existing `Pressable`/`Text` styling):

```tsx
  <Pressable onPress={shareStore} hitSlop={8}><Text style={styles.shareCta}>Share &amp; Earn 100 CR</Text></Pressable>
```
Add a `shareCta` style consistent with the card's typography (`Fonts`, `Colors.primary`).

- [ ] **Step 3: Verify (web preview)** — open Offline Stores, tap Share & Earn on a store, confirm reward + wallet update.

- [ ] **Step 4: Commit**

```bash
git add chingiring-app/src/screens/Dashboard/OfflineStoresScreen.tsx
git commit -m "feat(app): offline-store share credits 100 CR"
```

---

### Task 5: Daily-quota counter

**Files:**
- Modify: `MobileProductDetailScreen.tsx`, `ProductDetailScreen.tsx`, `OfflineStoresScreen.tsx` (small addition near each Share CTA)

**Interfaces:**
- Consumes: `sharesAPI.getQuota()` via query key `['shareQuota']`.

- [ ] **Step 1: Add a shared quota query where the Share CTA renders**

```tsx
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const sharesLeft = quotaRes?.data?.remaining;
```
Render beneath the Share CTA: `{sharesLeft != null && <Text style={pStyles.hint}>{sharesLeft}/100 shares left today</Text>}`. Invalidation in Tasks 2-4 already refreshes `['shareQuota']`.

- [ ] **Step 2: Verify** — counter shows and decrements after a share.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(app): show remaining daily shares near Share CTA"
```

---

### Task 6: Fix hardcoded coins→₹ rate (10 → 1000)

**Files:**
- Modify: `chingiring-app/src/screens/Dashboard/WalletScreen.tsx` (`COINS_PER_RUPEE` ~line 9; used ~76,355,469)
- Modify: `chingiring-app/src/screens/Dashboard/MobileWalletScreen.tsx` (`RATE = 10` ~line 79)

The withdrawal preview converts coins→₹ with a hardcoded rate. After backend Task 2 it must be 1000, else the app shows a 100× wrong payout.

- [ ] **Step 1: Set both constants to 1000**

`const COINS_PER_RUPEE = 1000;` and `const RATE = 1000;`. Update the mirror comments (they reference the old default of 10).

- [ ] **Step 2: Verify** — on the Wallet screen, a balance of 1000 coins shows as ₹1 (was ₹100). Withdrawal min (₹10) now needs 10,000 coins.

- [ ] **Step 3: Commit**

```bash
git add chingiring-app/src/screens/Dashboard/WalletScreen.tsx chingiring-app/src/screens/Dashboard/MobileWalletScreen.tsx
git commit -m "fix(app): coins→₹ rate 10→1000 to match reset coin economy"
```

---

### Task 7: End-to-end verification

- [ ] Type-check: `cd chingiring-app && npx tsc --noEmit` — clean.
- [ ] Web preview: share a product → Alert reward → Wallet coins +100. Re-share same product same day → "already earned today", coins unchanged.
- [ ] Share 100 distinct items → 101st share → no coins, quota shows 0 left.
- [ ] No "Shop Now" / "Buy Now" CTA remains on user product/store screens; admin screens unchanged.
- [ ] Wallet shows correct ₹ at the 1000 rate.

## App Done When (binary)

- Sharing a product or store credits 100 coins and the Wallet reflects it on next focus.
- Re-sharing the same item the same day adds nothing (dedup); 101st share/day adds nothing (cap).
- The daily quota counter renders and decrements.
- Buy links are gone from user product/store screens.
- `npx tsc --noEmit` is clean; no new dependencies added.
