import React, { lazy, Suspense } from 'react';
import { useWindowDimensions, Platform, View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Wallet, Users, Bell, Settings, PlaySquare, Store, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Gradient } from '../constants/theme';
import { useAuthStore } from '../store';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { SettingsScreen } from '../screens/Dashboard/SettingsScreen';
import { HomeScreen } from '../screens/Dashboard/HomeScreen';
import { MobileHomeScreen } from '../screens/Dashboard/MobileHomeScreen';
import { WalletScreen } from '../screens/Dashboard/WalletScreen';
import { MobileWalletScreen } from '../screens/Dashboard/MobileWalletScreen';
import { ReferScreen } from '../screens/Dashboard/ReferScreen';
import { ProfileScreen } from '../screens/Dashboard/ProfileScreen';
import { MobileProfileScreen } from '../screens/Dashboard/MobileProfileScreen';
import { EditProfileScreen } from '../screens/Dashboard/EditProfileScreen';
import { MobileEditProfileScreen } from '../screens/Dashboard/MobileEditProfileScreen';
import { MyAddressScreen } from '../screens/Dashboard/MyAddressScreen';
import { AddEditAddressScreen } from '../screens/Dashboard/AddEditAddressScreen';
import { TransactionHistoryScreen } from '../screens/Dashboard/TransactionHistoryScreen';
import { MobileTransactionHistoryScreen } from '../screens/Dashboard/MobileTransactionHistoryScreen';
import { ProductDetailScreen } from '../screens/Dashboard/ProductDetailScreen';
import { MobileProductDetailScreen } from '../screens/Dashboard/MobileProductDetailScreen';
import { CategoryProductsScreen } from '../screens/Dashboard/CategoryProductsScreen';
import { NotificationsScreen } from '../screens/Dashboard/NotificationsScreen';
import { MobileSettingsScreen } from '../screens/Dashboard/MobileSettingsScreen';
import { MobileReferenceScreen } from '../screens/Dashboard/MobileReferenceScreen';
import { MobileVideosScreen } from '../screens/Dashboard/MobileVideosScreen';
import { OfflineStoresScreen } from '../screens/Dashboard/OfflineStoresScreen';
import { StoreDetailScreen } from '../screens/Dashboard/StoreDetailScreen';
import { AboutScreen } from '../screens/Dashboard/AboutScreen';
import { MobileAboutScreen } from '../screens/Dashboard/MobileAboutScreen';

// `isMobile` is derived from the viewport width inside each navigator component
// below (not a static const), so the WEB app switches to the mobile screens at
// the sm breakpoint — narrow desktop / mobile-view gets the exact mobile UI.
const MOBILE_BREAKPOINT = 768;
const computeIsMobile = (width: number) => Platform.OS !== 'web' || width < MOBILE_BREAKPOINT;

// Lazy-load the desktop drawer navigator so react-native-reanimated
// is never imported on mobile (Expo Go doesn't bundle the right native version)
const DesktopDrawerNavigator = lazy(() => import('./DesktopDrawerNavigator'));

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Mobile: Custom Tab Bar matching Figma 21:2130 ─────────────────────────
// Visual rules:
//   - Inactive tabs: light-gray icon + light-gray label, stacked
//   - Active non-Home tab: white rounded-rect pill, blue icon + blue label
//   - Active Home tab: raised white CIRCLE that pokes above the bar
//     (negative marginTop), blue icon, blue label below the circle
// Tab set: Videos · Stores · Home · Wallet · Profile  (Home centre)

const MOBILE_TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Videos: PlaySquare,
  Stores: Store,
  Home:   Home,
  Wallet: Wallet,
  Profile: User,
};

function MobileTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.barOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={tabStyles.barInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;
          const Icon = MOBILE_TAB_ICON_MAP[route.name];
          const isHome = route.name === 'Home';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Inactive colour: muted gray. Active: brand blue.
          const iconColor = isFocused ? Colors.primary : '#9ca3af';

          if (isHome) {
            // Raised circle pulls UP via negative top margin so the FAB-style
            // home button visually breaks out of the bar's top edge.
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={tabStyles.tabHome}
              >
                <View style={[tabStyles.homeCircle, isFocused && tabStyles.homeCircleActive]}>
                  {Icon ? (
                    <Icon size={22} color={iconColor} strokeWidth={2.2} />
                  ) : null}
                </View>
                <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          // Regular tabs — when active, wrap icon+label in a white rounded pill.
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={tabStyles.tab}
            >
              <View style={[tabStyles.pill, isFocused && tabStyles.pillActive]}>
                {Icon ? (
                  <Icon size={20} color={iconColor} strokeWidth={2} />
                ) : null}
                <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>
                  {label}
                </Text>
              </View>
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
  const unreadCount = useUnreadCount();
  const { width } = useWindowDimensions();
  const isMobile = computeIsMobile(width);

  if (isMobile) {
    // Tab order matters — Home is centre tab so the raised pill sits in the
    // middle of the bar. Refer moved out to a stack route (still reachable
    // via the Profile screen / dashboard CTAs).
    return (
      <Tab.Navigator
        initialRouteName="Home"
        // `history` → in-app / hardware back returns to the previously-visited
        // tab instead of the first tab (RN default is `firstRoute`).
        backBehavior="history"
        tabBar={(props) => <MobileTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Videos" component={MobileVideosScreen}      options={{ tabBarLabel: 'Videos' }} />
        <Tab.Screen name="Stores" component={OfflineStoresScreen}     options={{ tabBarLabel: 'Stores' }} />
        <Tab.Screen name="Home"   component={MobileHomeScreen}        options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Wallet" component={MobileWalletScreen}      options={{ tabBarLabel: 'Wallet' }} />
        <Tab.Screen name="Profile" component={isMobile ? MobileProfileScreen : ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="Referrals" component={ReferScreen} options={{ tabBarLabel: 'Referrals' }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
        }}
      />
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
    backgroundColor: '#d8dbe2',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    minHeight: 64,
    // Allow the raised Home circle to overflow the top of the bar.
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Active-state pill (Wallet / Profile / Videos / Stores)
  pill: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 18,
    gap: 2,
    minWidth: 56,
  },
  pillActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  // Raised Home tab — the circle pokes above the bar via negative margin.
  tabHome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    marginBottom: 4,
    borderWidth: 4,
    borderColor: '#d8dbe2',
  },
  homeCircleActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },

  label: {
    fontSize: 11,
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
  const { width } = useWindowDimensions();
  const isMobile = computeIsMobile(width);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primaryLight }} edges={['top', 'left', 'right']}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name="Profile" component={isMobile ? MobileProfileScreen : ProfileScreen} />
        <Stack.Screen name="EditProfile" component={isMobile ? MobileEditProfileScreen : EditProfileScreen} />
        <Stack.Screen name="MyAddress" component={MyAddressScreen} />
        <Stack.Screen name="AddEditAddress" component={AddEditAddressScreen} />
        <Stack.Screen name="TransactionHistory" component={isMobile ? MobileTransactionHistoryScreen : TransactionHistoryScreen} />
        <Stack.Screen name="ProductDetail" component={isMobile ? MobileProductDetailScreen : ProductDetailScreen} />
        <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        <Stack.Screen name="Settings" component={isMobile ? MobileSettingsScreen : SettingsScreen} />
        <Stack.Screen name="About" component={isMobile ? MobileAboutScreen : AboutScreen} />
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
  // to avoid loading react-native-reanimated which causes TurboModule errors in Expo Go.
  // On web, switch to the mobile navigator below the sm breakpoint.
  if (computeIsMobile(width)) {
    return <MobileNavigator />;
  }

  return (
    <Suspense fallback={<DesktopFallback />}>
      <DesktopDrawerNavigator />
    </Suspense>
  );
}
