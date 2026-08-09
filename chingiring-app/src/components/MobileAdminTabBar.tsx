import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreHorizontal, X } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts } from '../constants/theme';
import { ADMIN_NAV_ITEMS } from './MobileAdminNav';

// The sections that get an always-visible bottom tab. Everything else in
// ADMIN_NAV_ITEMS falls into the "More" sheet. Reorder / swap these 4 keys to
// change which sections are one tap away.
const PRIMARY_KEYS = ['AdminDashboard', 'AdminWalletOps', 'AdminUsers', 'AdminAllProducts'];

const byKey: Record<string, (typeof ADMIN_NAV_ITEMS)[number]> =
  Object.fromEntries(ADMIN_NAV_ITEMS.map((i) => [i.key, i]));
const PRIMARY = PRIMARY_KEYS.map((k) => byKey[k]).filter(Boolean);
const MORE = ADMIN_NAV_ITEMS.filter((i) => !PRIMARY_KEYS.includes(i.key));
const MORE_KEYS = MORE.map((i) => i.key);

// Catch a mistyped PRIMARY_KEYS entry — otherwise .filter(Boolean) silently
// drops the bad key and a tab just quietly disappears.
if (__DEV__ && PRIMARY.length !== PRIMARY_KEYS.length) {
  console.warn('[MobileAdminTabBar] PRIMARY_KEYS has a key not in ADMIN_NAV_ITEMS:', PRIMARY_KEYS);
}

/**
 * Bottom tab bar for the mobile admin. Renders the primary sections plus a
 * "More" button that opens a sheet with the rest. Wired as the `tabBar` of the
 * admin bottom-tab navigator, so it sits fixed below every screen's scroll and
 * inherits instant, state-preserving tab switching.
 */
export function MobileAdminTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = state.routes[state.index]?.name;
  const moreActive = MORE_KEYS.includes(current);

  const go = (key: string) => {
    setMoreOpen(false);
    if (key !== current) navigation.navigate(key as never);
  };

  return (
    <>
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {PRIMARY.map((item) => {
          const on = item.key === current;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              style={st.tab}
              onPress={() => go(item.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.label}
            >
              <Icon size={22} color={on ? Colors.primary : Colors.textSecondary} strokeWidth={on ? 2.4 : 2} />
              <Text style={[st.label, on && st.labelOn]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={st.tab}
          onPress={() => setMoreOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: moreActive }}
          accessibilityLabel="More sections"
        >
          <MoreHorizontal size={22} color={moreActive ? Colors.primary : Colors.textSecondary} strokeWidth={moreActive ? 2.4 : 2} />
          <Text style={[st.label, moreActive && st.labelOn]}>More</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={st.scrim} onPress={() => setMoreOpen(false)}>
          {/* absorb taps so pressing the sheet body doesn't dismiss it */}
          <Pressable style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
            <View style={st.grabber} />
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>More sections</Text>
              <TouchableOpacity onPress={() => setMoreOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {MORE.map((item) => {
              const on = item.key === current;
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[st.row, on && st.rowOn]}
                  onPress={() => go(item.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[st.rowIcon, on && st.rowIconOn]}>
                    <Icon size={18} color={on ? Colors.primary : Colors.textSecondary} strokeWidth={2} />
                  </View>
                  <Text style={[st.rowLabel, on && st.rowLabelOn]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10.5, fontFamily: Fonts.medium, color: Colors.textSecondary },
  labelOn: { color: Colors.primary, fontFamily: Fonts.bold },

  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 6 },
  sheetTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  rowOn: { backgroundColor: Colors.primaryLight10 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundGrey, justifyContent: 'center', alignItems: 'center' },
  rowIconOn: { backgroundColor: '#fff' },
  rowLabel: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  rowLabelOn: { color: Colors.primary },
});

export default MobileAdminTabBar;
