import 'react-native-gesture-handler';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Colors } from '../constants/theme';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminTopBar } from '../components/AdminTopBar';
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminDealsScreen } from '../screens/Admin/AdminDealsScreen';
import { AdminProductsScreen } from '../screens/Admin/AdminProductsScreen';
import { AdminWithdrawalsScreen } from '../screens/Admin/AdminWithdrawalsScreen';
import { AdminUsersScreen } from '../screens/Admin/AdminUsersScreen';
import { AdminBannersScreen } from '../screens/Admin/AdminBannersScreen';
import { AdminCouponsScreen } from '../screens/Admin/AdminCouponsScreen';
import { WalletOperationsScreen } from '../screens/Admin/WalletOperationsScreen';
import { AdminProfileScreen } from '../screens/Admin/AdminProfileScreen';

const Drawer = createDrawerNavigator();

const AdminConversionsScreen = createAdminPlaceholder('Conversions');
const AdminOrdersScreen = createAdminPlaceholder('Orders');
const AdminInventoryScreen = createAdminPlaceholder('Inventory');

export default function DesktopAdminDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="AdminDashboard"
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
      <Drawer.Screen name="AdminConversions" component={AdminConversionsScreen} />
      <Drawer.Screen name="AdminWalletOps" component={WalletOperationsScreen} />
      <Drawer.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
      <Drawer.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Drawer.Screen name="AdminAllProducts" component={AdminProductsScreen} />
      <Drawer.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Drawer.Screen name="AdminInventory" component={AdminInventoryScreen} />
      <Drawer.Screen name="AdminBanners" component={AdminBannersScreen} />
      <Drawer.Screen name="AdminCoupons" component={AdminCouponsScreen} />
      {/* Reachable from the top-bar profile badge; hidden from the sidebar. */}
      <Drawer.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
  );
}
