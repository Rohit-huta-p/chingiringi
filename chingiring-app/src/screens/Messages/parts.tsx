/**
 * Shared bits for the Messages screens — a circular avatar (image or coloured
 * initial) and compact time formatters. Kept local to the Messages folder.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

const AVATAR_COLORS = ['#4784E2', '#7A5AF8', '#E2725B', '#2F9E7E', '#C2740A', '#B04E72', '#5B7596'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const Avatar: React.FC<{ uri?: string; name: string; size?: number }> = ({ uri, name, size = 48 }) => {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[dim, styles.img]} />;
  }
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[dim, styles.fallback, { backgroundColor: colorFor(name || '?') }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
};

/** Inbox-row relative time: "now", "5m", "3h", "2d", else a short date. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Bubble clock time, e.g. "4:38 PM". */
export function clockTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** True when two ISO timestamps fall on the same calendar day. */
export function sameDay(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Thread day-separator label: "Today", "Yesterday", else a short date. */
export function dayLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

const styles = StyleSheet.create({
  img: { backgroundColor: Colors.primaryLight10 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontFamily: Fonts.bold },
});
