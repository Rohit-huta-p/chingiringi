# Guest Mode — Auth Gate Implementation

**Status:** Live on `main` (commit `3bd0d56` + fixes through `7fd8da7`)

## Overview

The app is **publicly accessible** — any user can browse without signing in. Specific high-value actions (buy, share, review, directions, videos, profile stats) are gated behind auth. When a guest taps a gated action:

1. An auth modal appears with context-specific copy.
2. The guest can sign in, create an account, or dismiss.
3. On login, the **originally interrupted action fires automatically** (350 ms delay, after navigation settles).

---

## Infrastructure Files

### `chingiring-app/src/lib/navigationRef.ts` *(NEW)*

Extracted shared navigation ref to avoid circular deps between `RootNavigator` and `AuthGateContext`.

```ts
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<any>();
```

All consumers import from here. `src/lib/push.ts` was updated to match.

---

### `chingiring-app/src/context/AuthGateContext.tsx` *(NEW)*

Core infrastructure. Exposes `useAuthGate()` hook with `requireAuth(cb?, opts?)`.

**How it works:**
- `requireAuth(cb, opts)` — if user is logged in, fires `cb` immediately. If guest, stores `cb` in `pendingCb` ref and shows the modal.
- On login (`user` transitions `null → truthy`), `useEffect` fires: pops any auth screen off the nav stack, then calls the stored `cb` after 350 ms.

```tsx
const { requireAuth } = useAuthGate();
// Gate an action:
requireAuth(() => setShareOpen(true), { title: 'Sign in to share & earn', icon: 'share' });
```

**`AuthGateOpts`**
```ts
type AuthGateIcon = 'default' | 'wallet' | 'gift' | 'video' | 'cart' | 'share' | 'navigation' | 'star';
type AuthGateOpts = { title?: string; subtitle?: string; icon?: AuthGateIcon; };
```

---

### `chingiring-app/src/components/AuthModal.tsx` *(NEW)*

Two exports:

**`<AuthModal>`** — Standard white card `Modal` (transparent, fade). Shows icon badge, contextual title/subtitle, and three buttons: "Sign in" → `navigationRef.navigate('AuthLogin')`, "Create account" → `navigationRef.navigate('AuthSignup')`, "Continue browsing" → dismiss.

Icon map (Lucide):
```
default → ShoppingBag   wallet → Wallet     gift → Gift
video   → Video          cart   → ShoppingCart  share → Share2
navigation → Navigation  star  → Star
```

**`<AuthGateOverlay>`** — `StyleSheet.absoluteFillObject` overlay for partial-screen locks (profile sections). Shows Lock icon + "Sign in to view" label. Tapping fires a callback.

Props:
```tsx
<AuthGateOverlay
  onPress={() => requireAuth(undefined, { title: '...', icon: 'wallet' })}
  borderRadius={12}
  dark   // optional: navy background (referral card variant)
/>
```

The parent view must be `position: relative` (default in RN). Wrap in `<View style={{ position: 'relative' }}>` if needed.

---

## Navigation Changes

### `RootNavigator.tsx`
- Removed top-level `!isAuthenticated → AuthNavigator` gate.
- `!isReady` → loading spinner.
- `user?.role === 'admin'` → AdminNavigator.
- Otherwise → `<AuthGateProvider><ResponsiveNavigator /></AuthGateProvider>`.
- `AuthGateProvider` is inside `NavigationContainer` (so `navigationRef` is ready) and outside `AdminNavigator` (admins skip the gate).

### `DrawerNavigator.tsx` (MobileNavigator stack)
Two modal auth screens added:
```tsx
<Stack.Screen name="AuthLogin"  component={isMobile ? MobileLoginScreen : LoginScreen} options={{ presentation: 'modal' }} />
<Stack.Screen name="AuthSignup" component={SignupScreen} options={{ presentation: 'modal' }} />
```
`navigationRef.navigate('AuthLogin' / 'AuthSignup')` reaches these from anywhere.

### Auth screens — auto-dismiss on login
Both `MobileLoginScreen` and `SignupScreen` have:
```tsx
useEffect(() => {
  if (user && navigation.canGoBack()) navigation.goBack();
}, [user]);
```
Covers password login, Google sign-in, and OTP flows.

---

## Gated Screens

### `ProductDetailScreen.tsx` (desktop/web)
File: `src/screens/Dashboard/ProductDetailScreen.tsx`

| Touch point | Gate opts |
|---|---|
| Share icon in image hero | `icon: 'share'` |
| Buy Now button | `icon: 'cart'` |
| Share & Earn CTA (when no affiliate URL) | `icon: 'share'` |
| `ProductShareCard` onShare | `icon: 'share'` |
| Write Review button | `icon: 'star'` |

All wrapped with `requireAuth(() => ..., { title: '...', icon: '...' })`.

---

### `MobileProductDetailScreen.tsx` (mobile)
File: `src/screens/Dashboard/MobileProductDetailScreen.tsx`

Three props on `<ProductDetailMobile>`:
```tsx
onShare={() => requireAuth(() => { canShare && setShareOpen(true); }, { icon: 'share' })}
onBuy={() => requireAuth(handleBuy, { icon: 'cart' })}
onWriteReview={() => requireAuth(() => setReviewOpen(true), { icon: 'star' })}
```

---

### `StoreDetailScreen.tsx`
File: `src/screens/Dashboard/StoreDetailScreen.tsx`

| Button | Gate |
|---|---|
| Share & Earn | `requireAuth(() => setShareOpen(true), { icon: 'share' })` |
| Get Directions | `requireAuth(openDirections, { icon: 'navigation' })` |

---

### `MobileVideosScreen.tsx` — screen-level gate
File: `src/screens/Dashboard/MobileVideosScreen.tsx`

Guest sees a **dark locked placeholder** (navy bg, Lock icon, "Sign in to watch videos" text, Sign in button). `requireAuth()` fires on mount via `useEffect`. After login, the screen re-renders with actual video content.

---

### `VideoScreen.tsx` — screen-level gate
File: `src/screens/Dashboard/VideoScreen.tsx`

Same pattern: dark locked placeholder + gate on mount.

---

### `MobileProfileScreen.tsx` — partial overlays
File: `src/screens/Dashboard/MobileProfileScreen.tsx`

Three sections locked with `<AuthGateOverlay>`:

| Section | Overlay variant |
|---|---|
| Stats row (coins, cashback, shares) | default (white bg) |
| Referral card (`LinearGradient`) | `dark` (navy bg) |
| MY CONTENT section | default, wrapped in `<View style={{ position: 'relative' }}>` |

LEGAL & SUPPORT section is always accessible — no gate.

---

## The Pending Action Flow (end-to-end)

```
Guest taps "Buy Now"
  → requireAuth(handleBuy, { icon: 'cart' })
    → pendingCb.current = handleBuy
    → setVisible(true)  ← modal appears
      → guest taps "Sign in"
        → navigationRef.navigate('AuthLogin')
          → login succeeds → hydrate() → user set in store
            → AuthGateContext useEffect fires
              → navigationRef.goBack()  ← pops auth screen
              → setTimeout(handleBuy, 350)  ← original action fires
```

---

## What Was NOT Gated (deliberate)

- `ProfileScreen.tsx` (desktop) — profile overlays on mobile only; desktop deferred
- Store listing / product listing / home feed — fully public
- LEGAL & SUPPORT links in mobile profile — always open
- Admin routes — bypass guest gate entirely

---

## EAS Build Note (Mapbox)

The Mapbox public token (`pk.*`) was removed from `eas.json` — GitHub push protection blocks it. Set it as an EAS Secret before any EAS build:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value "<your-mapbox-pk-token>"
```

---

## Key Commits

| Commit | Description |
|---|---|
| `3bd0d56` | feat(auth): guest mode — browse freely, gate specific CTAs |
| `7fd8da7` | fix(auth): gate Share/Buy/Review on desktop ProductDetailScreen |
