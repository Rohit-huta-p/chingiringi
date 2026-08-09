import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Coins } from 'lucide-react-native';
import { adminAPI } from '../../api/admin';
import { TrendChart } from '../../components/TrendChart';
import {
  DashboardData, EMPTY_DASHBOARD, M, fmt,
  HeroPanel, MetricCard, SharersBoard, SharedItemsBoard, RevenueStrip,
} from '../../components/dashboard/parts';

export function AdminDashboardScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminAPI.getDashboardStats });
  const d: DashboardData = data?.data ?? EMPTY_DASHBOARD;
  const isDesktop = Dimensions.get('window').width >= 768;

  if (isLoading) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={M.indigo} /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Dashboard</Text>

      <HeroPanel hero={d.hero} trend={d.shareTrend} />

      <View style={[s.cards, !isDesktop && s.wrap]}>
        <MetricCard label="Shares today" c={d.cards.sharesToday} accent={M.amber} />
        <MetricCard label="Shares · 30d" c={d.cards.shares30d} accent={M.green} />
        <MetricCard label="Unique sharers · 30d" c={d.cards.uniqueSharers30d} accent={M.indigo} />
        <MetricCard label="Coins issued · 30d" c={d.cards.coinsIssued30d} accent={M.red} money />
      </View>

      <View style={s.section}>
        <View style={s.sHead}><Coins size={18} color={M.ink} /><Text style={s.sTitle}>Coins economy</Text></View>
        <View style={s.pills}>
          <View style={[s.pill, { backgroundColor: 'rgba(18,183,106,0.10)' }]}><Text style={[s.pillV, { color: M.good }]}>{fmt(d.coinsEconomy.issued)}</Text><Text style={s.pillL}>Issued</Text></View>
          <View style={[s.pill, { backgroundColor: 'rgba(240,68,56,0.10)' }]}><Text style={[s.pillV, { color: M.bad }]}>{fmt(d.coinsEconomy.redeemed)}</Text><Text style={s.pillL}>Redeemed</Text></View>
          <View style={[s.pill, { backgroundColor: 'rgba(91,75,230,0.10)' }]}><Text style={[s.pillV, { color: M.indigo }]}>{fmt(d.coinsEconomy.circulation)}</Text><Text style={s.pillL}>Circulating</Text></View>
        </View>
      </View>

      <View style={s.section}>
        <View style={s.sHead}><TrendingUp size={18} color={M.ink} /><Text style={s.sTitle}>Share momentum · 30 days</Text></View>
        <TrendChart data={d.shareTrend.map((p) => ({ label: p.label, value: p.shares }))} color={M.indigo} />
      </View>

      <View style={[s.boards, !isDesktop && s.wrap]}>
        <View style={[s.board, !isDesktop && s.boardMobile]}><Text style={s.sTitle}>Top sharers</Text><View style={{ marginTop: 8 }}><SharersBoard rows={d.topSharers} /></View></View>
        <View style={[s.board, !isDesktop && s.boardMobile]}><Text style={s.sTitle}>Top shared items</Text><View style={{ marginTop: 8 }}><SharedItemsBoard rows={d.topSharedItems} /></View></View>
      </View>

      <RevenueStrip revenue={d.revenue} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },
  content: { padding: 20, gap: 16 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: M.ink },
  cards: { flexDirection: 'row', gap: 12 },
  wrap: { flexWrap: 'wrap' },
  section: { backgroundColor: M.card, borderRadius: 12, padding: 16 },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sTitle: { fontSize: 16, fontWeight: '600', color: M.ink },
  pills: { flexDirection: 'row', gap: 12 },
  pill: { flex: 1, minWidth: 130, borderRadius: 10, padding: 14, alignItems: 'center' },
  pillV: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillL: { fontSize: 12, color: M.ink2, marginTop: 4 },
  boards: { flexDirection: 'row', gap: 16 },
  board: { flex: 1, backgroundColor: M.card, borderRadius: 12, padding: 16 },
  boardMobile: { marginBottom: 12 },
});
