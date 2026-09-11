import 'react-native-gesture-handler';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Colors } from '../constants/theme';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminTopBar } from '../components/AdminTopBar';
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminDealsScreen } from '../screens/Admin/AdminDealsScreen';
import { AdminProductsScreen } from '../screens/Admin/AdminProductsScreen';
import { AdminStoresScreen } from '../screens/Admin/AdminStoresScreen';
import { AdminWithdrawalsScreen } from '../screens/Admin/AdminWithdrawalsScreen';
import { AdminUsersScreen } from '../screens/Admin/AdminUsersScreen';
import { AdminBannersScreen } from '../screens/Admin/AdminBannersScreen';
import { AdminCouponsScreen } from '../screens/Admin/AdminCouponsScreen';
import { MobileAdminSearchQueries } from '../screens/Admin/MobileAdminSearchQueries';
import { WalletOperationsScreen } from '../screens/Admin/WalletOperationsScreen';
import { AdminProfileScreen } from '../screens/Admin/AdminProfileScreen';
import { AdminVideoUploadScreen } from '../screens/Admin/AdminVideoUploadScreen';
import { AdminStoreVerificationsScreen } from '../screens/Admin/AdminStoreVerificationsScreen';

const Drawer = createDrawerNavigator();

const AdminOrdersScreen = createAdminPlaceholder('Orders');
const AdminInventoryScreen = createAdminPlaceholder('Inventory');

export default function DesktopAdminDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="AdminDashboard"
      // `history` so the browser Back/Forward buttons move through visited admin
      // screens instead of collapsing to the dashboard. (Drawer defaults to
      // `firstRoute`, which makes web sibling navigation replace the URL — see
      // DesktopDrawerNavigator for the full explanation.)
      backBehavior="history"
      drawerContent={(props) => <AdminSidebar {...props} />}
      screenOptions={{
        drawerType: 'permanent',
        headerShown: true,
        header: ({ route }) => <AdminTopBar routeName={route.name} />,
        drawerStyle: {
          width: 250,
          backgroundColor: Colors.surface,
          borderRightWidth: 1,
          borderRightColor: Colors.border,
        },
      }}
    >
      <Drawer.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Drawer.Screen name="AdminDeals" component={AdminDealsScreen} />
      <Drawer.Screen name="AdminWalletOps" component={WalletOperationsScreen} />
      <Drawer.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
      <Drawer.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Drawer.Screen name="AdminAllProducts" component={AdminProductsScreen} />
      <Drawer.Screen name="AdminStores" component={AdminStoresScreen} />
      <Drawer.Screen name="AdminStoreVerifications" component={AdminStoreVerificationsScreen} options={{ title: 'Store Verifications' }} />
      <Drawer.Screen name="AdminVideos" component={AdminVideoUploadScreen} />
      <Drawer.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Drawer.Screen name="AdminInventory" component={AdminInventoryScreen} />
      <Drawer.Screen name="AdminBanners" component={AdminBannersScreen} />
      <Drawer.Screen name="AdminCoupons" component={AdminCouponsScreen} />
      <Drawer.Screen name="AdminSearchQueries" component={MobileAdminSearchQueries} options={{ title: 'Search Queries' }} />
      {/* Reachable from the top-bar profile badge; hidden from the sidebar. */}
      <Drawer.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
  );
}
