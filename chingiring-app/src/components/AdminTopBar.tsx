import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/theme';
import { useAuthStore } from '../store';

// Route key → the short title shown at the top-left of the admin top bar
// (mirrors the sidebar labels; matches the Figma where "Banners" sits above
// the screen's own "Banner Management" heading).
const ROUTE_TITLES: Record<string, string> = {
  AdminDashboard:   'Dashboard',
  AdminDeals:       'Deals',
  AdminWalletOps:   'Wallet Ops',
  AdminWithdrawals: 'Withdrawals',
  AdminUsers:       'Users',
  AdminAllProducts: 'Products',
  AdminOrders:      'Orders',
  AdminInventory:   'Inventory',
  AdminBanners:     'Banners',
  AdminCoupons:     'Coupons',
  AdminProfile:     'Profile',
};

/**
 * Admin desktop top bar: page title on the left, admin profile on the right.
 * Rendered as the permanent drawer's header so the profile lives top-right on
 * every admin screen (per Figma 257:3700) instead of at the bottom of the
 * sidebar.
 */
export function AdminTopBar({ routeName }: { routeName: string }) {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();

  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{ROUTE_TITLES[routeName] ?? 'Admin'}</Text>

      <TouchableOpacity
        style={styles.profile}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('AdminProfile')}
      >
        <View style={styles.info}>
          <Text style={styles.name}>Super Admin</Text>
          <Text style={styles.email}>{user?.email || 'admin@chingiringi.com'}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SA</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info: { alignItems: 'flex-end' },
  name: { fontSize: 13, fontWeight: '700', color: Colors.text },
  email: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default AdminTopBar;
