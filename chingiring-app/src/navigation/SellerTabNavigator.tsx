/**
 * SellerTabNavigator — 4-tab navigator for users with role === 'seller'.
 *
 * Uses the same MobileTabBar pill design as DrawerNavigator, but with
 * activeColor = Colors.orange (#F97316) instead of Colors.primary (#4784E2).
 *
 * Tabs: Dashboard · My Store · Go Live · Profile
 *   All tab screens are placeholders; real content is built in S4.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Store, Video, User, MessageCircle } from 'lucide-react-native';
// Note: LayoutDashboard + Video kept — still used in SELLER_TAB_ICON_MAP below.
import { Colors, Fonts } from '../constants/theme';
import { getUnreadTotal } from '../api/chat';
import { NavCountBadge } from '../components/NavCountBadge';

import { MobileEditProfileScreen } from '../screens/Dashboard/MobileEditProfileScreen';
import { MobileSettingsScreen } from '../screens/Dashboard/MobileSettingsScreen';
import { NotificationsScreen } from '../screens/Dashboard/NotificationsScreen';
import { MobileProductDetailScreen } from '../screens/Dashboard/MobileProductDetailScreen';
import { MobileAboutScreen } from '../screens/Dashboard/MobileAboutScreen';
// Seller Profile "My content" targets (registered below so those rows resolve).
import { MyVideosScreen } from '../screens/Dashboard/MyVideosScreen';
import { BlockedAccountsScreen } from '../screens/Dashboard/BlockedAccountsScreen';
import { MessagesScreen } from '../screens/Messages/MessagesScreen';
import { ChatScreen } from '../screens/Messages/ChatScreen';
import { EditStoreDetailsScreen } from '../screens/Seller/EditStoreDetailsScreen';

// Seller onboarding screens (Sprint 3)
import { BusinessOnboardingScreen } from '../screens/Seller/BusinessOnboardingScreen';
import { StoreVerificationScreen } from '../screens/Seller/StoreVerificationScreen';

// Seller dashboard + GoLive (Sprint 6 integration)
import { SellerDashboardScreen } from '../screens/Seller/SellerDashboardScreen';
import { GoLiveTabScreen } from '../screens/Seller/GoLiveTabScreen';
import { MyStoreScreen } from '../screens/Seller/MyStoreScreen';
import { SellerProfileTabScreen } from '../screens/Seller/SellerProfileTabScreen';
import { BroadcasterScreen } from '../screens/Live/BroadcasterScreen';

// ─── Tab icon map ──────────────────────────────────────────────────────────
const SELLER_TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Dashboard: LayoutDashboard,
  MyStore:   Store,
  GoLive:    Video,
  Messages:  MessageCircle,
  Profile:   User,
};

// Active colour for seller is orange (not the buyer's primary blue)
const ACTIVE_COLOR = Colors.orange;

// ─── Custom tab bar ───────────────────────────────────────────────────────
function SellerMobileTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  // Unread chat total — drives the badge on the Messages tab. Shares the
  // ['chat','unread'] key with the dashboard query so the two stay in sync.
  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: getUnreadTotal,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.barInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;
          const Icon = SELLER_TAB_ICON_MAP[route.name];
          const isGoLive = route.name === 'GoLive';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconColor = isFocused ? ACTIVE_COLOR : '#9ca3af';

          // GoLive tab gets the raised-circle treatment (centre-ish visual anchor)
          if (isGoLive) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={styles.tabHome}
              >
                <View style={[styles.homeCircle, isFocused && styles.homeCircleActive]}>
                  {Icon ? <Icon size={22} color={iconColor} strokeWidth={2.2} /> : null}
                </View>
                <Text style={[styles.label, isFocused && { color: ACTIVE_COLOR, fontFamily: Fonts.bold }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.tab}
            >
              <View style={[styles.pill, isFocused && styles.pillActive]}>
                {Icon ? <Icon size={20} color={iconColor} strokeWidth={2} /> : null}
                <Text style={[styles.label, isFocused && { color: ACTIVE_COLOR, fontFamily: Fonts.bold }]}>
                  {label}
                </Text>
              </View>
              {route.name === 'Messages' ? (
                <NavCountBadge count={chatUnread} style={styles.tabBadge} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Bottom tabs (4 tabs) ─────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

function SellerBottomTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      backBehavior="history"
      tabBar={(props) => <SellerMobileTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={SellerDashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="MyStore"   component={MyStoreScreen}         options={{ tabBarLabel: 'My Store' }} />
      <Tab.Screen name="GoLive"    component={GoLiveTabScreen}       options={{ tabBarLabel: 'Go Live' }} />
      <Tab.Screen name="Messages"  component={MessagesScreen}        options={{ tabBarLabel: 'Messages' }} initialParams={{ tabRoot: true }} />
      <Tab.Screen name="Profile"   component={SellerProfileTabScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Root stack (tabs + detail screens) ──────────────────────────────────
const Stack = createNativeStackNavigator();

export default function SellerTabNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF7ED' }} edges={['top', 'left', 'right']}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs"            component={SellerBottomTabs} />
        <Stack.Screen name="BusinessOnboarding" component={BusinessOnboardingScreen} />
        <Stack.Screen name="StoreVerification"  component={StoreVerificationScreen} />
        <Stack.Screen name="BroadcasterScreen"  component={BroadcasterScreen}
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="EditProfile"        component={MobileEditProfileScreen} />
        <Stack.Screen name="EditStoreDetails"   component={EditStoreDetailsScreen} />
        <Stack.Screen name="Settings"           component={MobileSettingsScreen} />
        <Stack.Screen name="Notifications"      component={NotificationsScreen} />
        <Stack.Screen name="Chat"               component={ChatScreen} />
        <Stack.Screen name="ProductDetail"      component={MobileProductDetailScreen} />
        <Stack.Screen name="About"              component={MobileAboutScreen} />
        <Stack.Screen name="MyVideos"           component={MyVideosScreen} />
        <Stack.Screen name="BlockedAccounts"    component={BlockedAccountsScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  placeholderTitle: {
    marginTop: 16,
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  placeholderSub: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },
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
  tabBadge: {
    position: 'absolute',
    top: 4,
    left: '52%',
    borderWidth: 1.5,
    borderColor: '#d8dbe2',
  },
  pill: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 18,
    gap: 2,
    minWidth: 56,
    overflow: 'hidden',
  },
  pillActive: {
    backgroundColor: '#ffffff',
  },
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
});
