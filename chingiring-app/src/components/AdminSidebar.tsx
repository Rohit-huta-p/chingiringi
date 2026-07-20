import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  LayoutDashboard, Wallet, Users, Package,
  Grid3X3, ClipboardList, Warehouse, Image as ImageIcon, Ticket,
  LogOut, ChevronDown, ChevronUp, X, Coins,
} from 'lucide-react-native';
import { Colors, Spacing } from '../constants/theme';
import { useAuthStore } from '../store';

const ADMIN_NAV = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: LayoutDashboard },
  // Deals hidden from the admin panel nav (backend + screen kept intact).
  // Wallet Operations Hub — unified workflow for crediting from merchant reports,
  // processing withdrawals, and drilling into any user's wallet timeline.
  { key: 'AdminWalletOps', label: 'Wallet Ops', icon: Coins },
  { key: 'AdminUsers', label: 'Users', icon: Users },
  {
    key: 'products',
    label: 'Products',
    icon: Package,
    children: [
      { key: 'AdminAllProducts', label: 'All Products' },
      { key: 'AdminOrders', label: 'Orders' },
      { key: 'AdminInventory', label: 'Inventory' },
    ],
  },
  { key: 'AdminBanners', label: 'Banners', icon: ImageIcon },
  { key: 'AdminCoupons', label: 'Coupons', icon: Ticket },
];

export function AdminSidebar({ navigation, state }: any) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const logout = useAuthStore((s) => s.logout);

  const activeRoute = state?.routes?.[state.index]?.name ?? 'AdminDashboard';

  const handleNav = (key: string) => {
    navigation.navigate(key);
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>C</Text>
        </View>
        <Text style={styles.logoText}>Admin Panel</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.closeDrawer?.()}>
          <X size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Nav Items */}
      <View style={styles.navList}>
        {ADMIN_NAV.map((item) => {
          if (item.children) {
            const isExpanded = expandedGroup === item.key;
            const childActive = item.children.some((c) => c.key === activeRoute);
            return (
              <View key={item.key}>
                <TouchableOpacity
                  style={[styles.navItem, childActive && styles.navItemActive]}
                  onPress={() => setExpandedGroup(isExpanded ? null : item.key)}
                >
                  <item.icon size={18} color={childActive ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.navLabel, childActive && styles.navLabelActive]}>{item.label}</Text>
                  {isExpanded
                    ? <ChevronUp size={16} color={Colors.textSecondary} />
                    : <ChevronDown size={16} color={Colors.textSecondary} />}
                </TouchableOpacity>
                {isExpanded && item.children.map((child) => (
                  <TouchableOpacity
                    key={child.key}
                    style={[styles.navItem, styles.navItemChild, activeRoute === child.key && styles.navItemActive]}
                    onPress={() => handleNav(child.key)}
                  >
                    <Text style={[styles.navLabel, activeRoute === child.key && styles.navLabelActive]}>
                      {child.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }

          const isActive = activeRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleNav(item.key)}
            >
              <item.icon size={18} color={isActive ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Logout — sits at the bottom of the sidebar (profile moved to the
          top-right top bar per Figma 257:3700). */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <LogOut size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoText: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },

  navList: { flex: 1, paddingHorizontal: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
    gap: 10,
  },
  navItemActive: { backgroundColor: '#eff6ff' },
  navItemChild: { paddingLeft: 42 },
  navLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  navLabelActive: { color: Colors.primary, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logoutText: { fontSize: 14, color: Colors.danger },
});
