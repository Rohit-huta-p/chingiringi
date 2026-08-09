import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { TrendChart } from '../TrendChart';

export interface Delta { value: number; deltaPct: number | null; }
export interface DashboardData {
  hero: { totalShares: number; sharesToday: number; coinsFromShares: number; liabilityRupees: number };
  cards: { sharesToday: Delta; shares30d: Delta; uniqueSharers30d: Delta; coinsIssued30d: Delta };
  coinsEconomy: { issued: number; redeemed: number; circulation: number };
  shareTrend: { label: string; shares: number }[];
  topSharers: { name: string; email: string; shares: number; coins: number }[];
  topSharedItems: { itemType: 'product' | 'store'; name: string; brand?: string; shares: number }[];
  revenue: { clicks: number; purchases: number; commission: number };
}

export const EMPTY_DASHBOARD: DashboardData = {
  hero: { totalShares: 0, sharesToday: 0, coinsFromShares: 0, liabilityRupees: 0 },
  cards: {
    sharesToday: { value: 0, deltaPct: null }, shares30d: { value: 0, deltaPct: null },
    uniqueSharers30d: { value: 0, deltaPct: null }, coinsIssued30d: { value: 0, deltaPct: null },
  },
  coinsEconomy: { issued: 0, redeemed: 0, circulation: 0 },
  shareTrend: [], topSharers: [], topSharedItems: [],
  revenue: { clicks: 0, purchases: 0, commission: 0 },
};

export const M = {
  bg: '#f3f3fb', card: '#fff', ink: '#161334', ink2: '#6c6a89', line: '#ecebf5',
  hero: '#1e1b45', heroLabel: '#b9b4f0', heroSub: '#a29de0',
  indigo: '#5b4be6', good: '#12b76a', bad: '#f04438',
  amber: '#f79009', green: '#12b76a', red: '#f04438',
  avatars: ['#5b4be6', '#f79009', '#12b76a', '#e87ba4', '#2a78d6'],
};

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K` : Math.round(n).toLocaleString();
export const cur = (n: number) => (n >= 100_000 ? `₹${(n / 1_000).toFixed(1)}K` : `₹${Math.round(n).toLocaleString()}`);

function initials(name: string) {
  const p = (name || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <View style={[s.pill, { backgroundColor: up ? 'rgba(18,183,106,0.14)' : 'rgba(240,68,56,0.14)' }]}>
      <Text style={[s.pillTxt, { color: up ? M.good : M.bad }]}>{up ? '▲' : '▼'} {Math.abs(pct)}%</Text>
    </View>
  );
}

export function HeroPanel({ hero, trend }: { hero: DashboardData['hero']; trend: DashboardData['shareTrend'] }) {
  const vals = trend.map((t) => t.shares);
  const max = Math.max(1, ...vals);
  const w = 118, h = 30, n = vals.length;
  const pts = vals.map((v, i) => `${(n <= 1 ? w / 2 : (i / (n - 1)) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
  return (
    <View style={s.hero}>
      <Text style={s.heroLabel}>Total shares</Text>
      <Text style={s.heroBig}>{hero.totalShares.toLocaleString()}</Text>
      <View style={s.heroRow}>
        <View style={s.heroPill}><Text style={s.heroPillTxt}>▲ {hero.sharesToday} today</Text></View>
        {n > 1 && (
          <Svg width={w} height={h} style={{ marginLeft: 'auto' }}>
            <Polyline points={pts} fill="none" stroke={M.heroLabel} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={s.heroSubRow}>
        <View><Text style={s.heroSubK}>Coins from shares</Text><Text style={s.heroSubV}>{fmt(hero.coinsFromShares)} CR</Text></View>
        <View><Text style={s.heroSubK}>Coin liability</Text><Text style={s.heroSubV}>{cur(hero.liabilityRupees)}</Text></View>
      </View>
    </View>
  );
}

export function MetricCard({ label, c, accent, money }: { label: string; c: Delta; accent: string; money?: boolean }) {
  return (
    <View style={s.metric}>
      <View style={[s.stripe, { backgroundColor: accent }]} />
      <View style={s.metricTop}><DeltaPill pct={c.deltaPct} /></View>
      <Text style={s.metricV}>{money ? fmt(c.value) : c.value.toLocaleString()}</Text>
      <Text style={s.metricL}>{label}</Text>
    </View>
  );
}

export function SharersBoard({ rows }: { rows: DashboardData['topSharers'] }) {
  if (!rows.length) return <Text style={s.empty}>No sharers yet — rankings appear as users share.</Text>;
  const top = rows[0]?.shares || 1;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={s.lr}>
          <View style={[s.avatar, { backgroundColor: M.avatars[i % M.avatars.length] }]}><Text style={s.avatarTxt}>{initials(r.name)}</Text></View>
          <View style={s.lmid}>
            <Text style={s.lname} numberOfLines={1}>{r.name}</Text>
            <View style={s.bar}><View style={[s.barFill, { width: `${Math.round((r.shares / top) * 100)}%` }]} /></View>
          </View>
          <Text style={s.lval}>{r.shares}</Text>
        </View>
      ))}
    </View>
  );
}

export function SharedItemsBoard({ rows }: { rows: DashboardData['topSharedItems'] }) {
  if (!rows.length) return <Text style={s.empty}>No shared items yet.</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={s.ir}>
          <Text style={s.irank}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={s.iname} numberOfLines={1}>{r.name}</Text>
          <View style={[s.tag, { borderColor: M.line }]}><Text style={s.tagTxt}>{r.itemType}</Text></View>
          <Text style={s.ival}>{r.shares}</Text>
        </View>
      ))}
    </View>
  );
}

export function RevenueStrip({ revenue }: { revenue: DashboardData['revenue'] }) {
  const cells = [
    { v: fmt(revenue.clicks), l: 'Clicks' },
    { v: revenue.purchases.toLocaleString(), l: 'Purchases' },
    { v: cur(revenue.commission), l: 'Commission' },
  ];
  return (
    <View style={s.rev}>
      {cells.map((c, i) => (
        <View key={i} style={s.revCell}><Text style={s.revV}>{c.v}</Text><Text style={s.revL}>{c.l}</Text></View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: M.hero, borderRadius: 20, padding: 18, marginBottom: 12 },
  heroLabel: { color: M.heroLabel, fontSize: 12, fontWeight: '600' },
  heroBig: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroPill: { backgroundColor: 'rgba(43,209,134,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroPillTxt: { color: '#4ade9a', fontSize: 12, fontWeight: '700' },
  heroSubRow: { flexDirection: 'row', gap: 28, marginTop: 16 },
  heroSubK: { color: M.heroSub, fontSize: 11 },
  heroSubV: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },

  metric: { flex: 1, minWidth: '46%', backgroundColor: M.card, borderRadius: 15, padding: 13, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  metricTop: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 20 },
  metricV: { fontSize: 22, fontWeight: '800', color: M.ink, marginTop: 6, fontVariant: ['tabular-nums'] },
  metricL: { fontSize: 11, color: M.ink2, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  lr: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: M.line },
  avatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  lmid: { flex: 1, minWidth: 0 },
  lname: { fontSize: 13, fontWeight: '600', color: M.ink },
  bar: { height: 5, borderRadius: 3, backgroundColor: M.line, marginTop: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: M.indigo },
  lval: { fontSize: 14, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },

  ir: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: M.line },
  irank: { fontSize: 11, color: M.ink2, width: 18, fontVariant: ['tabular-nums'] },
  iname: { flex: 1, fontSize: 13, color: M.ink },
  tag: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  tagTxt: { fontSize: 10, color: M.ink2 },
  ival: { fontSize: 13, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },

  rev: { flexDirection: 'row', backgroundColor: M.card, borderRadius: 14, padding: 12 },
  revCell: { flex: 1, alignItems: 'center' },
  revV: { fontSize: 15, fontWeight: '800', color: M.ink, fontVariant: ['tabular-nums'] },
  revL: { fontSize: 10, color: M.ink2, marginTop: 2 },
  empty: { fontSize: 12, color: M.ink2, textAlign: 'center', paddingVertical: 20 },
});
