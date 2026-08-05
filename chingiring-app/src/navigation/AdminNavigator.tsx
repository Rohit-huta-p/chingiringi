import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { MobileAdminDashboard } from '../screens/Admin/MobileAdminDashboard';
import { MobileAdminDeals } from '../screens/Admin/MobileAdminDeals';
import { MobileAdminWithdrawals } from '../screens/Admin/MobileAdminWithdrawals';
import { MobileAdminProducts } from '../screens/Admin/MobileAdminProducts';
import { MobileAdminStores } from '../screens/Admin/MobileAdminStores';
import { MobileAdminBanners } from '../screens/Admin/MobileAdminBanners';
import { MobileAdminCoupons } from '../screens/Admin/MobileAdminCoupons';
import { MobileAdminCouponUsage } from '../screens/Admin/MobileAdminCouponUsage';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminUsersScreen } from '../screens/Admin/AdminUsersScreen';
import { WalletOperationsScreen } from '../screens/Admin/WalletOperationsScreen';
import { AdminProfileScreen } from '../screens/Admin/AdminProfileScreen';

// Mobile layout when native, OR on a narrow web viewport (sm). Mirrors the
// user-facing DrawerNavigator so admin renders its mobile screens on small
// web widths instead of cramming the desktop screens into the mobile stack.
const computeIsMobile = (width: number) => Platform.OS !== 'web' || width < 768;

// Categories management is now inline inside the Product form (CategoryPicker).
// No dedicated Categories screen — admins create / edit / delete from there.
const AdminOrdersScreen = createAdminPlaceholder('Orders');
const AdminInventoryScreen = createAdminPlaceholder('Inventory');

// Lazy-load the desktop admin drawer (uses reanimated)
const DesktopAdminDrawer = lazy(() => import('./DesktopAdminDrawer'));

const Tab = createBottomTabNavigator();

// Mobile admin uses a BOTTOM-TAB navigator with its tab bar hidden (each screen
// draws its own MobileAdminNav). Tabs keep every section mounted after first
// visit, so tapping a nav tab switches instantly — scroll position and
// already-fetched data are preserved, with no slide, spinner, or refetch. A
// stack (the old setup) instead pushed + remounted + refetched on every tap,
// which is why pages didn't "just open on the spot". `lazy: false` mounts every
// tab the moment admin opens, so even the FIRST tap of each tab is instant — the
// tradeoff is that all the sections' data fetches fire at once on entry. After
// that first mount, inactive tabs are detached (state + fetched data kept), never
// remounted. (Flip to `lazy: true` to instead mount each tab on first focus —
// lighter entry, but one spinner the first time you open each tab.)
// `backBehavior="history"` makes the hardware back button (and goBack from
// drill-downs like Coupon Usage / Profile) return to the previously viewed tab.
//
// This navigator only ever mounts when AdminNavigator (below) has already decided
// the viewport is mobile (width < 768), so it renders the mobile screens
// UNCONDITIONALLY. It used to re-derive `isMobile` from a SECOND
// useWindowDimensions read — but on iOS Safari that read could come back stale
// (>= 768) while the outer read was correct (< 768). The mobile shell then mounted
// the DESKTOP screens, which draw no self-nav (they expect the desktop drawer's
// sidebar), so admin saw a dashboard with zero navigation. One source of truth —
// the single outer check — removes that whole failure mode. Every mobile screen
// draws its own <MobileAdminNav/>, so headerShown stays false (screenOptions).
function MobileAdminNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom', 'left', 'right']}>
    <Tab.Navigator tabBar={() => null} backBehavior="history" screenOptions={{ headerShown: false, lazy: false }}>
      <Tab.Screen name="AdminDashboard" component={MobileAdminDashboard} options={{ title: 'Admin Dashboard' }} />
      <Tab.Screen name="AdminDeals" component={MobileAdminDeals} options={{ title: 'Deals' }} />
      <Tab.Screen name="AdminWalletOps" component={WalletOperationsScreen} options={{ title: 'Wallet Operations' }} />
      <Tab.Screen name="AdminWithdrawals" component={MobileAdminWithdrawals} options={{ title: 'Withdrawals' }} />
      <Tab.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <Tab.Screen name="AdminAllProducts" component={MobileAdminProducts} options={{ title: 'Products' }} />
      <Tab.Screen name="AdminStores" component={MobileAdminStores} options={{ title: 'Offline Stores' }} />
      <Tab.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <Tab.Screen name="AdminInventory" component={AdminInventoryScreen} options={{ title: 'Inventory' }} />
      <Tab.Screen name="AdminBanners" component={MobileAdminBanners} options={{ title: 'Banners' }} />
      <Tab.Screen name="AdminCoupons" component={MobileAdminCoupons} options={{ title: 'Coupons' }} />
      <Tab.Screen name="AdminCouponUsage" component={MobileAdminCouponUsage} options={{ title: 'Coupon Usage' }} />
      <Tab.Screen name="AdminProfile" component={AdminProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
    </SafeAreaView>
  );
}

function Fallback() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

export default function AdminNavigator() {
  const { width } = useWindowDimensions();

  if (computeIsMobile(width)) {
    return <MobileAdminNavigator />;
  }

  return (
    <Suspense fallback={<Fallback />}>
      <DesktopAdminDrawer />
    </Suspense>
  );
}
