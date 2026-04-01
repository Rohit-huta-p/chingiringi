import { createDrawerNavigator } from '@react-navigation/drawer';
import { Colors } from '../constants/theme';
import { Sidebar } from '../components/Sidebar';
import { SettingsScreen } from '../screens/Dashboard/SettingsScreen';
import { HomeScreen } from '../screens/Dashboard/HomeScreen';
import { WalletScreen } from '../screens/Dashboard/WalletScreen';
import { ReferScreen } from '../screens/Dashboard/ReferScreen';
import { ProfileScreen } from '../screens/Dashboard/ProfileScreen';
import { EditProfileScreen } from '../screens/Dashboard/EditProfileScreen';
import { MyAddressScreen } from '../screens/Dashboard/MyAddressScreen';
import { TransactionHistoryScreen } from '../screens/Dashboard/TransactionHistoryScreen';
import { ProductDetailScreen } from '../screens/Dashboard/ProductDetailScreen';
import { useUIStore } from '../store/uiStore';

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        drawerType: 'permanent',
        headerShown: false,
        drawerStyle: {
          width: isSidebarCollapsed ? 80 : 250,
          backgroundColor: Colors.surface,
          borderRightWidth: 1,
          borderRightColor: Colors.border,
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Wallet" component={WalletScreen} />
      <Drawer.Screen name="Referrals" component={ReferScreen} />
      <Drawer.Screen name="Notifications" component={HomeScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="EditProfile" component={EditProfileScreen} />
      <Drawer.Screen name="MyAddress" component={MyAddressScreen} />
      <Drawer.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Drawer.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Drawer.Navigator>
  );
}
