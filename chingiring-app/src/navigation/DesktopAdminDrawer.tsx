import 'react-native-gesture-handler';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Colors } from '../constants/theme';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { createAdminPlaceholder } from '../screens/Admin/AdminPlaceholderScreen';
import { AdminDealsScreen } from '../screens/Admin/AdminDealsScreen';
import { AdminProductsScreen } from '../screens/Admin/AdminProductsScreen';
import { AdminWithdrawalsScreen } from '../screens/Admin/AdminWithdrawalsScreen';
import { AdminUsersScreen } from '../screens/Admin/AdminUsersScreen';
import { AdminBannersScreen } from '../screens/Admin/AdminBannersScreen';
import { AdminCouponsScreen } from '../screens/Admin/AdminCouponsScreen';

const Drawer = createDrawerNavigator();

const AdminConversionsScreen = createAdminPlaceholder('Conversions');
const AdminCategoriesScreen = createAdminPlaceholder('Categories');
const AdminOrdersScreen = createAdminPlaceholder('Orders');
const AdminInventoryScreen = createAdminPlaceholder('Inventory');

export default function DesktopAdminDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="AdminDashboard"
      drawerContent={(props) => <AdminSidebar {...props} />}
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
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
      <Drawer.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
      <Drawer.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Drawer.Screen name="AdminAllProducts" component={AdminProductsScreen} />
      <Drawer.Screen name="AdminCategories" component={AdminCategoriesScreen} />
      <Drawer.Screen name="AdminOrders" component={AdminOrdersScreen} />
      <Drawer.Screen name="AdminInventory" component={AdminInventoryScreen} />
      <Drawer.Screen name="AdminBanners" component={AdminBannersScreen} />
      <Drawer.Screen name="AdminCoupons" component={AdminCouponsScreen} />
    </Drawer.Navigator>
  );
}
