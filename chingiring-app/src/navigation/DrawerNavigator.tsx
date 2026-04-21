import React, { lazy, Suspense } from 'react';
import { useWindowDimensions, Platform, View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Wallet, Users, Bell, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Gradient } from '../constants/theme';
import { useAuthStore } from '../store';
import { SettingsScreen } from '../screens/Dashboard/SettingsScreen';
import { HomeScreen } from '../screens/Dashboard/HomeScreen';
import { MobileHomeScreen } from '../screens/Dashboard/MobileHomeScreen';
import { WalletScreen } from '../screens/Dashboard/WalletScreen';
import { MobileWalletScreen } from '../screens/Dashboard/MobileWalletScreen';
import { ReferScreen } from '../screens/Dashboard/ReferScreen';
import { ProfileScreen } from '../screens/Dashboard/ProfileScreen';
import { MobileProfileScreen } from '../screens/Dashboard/MobileProfileScreen';
import { EditProfileScreen } from '../screens/Dashboard/EditProfileScreen';
import { MyAddressScreen } from '../screens/Dashboard/MyAddressScreen';
import { AddEditAddressScreen } from '../screens/Dashboard/AddEditAddressScreen';
import { TransactionHistoryScreen } from '../screens/Dashboard/TransactionHistoryScreen';
import { ProductDetailScreen } from '../screens/Dashboard/ProductDetailScreen';
import { MobileProductDetailScreen } from '../screens/Dashboard/MobileProductDetailScreen';
import { NotificationsScreen } from '../screens/Dashboard/NotificationsScreen';
import { MobileSettingsScreen } from '../screens/Dashboard/MobileSettingsScreen';
import { MobileReferenceScreen } from '../screens/Dashboard/MobileReferenceScreen';

const isMobile = Platform.OS !== 'web';

// Lazy-load the desktop drawer navigator so react-native-reanimated
// is never imported on mobile (Expo Go doesn't bundle the right native version)
const DesktopDrawerNavigator = lazy(() => import('./DesktopDrawerNavigator'));

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Mobile: Custom Tab Bar matching Figma mobile-bottom-nav ────────────────

const MOBILE_TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Home:   Home,
  Refer:  Users,
  Wallet: Wallet,
};

function userInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MobileTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const userName = useAuthStore((s) => s.user?.name);

  return (
    <View style={[tabStyles.barOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={tabStyles.barInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;
          const Icon = MOBILE_TAB_ICON_MAP[route.name];
          const isProfile = route.name === 'Profile';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={[tabStyles.tab, isFocused && tabStyles.tabActive]}
            >
              {isProfile ? (
                // ── User-initials avatar ──────────────────────────────
                isFocused ? (
                  <LinearGradient
                    colors={Gradient.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={tabStyles.avatarGradient}
                  >
                    <View style={tabStyles.avatarInner}>
                      <Text style={tabStyles.avatarInitialsActive}>{userInitials(userName)}</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={tabStyles.avatarInactive}>
                    <Text style={tabStyles.avatarInitialsInactive}>{userInitials(userName)}</Text>
                  </View>
                )
              ) : (
                // ── Regular icon ──────────────────────────────────────
                Icon && <Icon size={20} color={isFocused ? Colors.primary : '#9ca3af'} strokeWidth={2} />
              )}
              <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Web fallback: standard 5-tab navigator
const WEB_TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Home: Home,
  Wallet: Wallet,
  Referrals: Users,
  Notifications: Bell,
  Settings: Settings,
};

function BottomTabNavigator() {
  if (isMobile) {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={(props) => <MobileTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={MobileHomeScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Refer" component={MobileReferenceScreen} options={{ tabBarLabel: 'Refer' }} />
        <Tab.Screen name="Wallet" component={MobileWalletScreen} options={{ tabBarLabel: 'Wallet' }} />
        <Tab.Screen name="Profile" component={isMobile ? MobileProfileScreen : ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const Icon = WEB_TAB_ICON_MAP[route.name];
          return Icon ? <Icon size={size} color={color} strokeWidth={2} /> : null;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          paddingTop: 4,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
      })}
    >
      <Tab.Screen name="Homee" component={HomeScreen} options={{ tabBarLabel: 'Homeee' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="Referrals" component={ReferScreen} options={{ tabBarLabel: 'Referrals' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarLabel: 'Alerts' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  barOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  barInner: {
    flexDirection: 'row',
    backgroundColor: '#ffffffce',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 12,
    elevation: 10,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  tabActive: {
    backgroundColor: `${Colors.primaryLight10}`,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#9ca3af',
  },
  labelActive: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },

  // ── Profile initials avatar
  avatarGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsActive: {
    fontSize: 11,
    fontFamily: Fonts.extraBold,
    color: Colors.primary,
  },
  avatarInactive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsInactive: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#9ca3af',
  },
});

// ─── Mobile: Root Stack wrapping Bottom Tabs + detail screens ────────────────

function MobileNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primaryLight }} edges={['top', 'left', 'right']}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name="Profile" component={isMobile ? MobileProfileScreen : ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="MyAddress" component={MyAddressScreen} />
        <Stack.Screen name="AddEditAddress" component={AddEditAddressScreen} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
        <Stack.Screen name="ProductDetail" component={isMobile ? MobileProductDetailScreen : ProductDetailScreen} />
        <Stack.Screen name="Settings" component={isMobile ? MobileSettingsScreen : SettingsScreen} />
      </Stack.Navigator>
    </SafeAreaView>
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
