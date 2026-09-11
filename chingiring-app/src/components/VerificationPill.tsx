import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { BadgeCheck, Clock, XCircle, ShieldAlert } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import type { VerificationStatus } from '../api/verification';

type Tone = 'dark' | 'light';

/**
 * Store verification status chip. `tone="dark"` for the navy Dashboard header
 * (bright text on a translucent-white bg); `tone="light"` for white cards like
 * My Store (colored text on a tinted bg). Tapping fires onPress (disabled when
 * verified or when no handler is given).
 */
const CFG: Record<'verified' | 'pending' | 'rejected' | 'unverified', {
  label: string;
  Icon: React.ComponentType<any>;
  light: { fg: string; bg: string };
  dark: { fg: string; bg: string };
}> = {
  verified:   { label: 'Verified',     Icon: BadgeCheck,  light: { fg: '#16A34A', bg: 'rgba(22,163,74,0.12)' },   dark: { fg: '#4ADE80', bg: 'rgba(255,255,255,0.16)' } },
  pending:    { label: 'Under review', Icon: Clock,       light: { fg: '#B45309', bg: 'rgba(245,158,11,0.14)' },  dark: { fg: '#FBBF24', bg: 'rgba(255,255,255,0.16)' } },
  rejected:   { label: 'Rejected',     Icon: XCircle,     light: { fg: '#DC2626', bg: 'rgba(220,38,38,0.10)' },   dark: { fg: '#F87171', bg: 'rgba(255,255,255,0.16)' } },
  unverified: { label: 'Not verified', Icon: ShieldAlert, light: { fg: '#64748B', bg: 'rgba(100,116,139,0.12)' }, dark: { fg: '#E5E7EB', bg: 'rgba(255,255,255,0.16)' } },
};

export const VerificationPill: React.FC<{
  status?: VerificationStatus;
  tone?: Tone;
  onPress?: () => void;
}> = ({ status, tone = 'dark', onPress }) => {
  const cfg = CFG[status ?? 'unverified'] ?? CFG.unverified;
  const { fg, bg } = cfg[tone];
  const { label, Icon } = cfg;
  return (
    <Pressable
      onPress={onPress}
      disabled={status === 'verified' || !onPress}
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityRole="button"
      accessibilityLabel={`Verification: ${label}`}
    >
      <Icon size={12} color={fg} strokeWidth={2.5} />
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
};

export default VerificationPill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9,
  },
  pillText: { fontSize: 11.5, fontFamily: Fonts.bold },
});
