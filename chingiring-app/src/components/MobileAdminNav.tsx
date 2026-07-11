import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  LayoutDashboard, Tag, Wallet, CreditCard, Users, Package,
  Image as ImageIcon, Ticket,
} from 'lucide-react-native';
import { useAuthStore } from '../store';

// Single source of truth for the mobile admin section nav. Every admin screen
// renders <MobileAdminNav active="…" /> so the bar is identical everywhere —
// previously each screen kept its own copy of this list, which is how
// "Wallet Ops" ended up missing from every screen except the dashboard.
export const ADMIN_NAV_ITEMS = [
  { key: 'AdminDashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { key: 'AdminDeals',       label: 'Deals',      icon: Tag },
  { key: 'AdminWalletOps',   label: 'Wallet Ops', icon: Wallet },
  { key: 'AdminWithdrawals', label: 'Payouts',    icon: CreditCard },
  { key: 'AdminUsers',       label: 'Users',      icon: Users },
  { key: 'AdminAllProducts', label: 'Products',   icon: Package },
  { key: 'AdminBanners',     label: 'Banners',    icon: ImageIcon },
  { key: 'AdminCoupons',     label: 'Coupons',    icon: Ticket },
];

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Shared blue admin header + horizontal section-nav tab bar.
 * Drop at the top of any mobile admin screen (inside its ScrollView), passing
 * the current screen's route key as `active`.
 */
export function MobileAdminNav({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);

  return (
    <>
      <View style={st.header}>
        <View style={st.headerLeft}>
          <View style={st.logoCircle}><Text style={st.logoTxt}>C</Text></View>
          <View>
            <Text style={st.headerTitle}>Admin Panel</Text>
            <Text style={st.headerSub}>Super Admin</Text>
          </View>
        </View>
        <TouchableOpacity
          style={st.avatarCircle}
          onPress={() => nav.navigate('AdminProfile')}
          activeOpacity={0.7}
        >
          <Text style={st.avatarTxt}>{userInitials(userName)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.navScroll}
        contentContainerStyle={st.navContent}
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={[st.navTab, isActive && st.navTabActive]}
              onPress={() => { if (!isActive) nav.navigate(item.key); }}
            >
              <item.icon size={16} color={isActive ? '#3b82f6' : 'rgba(255,255,255,0.75)'} strokeWidth={2} />
              <Text style={[st.navLabel, isActive && st.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontWeight: '700' },
});

export default MobileAdminNav;
