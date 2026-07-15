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
      AdminOrders:      'admin/orders',
      AdminInventory:   'admin/inventory',
      AdminBanners:     'admin/banners',
      AdminCoupons:     'admin/coupons',
      AdminCouponUsage: 'admin/coupons/:couponId/usage',
      AdminProfile:     'admin/profile',

      // ── User: mobile shape (Stack > MainTabs > tabs) ───────────────────
      // Tab screens share names with the desktop drawer screens declared
      // below (Home, Wallet, Profile, Refer). Declaring them in BOTH places
      // makes RN's linking resolver throw "pattern resolves to two screens".
      // On native we don't need URL routing anyway, so we leave MainTabs
      // path-less here and let users navigate via `navigation.navigate(...)`.
      MainTabs: {
        path: '',
        screens: {
          // No paths — tab screens are reachable on web through their
          // top-level entries below (desktop drawer mounts them flat).
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
