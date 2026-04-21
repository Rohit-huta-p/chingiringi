import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { MobileAdminDashboard } from '../screens/Admin/MobileAdminDashboard';
import { MobileAdminDeals } from '../screens/Admin/MobileAdminDeals';
import { MobileAdminWithdrawals } from '../screens/Admin/MobileAdminWithdrawals';
import { MobileAdminProducts } from '../screens/Admin/MobileAdminProducts';
import { MobileAdminBanners } from '../screens/Admin/MobileAdminBanners';
import { MobileAdminCoupons } from '../screens/Admin/MobileAdminCoupons';
import { MobileAdminCouponUsage } from '../screens/Admin/MobileAdminCouponUsage';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminDealsScreen } from '../screens/Admin/AdminDealsScreen';
import { MobileProfileScreen } from '../screens/Dashboard/MobileProfileScreen';

const isMobile = Platform.OS !== 'web';

// Placeholder screens for admin sections
const AdminConversionsScreen = createAdminPlaceholder('Conversions');
const AdminWithdrawalsScreen = createAdminPlaceholder('Withdrawals');
const AdminUsersScreen = createAdminPlaceholder('Users Management');
const AdminAllProductsScreen = createAdminPlaceholder('All Products');
const AdminCategoriesScreen = createAdminPlaceholder('Categories');
const AdminOrdersScreen = createAdminPlaceholder('Orders');
const AdminInventoryScreen = createAdminPlaceholder('Inventory');
const AdminBannersScreen = createAdminPlaceholder('Banners');
const AdminCouponsScreen = createAdminPlaceholder('Coupons');

// Lazy-load the desktop admin drawer (uses reanimated)
const DesktopAdminDrawer = lazy(() => import('./DesktopAdminDrawer'));

const Stack = createNativeStackNavigator();

// Mobile admin uses a stack navigator
function MobileAdminNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['bottom', 'left', 'right']}>
    <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: Colors.primary }}>
      <Stack.Screen name="AdminDashboard" component={isMobile ? MobileAdminDashboard : AdminDashboardScreen} options={{ headerShown: !isMobile, title: 'Admin Dashboard' }} />
      <Stack.Screen name="AdminDeals" component={isMobile ? MobileAdminDeals : AdminDealsScreen} options={{ headerShown: !isMobile, title: 'Deals' }} />
      <Stack.Screen name="AdminConversions" component={AdminConversionsScreen} options={{ title: 'Conversions' }} />
      <Stack.Screen name="AdminWithdrawals" component={isMobile ? MobileAdminWithdrawals : AdminWithdrawalsScreen} options={{ headerShown: !isMobile, title: 'Withdrawals' }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <Stack.Screen name="AdminAllProducts" component={isMobile ? MobileAdminProducts : AdminAllProductsScreen} options={{ headerShown: !isMobile, title: 'Products' }} />
      <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <Stack.Screen name="AdminInventory" component={AdminInventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="AdminBanners" component={isMobile ? MobileAdminBanners : AdminBannersScreen} options={{ headerShown: !isMobile, title: 'Banners' }} />
      <Stack.Screen name="AdminCoupons" component={isMobile ? MobileAdminCoupons : AdminCouponsScreen} options={{ headerShown: !isMobile, title: 'Coupons' }} />
      <Stack.Screen name="AdminCouponUsage" component={MobileAdminCouponUsage} options={{ headerShown: false, title: 'Coupon Usage' }} />
      <Stack.Screen name="AdminProfile" component={MobileProfileScreen} options={{ headerShown: false, title: 'Profile' }} />
    </Stack.Navigator>
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

  if (Platform.OS !== 'web' || width < 768) {
    return <MobileAdminNavigator />;
  }

  return (
    <Suspense fallback={<Fallback />}>
      <DesktopAdminDrawer />
    </Suspense>
  );
}
