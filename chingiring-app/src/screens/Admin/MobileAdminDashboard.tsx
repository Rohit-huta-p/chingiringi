import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Coins, TrendingUp } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { TrendChart } from '../../components/TrendChart';
import {
  DashboardData, EMPTY_DASHBOARD, M, fmt,
  HeroPanel, MetricCard, SharersBoard, RevenueStrip,
} from '../../components/dashboard/parts';

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminDashboard = () => {
  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboardStats(),
  });
  const d: DashboardData = res?.data ?? EMPTY_DASHBOARD;

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={M.indigo} /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <MobileAdminNav active="AdminDashboard" />

        <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
          <HeroPanel hero={d.hero} trend={d.shareTrend} />

          <View style={s.grid}>
            <MetricCard label="Shares today" c={d.cards.sharesToday} accent={M.amber} />
            <MetricCard label="Shares · 30d" c={d.cards.shares30d} accent={M.green} />
            <MetricCard label="Unique sharers · 30d" c={d.cards.uniqueSharers30d} accent={M.indigo} />
            <MetricCard label="Coins issued · 30d" c={d.cards.coinsIssued30d} accent={M.red} money />
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sHead}><Coins size={16} color={M.ink} /><Text style={s.sTitle}>Coins economy</Text></View>
          <View style={s.pills}>
            <View style={[s.pill, { backgroundColor: 'rgba(18,183,106,0.10)' }]}><Text style={[s.pillV, { color: M.good }]}>{fmt(d.coinsEconomy.issued)}</Text><Text style={s.pillL}>Issued</Text></View>
            <View style={[s.pill, { backgroundColor: 'rgba(240,68,56,0.10)' }]}><Text style={[s.pillV, { color: M.bad }]}>{fmt(d.coinsEconomy.redeemed)}</Text><Text style={s.pillL}>Redeemed</Text></View>
            <View style={[s.pill, { backgroundColor: 'rgba(91,75,230,0.10)' }]}><Text style={[s.pillV, { color: M.indigo }]}>{fmt(d.coinsEconomy.circulation)}</Text><Text style={s.pillL}>Circulating</Text></View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sHead}><TrendingUp size={16} color={M.ink} /><Text style={s.sTitle}>Share momentum · 30 days</Text></View>
          <TrendChart data={d.shareTrend.map((p) => ({ label: p.label, value: p.shares }))} color={M.indigo} />
        </View>

        <View style={s.section}>
          <Text style={s.sTitle}>Top sharers</Text>
          <View style={{ marginTop: 8 }}><SharersBoard rows={d.topSharers} /></View>
        </View>

        <View style={{ paddingHorizontal: 12 }}><RevenueStrip revenue={d.revenue} /></View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: M.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { backgroundColor: M.card, borderRadius: 16, marginHorizontal: 12, marginTop: 12, padding: 16 },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sTitle: { fontSize: 16, fontWeight: '700', color: M.ink },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  pillV: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pillL: { fontSize: 11, color: M.ink2, marginTop: 4 },
});
