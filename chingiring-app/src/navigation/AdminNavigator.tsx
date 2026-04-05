import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/theme';
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminDealsScreen } from '../screens/Admin/AdminDealsScreen';

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
    <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: Colors.primary }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="AdminDeals" component={AdminDealsScreen} options={{ title: 'Deals' }} />
      <Stack.Screen name="AdminConversions" component={AdminConversionsScreen} options={{ title: 'Conversions' }} />
      <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} options={{ title: 'Withdrawals' }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
      <Stack.Screen name="AdminAllProducts" component={AdminAllProductsScreen} options={{ title: 'Products' }} />
      <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Orders' }} />
      <Stack.Screen name="AdminInventory" component={AdminInventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="AdminBanners" component={AdminBannersScreen} options={{ title: 'Banners' }} />
      <Stack.Screen name="AdminCoupons" component={AdminCouponsScreen} options={{ title: 'Coupons' }} />
    </Stack.Navigator>
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
