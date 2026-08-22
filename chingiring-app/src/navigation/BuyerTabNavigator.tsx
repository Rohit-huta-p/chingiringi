/**
 * BuyerTabNavigator — 5-tab navigator for users with role === 'buyer'.
 *
 * Adapted from DrawerNavigator's MobileNavigator + MobileTabBar.
 * Active colour: Colors.primary (#4784E2, blue).
 *
 * Tabs: LiveDiscovery · Cashback · Stores · Wallet · Profile
 *   - LiveDiscovery: placeholder (S2 wires real content)
 *   - Cashback: MobileHomeScreen (existing deals/cashback feed)
 *   - Stores: OfflineStoresScreen
 *   - Wallet: MobileWalletScreen
 *   - Profile: MobileProfileScreen
 *
 * All existing stack screens from MobileNavigator are retained so deep-links
 * and push-navigation (StoreDetail, ProductDetail, etc.) keep working.
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
import { Home, Wallet, Store, User, Radio } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

// Existing screens reused in tabs
import { MobileHomeScreen } from '../screens/Dashboard/MobileHomeScreen';
import { MobileWalletScreen } from '../screens/Dashboard/MobileWalletScreen';
import { OfflineStoresScreen } from '../screens/Dashboard/OfflineStoresScreen';

// Buyer screens (Sprint 2 + Sprint 5)
import { LiveDiscoveryScreen } from '../screens/Buyer/LiveDiscoveryScreen';
import { BuyerOnboardingScreen } from '../screens/Buyer/BuyerOnboardingScreen';
import { BuyerProfileScreen } from '../screens/Buyer/BuyerProfileScreen';
import { ViewerScreen } from '../screens/Live/ViewerScreen';

// Seller public profile (Sprint 5 B2)
import { SellerProfileScreen } from '../screens/Seller/SellerProfileScreen';

// Stack screens (detail views reachable from any tab)
import { MobileEditProfileScreen } from '../screens/Dashboard/MobileEditProfileScreen';
import { MyAddressScreen } from '../screens/Dashboard/MyAddressScreen';
import { AddEditAddressScreen } from '../screens/Dashboard/AddEditAddressScreen';
import { MobileTransactionHistoryScreen } from '../screens/Dashboard/MobileTransactionHistoryScreen';
import { MobileProductDetailScreen } from '../screens/Dashboard/MobileProductDetailScreen';
import { StoreDetailScreen } from '../screens/Dashboard/StoreDetailScreen';
import { MobileSettingsScreen } from '../screens/Dashboard/MobileSettingsScreen';
import { NotificationsScreen } from '../screens/Dashboard/NotificationsScreen';
import { MobileAboutScreen } from '../screens/Dashboard/MobileAboutScreen';
import { BlockedAccountsScreen } from '../screens/Dashboard/BlockedAccountsScreen';
import { CategoryProductsScreen } from '../screens/Dashboard/CategoryProductsScreen';
import { MobileLoginScreen } from '../screens/Auth/MobileLoginScreen';
import { SignupScreen } from '../screens/Auth/SignupScreen';

// ─── Tab icon map ──────────────────────────────────────────────────────────
const BUYER_TAB_ICON_MAP: Record<string, React.ComponentType<any>> = {
  LiveDiscovery: Radio,
  Cashback:      Home,
  Stores:        Store,
  Wallet:        Wallet,
  Profile:       User,
};

// ─── Custom tab bar (pill design, same as DrawerNavigator MobileTabBar) ───
function BuyerMobileTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.barInner}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? route.name;
          const isFocused = state.index === index;
          const Icon = BUYER_TAB_ICON_MAP[route.name];
          const isCashback = route.name === 'Cashback';

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

          const iconColor = isFocused ? Colors.primary : '#9ca3af';

          // Cashback tab uses the raised-circle "home" treatment (centre visual anchor)
          if (isCashback) {
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
                <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
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
                <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Bottom Tab navigator (5 tabs) ────────────────────────────────────────
const Tab = createBottomTabNavigator();

function BuyerBottomTabs() {
  return (
    <Tab.Navigator
      initialRouteName="LiveDiscovery"
      backBehavior="history"
      tabBar={(props) => <BuyerMobileTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="LiveDiscovery" component={LiveDiscoveryScreen} options={{ tabBarLabel: 'Live' }} />
      <Tab.Screen name="Cashback"      component={MobileHomeScreen}         options={{ tabBarLabel: 'Cashback' }} />
      <Tab.Screen name="Stores"        component={OfflineStoresScreen}      options={{ tabBarLabel: 'Stores' }} />
      <Tab.Screen name="Wallet"        component={MobileWalletScreen}       options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="Profile"       component={BuyerProfileScreen}       options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Root stack wrapping the tab navigator + all detail screens ────────────
const Stack = createNativeStackNavigator();

export default function BuyerTabNavigator() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primaryLight }} edges={['top', 'left', 'right']}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs"          component={BuyerBottomTabs} />
        <Stack.Screen name="EditProfile"       component={MobileEditProfileScreen} />
        <Stack.Screen name="MyAddress"         component={MyAddressScreen} />
        <Stack.Screen name="AddEditAddress"    component={AddEditAddressScreen} />
        <Stack.Screen name="TransactionHistory" component={MobileTransactionHistoryScreen} />
        <Stack.Screen name="ProductDetail"     component={MobileProductDetailScreen} />
        <Stack.Screen name="StoreDetail"       component={StoreDetailScreen} />
        <Stack.Screen name="BlockedAccounts"   component={BlockedAccountsScreen} />
        <Stack.Screen name="CategoryProducts"  component={CategoryProductsScreen} />
        <Stack.Screen name="Settings"          component={MobileSettingsScreen} />
        <Stack.Screen name="Notifications"     component={NotificationsScreen} />
        <Stack.Screen name="About"             component={MobileAboutScreen} />
        <Stack.Screen name="BuyerOnboarding"   component={BuyerOnboardingScreen} />
        <Stack.Screen name="ViewerScreen"      component={ViewerScreen} />
        <Stack.Screen name="SellerProfile"     component={SellerProfileScreen} />
        <Stack.Screen
          name="AuthLogin"
          component={MobileLoginScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="AuthSignup"
          component={SignupScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </SafeAreaView>
  );
}

// ─── Styles (mirrors DrawerNavigator tabStyles) ───────────────────────────
const styles = StyleSheet.create({
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
  labelActive: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
});
