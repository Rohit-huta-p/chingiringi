import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutDashboard, Wallet, CreditCard, Users, Package, Store,
  Image as ImageIcon, Ticket, PlaySquare, Search,
} from 'lucide-react-native';
import { useAuthStore } from '../store';
import { Colors, Fonts } from '../constants/theme';

// Single source of truth for the mobile admin sections. The bottom tab bar
// (MobileAdminTabBar) splits these into the primary tabs + a "More" sheet, and
// this header maps the active key to its title. Add a section here and it shows
// up in both places.
export const ADMIN_NAV_ITEMS = [
  { key: 'AdminDashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { key: 'AdminWalletOps',    label: 'Wallet Ops', icon: Wallet },
  { key: 'AdminWithdrawals',  label: 'Payouts',    icon: CreditCard },
  { key: 'AdminUsers',        label: 'Users',      icon: Users },
  { key: 'AdminAllProducts',  label: 'Products',   icon: Package },
  { key: 'AdminStores',       label: 'Stores',     icon: Store },
  { key: 'AdminVideos',       label: 'Videos',     icon: PlaySquare },
  { key: 'AdminBanners',      label: 'Banners',    icon: ImageIcon },
  { key: 'AdminCoupons',      label: 'Coupons',    icon: Ticket },
  { key: 'AdminSearchQueries', label: 'Search',    icon: Search },
];

// active route key → header title. The 10 nav sections plus drill-ins that still
// render this header (e.g. Deals).
const TITLES: Record<string, string> = {
  ...Object.fromEntries(ADMIN_NAV_ITEMS.map((i) => [i.key, i.label])),
  AdminDeals: 'Deals',
};

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Clean top header for every mobile admin screen: the current section's title
 * on the left, the profile avatar on the right. Section switching moved to the
 * bottom tab bar (MobileAdminTabBar), so this dropped the old blue band +
 * horizontal-scroll tab strip. Render at the top of a screen's ScrollView,
 * passing the route key as `active`.
 */
export function MobileAdminNav({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const title = TITLES[active] ?? 'Chingiringi';

  return (
    <View style={st.header}>
      <Text style={st.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity
        style={st.avatar}
        onPress={() => nav.navigate('AdminProfile')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open admin profile"
      >
        <Text style={st.avatarTxt}>{userInitials(userName)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { flex: 1, fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.text, letterSpacing: -0.3 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.text, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
});

export default MobileAdminNav;
