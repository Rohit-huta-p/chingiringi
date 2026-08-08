import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * Shared settings design system used by both SettingsScreen (desktop/web) and
 * MobileSettingsScreen. One source of truth for section cards, nav rows and
 * toggle rows so the two screens stay visually identical.
 *
 *   <SettingsSection title="Notifications" icon={Bell} iconColor={...} iconBg={...}>
 *     <SettingToggle icon={IndianRupee} label="Cashback" value={v} onValueChange={fn} />
 *     <SettingRow icon={Lock} label="Change Password" onPress={fn} />
 *   </SettingsSection>
 *
 * Dividers are auto-inserted between children (inset to align under the text),
 * so callers never place them by hand.
 */

// Left inset of the hairline divider = row padding + icon tile + gap, so the
// line starts under the label rather than under the icon.
const DIVIDER_INSET = 14 + 36 + 12;

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Shared icon tints (soft tinted tile bg + saturated icon), used by both
// settings screens so row iconography stays consistent.
export const Tint = {
  primary: { iconColor: Colors.primary, iconBg: Colors.primaryLight10 },
  green:   { iconColor: '#10b981', iconBg: '#ecfdf5' },
  blue:    { iconColor: '#2563eb', iconBg: '#eff6ff' },
  purple:  { iconColor: '#8b5cf6', iconBg: '#f5f3ff' },
  amber:   { iconColor: '#f59e0b', iconBg: '#fffbeb' },
  teal:    { iconColor: '#0d9488', iconBg: '#f0fdfa' },
  sky:     { iconColor: '#0ea5e9', iconBg: '#f0f9ff' },
  slate:   { iconColor: '#64748b', iconBg: '#f1f5f9' },
};

// ─── Section (caption + card that auto-dividers its rows) ─────────────────────

interface SectionProps {
  title: string;
  icon?: IconType;
  iconColor?: string;
  iconBg?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function SettingsSection({
  title, icon: Icon, iconColor = Colors.primary, iconBg = Colors.primaryLight10, children, style,
}: SectionProps) {
  const rows = React.Children.toArray(children); // drops null/false → no stray dividers
  return (
    <View style={style}>
      <View style={s.caption}>
        {Icon ? (
          <View style={[s.captionChip, { backgroundColor: iconBg }]}>
            <Icon size={13} color={iconColor} strokeWidth={2.2} />
          </View>
        ) : null}
        <Text style={s.captionText}>{title}</Text>
      </View>
      <View style={s.card}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <View style={s.divider} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ─── Nav / action row ────────────────────────────────────────────────────────

interface RowProps {
  icon: IconType;
  label: string;
  sublabel?: string;
  iconColor?: string;
  iconBg?: string;
  rightLabel?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Hide the trailing chevron even when pressable. */
  hideChevron?: boolean;
}

export function SettingRow({
  icon: Icon, label, sublabel, iconColor, iconBg, rightLabel, onPress, danger, hideChevron,
}: RowProps) {
  const tileBg = iconBg ?? (danger ? '#fef2f2' : '#f1f5f9');
  const tileColor = iconColor ?? (danger ? Colors.danger : Colors.textSecondary);
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
    >
      <View style={[s.iconTile, { backgroundColor: tileBg }]}>
        <Icon size={18} color={tileColor} strokeWidth={2} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {sublabel ? <Text style={s.rowSub}>{sublabel}</Text> : null}
      </View>
      {rightLabel ? <Text style={s.rightLabel}>{rightLabel}</Text> : null}
      {onPress && !hideChevron ? (
        <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Toggle row ──────────────────────────────────────────────────────────────

interface ToggleProps {
  icon: IconType;
  label: string;
  sublabel?: string;
  iconColor?: string;
  iconBg?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

export function SettingToggle({
  icon: Icon, label, sublabel, iconColor = Colors.textSecondary, iconBg = '#f1f5f9', value, onValueChange,
}: ToggleProps) {
  return (
    <View style={s.row}>
      <View style={[s.iconTile, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel ? <Text style={s.rowSub}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e2e8f0', true: Colors.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  captionChip: {
    width: 24, height: 24, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  captionText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eef2f7',
    marginLeft: DIVIDER_INSET,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconTile: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginRight: 6,
  },
});
