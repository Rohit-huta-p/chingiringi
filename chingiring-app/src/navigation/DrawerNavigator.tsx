import { useWindowDimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Wallet, Users, Bell, Settings } from 'lucide-react-native';
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
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Desktop: Permanent Drawer Navigator (unchanged) ────────────────────────

function DrawerNavigator() {
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

// ─── Mobile: Bottom Tab Navigator ───────────────────────────────────────────

const TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Home: Home,
  Wallet: Wallet,
  Referrals: Users,
  Notifications: Bell,
  Settings: Settings,
};

function BottomTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICON_MAP[route.name];
          return Icon ? <Icon size={size} color={color} strokeWidth={2} /> : null;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="Referrals" component={ReferScreen} options={{ tabBarLabel: 'Referrals' }} />
      <Tab.Screen name="Notifications" component={HomeScreen} options={{ tabBarLabel: 'Alerts' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

// ─── Mobile: Root Stack wrapping Bottom Tabs + detail screens ────────────────

function MobileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="MyAddress" component={MyAddressScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
}

// ─── Responsive Navigator ───────────────────────────────────────────────────

export default function ResponsiveNavigator() {
  const { width } = useWindowDimensions();

  if (width >= 768) {
    return <DrawerNavigator />;
  }

  return <MobileNavigator />;
}
