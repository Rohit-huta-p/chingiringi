import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * Small red count badge for admin nav items (e.g. pending verifications).
 * Renders nothing when count <= 0. Pass `style` to reposition — e.g. an
 * absolute overlay on the top-right of a tab icon.
 */
export function NavCountBadge({ count, style }: { count: number; style?: ViewStyle }) {
  if (!count || count <= 0) return null;
  return (
    <View style={[styles.badge, style]} accessibilityLabel={`${count} pending`}>
      <Text style={styles.text} numberOfLines={1}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default NavCountBadge;

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    lineHeight: 14,
  },
});
