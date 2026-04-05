import React, { lazy, Suspense } from 'react';
import { useWindowDimensions, Platform, View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Wallet, Users, Bell, Settings } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { SettingsScreen } from '../screens/Dashboard/SettingsScreen';
import { HomeScreen } from '../screens/Dashboard/HomeScreen';
import { WalletScreen } from '../screens/Dashboard/WalletScreen';
import { ReferScreen } from '../screens/Dashboard/ReferScreen';
import { ProfileScreen } from '../screens/Dashboard/ProfileScreen';
import { EditProfileScreen } from '../screens/Dashboard/EditProfileScreen';
import { MyAddressScreen } from '../screens/Dashboard/MyAddressScreen';
import { AddEditAddressScreen } from '../screens/Dashboard/AddEditAddressScreen';
import { TransactionHistoryScreen } from '../screens/Dashboard/TransactionHistoryScreen';
import { ProductDetailScreen } from '../screens/Dashboard/ProductDetailScreen';
import { NotificationsScreen } from '../screens/Dashboard/NotificationsScreen';

// Lazy-load the desktop drawer navigator so react-native-reanimated
// is never imported on mobile (Expo Go doesn't bundle the right native version)
const DesktopDrawerNavigator = lazy(() => import('./DesktopDrawerNavigator'));

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarLabel: 'Alerts' }} />
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
      <Stack.Screen name="AddEditAddress" component={AddEditAddressScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </Stack.Navigator>
  );
}

// ─── Responsive Navigator ───────────────────────────────────────────────────

function DesktopFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

export default function ResponsiveNavigator() {
  const { width } = useWindowDimensions();

  // On native platforms (iOS/Android), always use mobile navigator
  // to avoid loading react-native-reanimated which causes TurboModule errors in Expo Go
  if (Platform.OS !== 'web' || width < 768) {
    return <MobileNavigator />;
  }

  return (
    <Suspense fallback={<DesktopFallback />}>
      <DesktopDrawerNavigator />
    </Suspense>
  );
}
