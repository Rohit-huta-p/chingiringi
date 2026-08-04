import type { LinkingOptions } from '@react-navigation/native';

/**
 * Centralised deep-link / web-URL routing config.
 *
 * Why this exists:
 *  - On Expo Web, React Navigation will only push entries into `window.history`
 *    if a `linking` config is attached to the `NavigationContainer`. Without it
 *    every drawer screen renders at the same URL and the browser back button
 *    falls out of the SPA entirely. With it, each screen has its own path and
 *    back/forward navigate between in-app screens.
 *  - On native (iOS / Android) the same config also handles `chingiringi://`
 *    deep links + `https://chingiringi.com/...` universal links.
 *
 * Each screen name below MUST match the `name` prop of a `<Stack.Screen>` /
 * `<Tab.Screen>` / `<Drawer.Screen>` somewhere in the navigator tree. Names
 * that don't currently exist in the mounted navigator are silently ignored,
 * which lets one config cover auth, admin and user roots at once.
 *
 * Mobile user nav nests screens under `MainTabs`; desktop user nav has them
 * flat under a drawer. We declare BOTH shapes so the same URL (e.g. `/wallet`)
 * resolves correctly on each form factor.
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [
    'chingiringi://',
    'https://chingiringi.com',
    'https://www.chingiringi.com',
  ],
  config: {
    screens: {
      // ── Auth (AuthNavigator stack — mounted while unauthenticated) ─────
      Login:           'login',
      PasswordLogin:   'login/password',
      Signup:          'signup',
      OTPVerification: 'otp',
      ForgotPassword:  'forgot-password',
      ResetPassword:   'reset-password',

      // ── Admin (AdminNavigator — mounted when user.role === 'admin') ────
      AdminDashboard:   'admin',
      AdminDeals:       'admin/deals',
      AdminWalletOps:   'admin/wallet-ops',
      AdminWithdrawals: 'admin/withdrawals',
      AdminUsers:       'admin/users',
      AdminAllProducts: 'admin/products',
      AdminStores:      'admin/stores',
      AdminOrders:      'admin/orders',
      AdminInventory:   'admin/inventory',
      AdminBanners:     'admin/banners',
      AdminCoupons:     'admin/coupons',
      AdminCouponUsage: 'admin/coupons/:couponId/usage',
      AdminProfile:     'admin/profile',

      // ── User: mobile shape (Stack > MainTabs > tabs) ───────────────────
      // Every tab gets its own path *nested under an `app/` prefix* (e.g.
      // `/app/wallet`). This is what lets the browser Back button return to
      // the correct tab.
      //
      // Why the prefix — and why the tabs can't just be path-less:
      //   The desktop drawer declares Home/Wallet/Referrals/… FLAT at the top
      //   level (`/home`, `/wallet`). Previously the tabs had no paths, so on
      //   the Wallet tab `getPathFromState` fell back to the flat `Wallet`
      //   entry and produced `/wallet`. Pressing Back then ran
      //   `getStateFromPath('/wallet')`, which resolves to a TOP-LEVEL `Wallet`
      //   route — a screen the mobile Stack navigator doesn't have (Wallet is
      //   only a tab). React Navigation drops the unknown route and falls back
      //   to the stack's initial route → Home. That was the "Back always goes
      //   Home" bug. Nesting the tabs under `app/…` keeps their paths distinct
      //   from the flat desktop paths, so each URL resolves unambiguously to
      //   the tab that owns it.
      //
      // Both tab sets are listed: the web set (Home/Wallet/Referrals/
      // Notifications/Settings) and the native set (Videos/Stores/Home/Wallet/
      // Profile). Names absent from the mounted navigator are silently ignored,
      // and each nested path (`app/…`) is distinct from the flat desktop path,
      // so the resolver never sees two screens claiming the same pattern.
      MainTabs: {
        path: 'app',
        screens: {
          Home:          '',            // home tab (web + native) → /app
          Videos:        'videos',
          Stores:        'stores',
          Wallet:        'wallet',
          Referrals:     'referrals',
          Notifications: 'notifications',
          Settings:      'settings',
          Profile:       'profile',
        },
      },

      // ── User: desktop shape (flat Drawer) + mobile detail screens ──────
      Home:               'home',
      Deals:              'deals',
      Wallet:             'wallet',
      Referrals:          'referrals',
      OfflineStores:      'offline-stores',
      Notifications:      'notifications',
      Settings:           'settings',
      About:              'about',
      Profile:            'profile',
      EditProfile:        'profile/edit',
      MyAddress:          'addresses',
      AddEditAddress:     'addresses/edit',
      TransactionHistory: 'transactions',
      StoreDetail: {
        // `store` is a full object passed via JS navigation for instant render;
        // strip it from the URL (else it stringifies to `[object Object]`).
        path: 'offline-stores/:storeId',
        stringify: {
          store: () => undefined as unknown as string,
        },
        parse: {
          storeId: (id: string) => id,
        },
      } as any,
      ProductDetail: {
        // `product` / `deal` params (full objects passed via JS navigation for
        // instant-render UX) must be stripped — otherwise React Nav stringifies
        // them as `[object Object]` in the query string. Returning undefined
        // (not '') removes the key from the URL entirely.
        path: 'product/:productId',
        stringify: {
          product: () => undefined as unknown as string,
          deal:    () => undefined as unknown as string,
        },
        parse: {
          productId: (id: string) => id,
        },
      } as any,
      CategoryProducts: 'category/:category',
    },
  },
};

/**
 * Optional: per-screen browser tab title. Only used on web — RN ignores it
 * silently on native.
 */
export const documentTitle = {
  formatter: (options: { title?: string } | undefined, route: { name?: string } | undefined) => {
    const screen = options?.title ?? route?.name ?? '';
    return screen ? `${screen} · ChingiRingi` : 'ChingiRingi';
  },
};
