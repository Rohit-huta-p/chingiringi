import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MousePointerClick,
  CheckCircle,
  DollarSign,
  Users,
  Coins,
  TrendingUp,
  LayoutDashboard,
  Tag,
  CreditCard,
  Package,
  Image as ImageIcon,
  Ticket,
  Inbox,
} from 'lucide-react-native';
// import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';
import { useAuthStore } from '../../store';

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ─── Helpers ────────────────────────────────────────────────────────

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};
const cur = (n: number) => (n >= 100_000 ? `₹${(n / 1_000).toFixed(1)}K` : `₹${n.toLocaleString()}`);

// Fallback
const FB = {
  totalClicks: 45280, conversions: 3456, cashbackIssued: 245700, activeUsers: 8920,
  coinsIssued: 1245000, coinsRedeemed: 856000, coinsCirculating: 389000,
  topDeals: [
    { brand: 'Myntra', title: 'Myntra Fashion Sale', revenue: 12450, orders: 420 },
    { brand: 'Amazon', title: 'Amazon Electronics', revenue: 18900, orders: 380 },
    { brand: 'Flipkart', title: 'Flipkart Big Billion Days', revenue: 15600, orders: 340 },
    { brand: 'Zomato', title: 'Zomato Gold', revenue: 8900, orders: 290 },
    { brand: 'Swiggy', title: 'Swiggy Super', revenue: 7800, orders: 250 },
  ],
  topUsers: [
    { name: 'Rahul Sharma', email: 'rahul@example.com', earned: 12450, orders: 45 },
    { name: 'Priya Patel', email: 'priya@example.com', earned: 9800, orders: 38 },
    { name: 'Amit Kumar', email: 'amit@example.com', earned: 8900, orders: 32 },
    { name: 'Sneha Gupta', email: 'sneha@example.com', earned: 7650, orders: 28 },
    { name: 'Vikram Singh', email: 'vikram@example.com', earned: 6780, orders: 25 },
  ],
};

// ─── Nav Tabs ───────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'AdminDeals', label: 'Deals', icon: Tag },
  { key: 'AdminWithdrawals', label: 'Payouts', icon: CreditCard },
  { key: 'AdminUsers', label: 'Users', icon: Users },
  { key: 'AdminAllProducts', label: 'Products', icon: Package },
  { key: 'AdminBanners', label: 'Banners', icon: ImageIcon },
  { key: 'AdminCoupons', label: 'Coupons', icon: Ticket },
];

// ─── Components ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, value, label, change }: {
  icon: React.ComponentType<any>; iconBg: string; value: string; label: string; change: string;
}) {
  return (
    <View style={s.statCard}>
      <View style={s.statRow1}>
        <View style={[s.statIcon, { backgroundColor: iconBg }]}>
          <Icon size={18} color="#fff" strokeWidth={2} />
        </View>
        <Text style={s.statChange}>{change}</Text>
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function CoinsPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.coinPill, { backgroundColor: `${color}12` }]}>
      <Text style={s.coinLabel}>{label}</Text>
      <Text style={[s.coinVal, { color }]}>{value}</Text>
    </View>
  );
}

function RankRow({ rank, title, subtitle, value, detail }: {
  rank: number; title: string; subtitle: string; value: string; detail: string;
}) {
  return (
    <View style={s.rankRow}>
      <View style={s.rankCircle}><Text style={s.rankNum}>{rank}</Text></View>
      <View style={s.rankInfo}>
        <Text style={s.rankTitle} numberOfLines={1}>{title}</Text>
        <Text style={s.rankSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={s.rankRight}>
        <Text style={s.rankVal}>{value}</Text>
        <Text style={s.rankDetail}>{detail}</Text>
      </View>
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminDashboard = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboardStats(),
  });

  const d = res?.data ?? res ?? FB;
  const stats = d.stats ?? d;
  const topDeals = d.topDeals ?? FB.topDeals;
  const topUsers = d.topUsers ?? FB.topUsers;

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Header ──────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoCircle}><Text style={s.logoTxt}>C</Text></View>
            <View>
              <Text style={s.headerTitle}>Admin Panel</Text>
              <Text style={s.headerSub}>Super Admin</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.avatarCircle}
            onPress={() => nav.navigate('AdminProfile')}
            activeOpacity={0.7}
          >
            <Text style={s.avatarTxt}>{userInitials(userName)}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Nav tabs (horizontal scroll) ─────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.navScroll} contentContainerStyle={s.navContent}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'AdminDashboard';
            return (
              <TouchableOpacity
                key={item.key}
                style={[s.navTab, active && s.navTabActive]}
                onPress={() => { if (!active) nav.navigate(item.key); }}
              >
                <item.icon size={16} color={active ? '#3b82f6' : '#94a3b8'} strokeWidth={2} />
                <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Stats 2×2 grid ──────────────────────────── */}
        <View style={s.statsGrid}>
          <StatCard icon={MousePointerClick} iconBg="#6366f1" value={fmt(stats.totalClicks ?? 45280)} label="Total Clicks" change={`+12.5%`} />
          <StatCard icon={CheckCircle} iconBg="#22c55e" value={fmt(stats.conversions ?? 3456)} label="Conversions" change={`+8.2%`} />
          <StatCard icon={DollarSign} iconBg="#22c55e" value={cur(stats.cashbackIssued ?? 245700)} label="Cashback Issued" change={`+15.3%`} />
          <StatCard icon={Users} iconBg="#f97316" value={fmt(stats.activeUsers ?? 8920)} label="Active Users" change={`+6.7%`} />
        </View>

        {/* ── Coins Economy ───────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Coins size={16} color="#1e293b" strokeWidth={2} />
            <Text style={s.sectionTitle}>Coins Economy</Text>
          </View>
          <View style={s.coinsRow}>
            <CoinsPill label="Issued" value={fmt(stats.coinsIssued ?? 1245000)} color="#3b82f6" />
            <CoinsPill label="Redeemed" value={fmt(stats.coinsRedeemed ?? 856000)} color="#8b5cf6" />
            <CoinsPill label="Circulating" value={fmt(stats.coinsCirculating ?? 389000)} color="#22c55e" />
          </View>
        </View>

        {/* ── Revenue Trend (line chart + gradient) ──── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <TrendingUp size={16} color="#1e293b" strokeWidth={2} />
            <Text style={s.sectionTitle}>Revenue Trend (30 Days)</Text>
          </View>
          {/* Y-axis labels */}
          <View style={s.chartWrap}>
            <View style={s.yAxis}>
              {['1600', '1200', '800', '400', '0'].map((l) => (
                <Text key={l} style={s.yLabel}>{l}</Text>
              ))}
            </View>
            {/* Simple bar chart (SVG disabled for Expo Go compat) */}
            <View style={s.chartArea}>
              <View style={s.chartBars}>
                {[60, 80, 45, 90, 70, 85, 55].map((h, i) => (
                  <View key={i} style={s.chartBarCol}>
                    <View style={[s.chartBarFill, { height: `${h}%` }]} />
                  </View>
                ))}
              </View>
            </View>
          </View>
          {/* X-axis labels */}
          <View style={s.xAxis}>
            <Text style={s.xLabel}>Mar 7</Text>
            <Text style={s.xLabel}>Mar 15</Text>
            <Text style={s.xLabel}>Mar 23</Text>
            <Text style={s.xLabel}>Mar 31</Text>
          </View>
        </View>

        {/* ── Top Performing Deals ─────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Performing Deals</Text>
          {topDeals.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={32} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No deals yet</Text>
              <Text style={s.emptySub}>Create your first deal to see performance metrics here.</Text>
            </View>
          ) : topDeals.slice(0, 5).map((deal: any, i: number) => (
            <RankRow
              key={i}
              rank={i + 1}
              title={deal.title}
              subtitle={deal.brand}
              value={`₹${fmt(deal.revenue)}`}
              detail={`${deal.orders} orders`}
            />
          ))}
        </View>

        {/* ── Top Users ────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Users</Text>
          {topUsers.length === 0 ? (
            <View style={s.emptyState}>
              <Users size={32} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No user activity</Text>
              <Text style={s.emptySub}>User rankings will appear once transactions start flowing.</Text>
            </View>
          ) : topUsers.slice(0, 5).map((user: any, i: number) => (
            <RankRow
              key={i}
              rank={i + 1}
              title={user.name}
              subtitle={user.email}
              value={`₹${fmt(user.earned)}`}
              detail={`${user.orders} orders`}
            />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Nav
  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontWeight: '700' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard: {
    width: '48%' as any,
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  statRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statChange: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },

  // Sections
  section: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 12, marginBottom: 12, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },

  // Coins
  coinsRow: { flexDirection: 'row', gap: 8 },
  coinPill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  coinLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  coinVal: { fontSize: 16, fontWeight: '800' },

  // Chart
  chartWrap: { flexDirection: 'row', alignItems: 'stretch' },
  yAxis: { width: 32, justifyContent: 'space-between', paddingVertical: 2 },
  yLabel: { fontSize: 9, color: '#94a3b8', textAlign: 'right' },
  chartArea: { flex: 1, height: 130 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', flex: 1, gap: 6 },
  chartBarCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', backgroundColor: '#dbeafe', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingLeft: 32 },
  xLabel: { fontSize: 10, color: '#94a3b8' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#94a3b8', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 220 },

  // Rank rows
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  rankCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankNum: { fontSize: 12, fontWeight: '700', color: '#475569' },
  rankInfo: { flex: 1 },
  rankTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rankSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  rankRight: { alignItems: 'flex-end' },
  rankVal: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  rankDetail: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
});
