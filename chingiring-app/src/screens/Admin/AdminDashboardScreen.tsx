import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, CheckCircle, DollarSign, Users, Coins } from 'lucide-react-native';
import { Colors, Spacing } from '../../constants/theme';
import { adminAPI } from '../../api/admin';

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`;
  return num.toLocaleString();
};

const formatCurrency = (num: number): string => {
  if (num >= 100000) return `\u20B9${(num / 1000).toFixed(1)}K`;
  return `\u20B9${num.toLocaleString()}`;
};

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, value, label, change }: {
  icon: React.ComponentType<any>;
  iconBg: string;
  value: string;
  label: string;
  change: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: iconBg }]}>
          <Icon size={20} color="#fff" />
        </View>
        <Text style={styles.statChange}>{change}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Coins Card ─────────────────────────────────────────────────────────────

function CoinsCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.coinsCard, { backgroundColor: `${color}15` }]}>
      <Text style={styles.coinsLabel}>{label}</Text>
      <Text style={[styles.coinsValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Ranked Row ─────────────────────────────────────────────────────────────

function RankedRow({ rank, title, subtitle, amount, detail }: {
  rank: number;
  title: string;
  subtitle: string;
  amount: string;
  detail: string;
}) {
  const rankColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#6366f1'];
  return (
    <View style={styles.rankedRow}>
      <View style={[styles.rankBadge, { backgroundColor: rankColors[rank - 1] || '#94a3b8' }]}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <View style={styles.rankedInfo}>
        <Text style={styles.rankedTitle}>{title}</Text>
        <Text style={styles.rankedSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.rankedAmount}>
        <Text style={styles.rankedAmountText}>{amount}</Text>
        <Text style={styles.rankedDetail}>{detail}</Text>
      </View>
    </View>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminAPI.getDashboardStats,
  });

  const stats = data?.data?.stats;
  const coins = data?.data?.coinsEconomy;

  const topDeals = data?.data?.topDeals?.length ? data.data.topDeals : [
    { name: 'Myntra Fashion Sale', brand: 'Myntra', amount: 12450, orders: 420 },
    { name: 'Amazon Electronics', brand: 'Amazon', amount: 18900, orders: 380 },
    { name: 'Flipkart Big Billion Days', brand: 'Flipkart', amount: 15600, orders: 340 },
    { name: 'Zomato Gold', brand: 'Zomato', amount: 8900, orders: 290 },
    { name: 'Swiggy Super', brand: 'Swiggy', amount: 7800, orders: 250 },
  ];

  const topUsers = data?.data?.topUsers?.length ? data.data.topUsers : [
    { name: 'Rahul Sharma', email: 'rahul@example.com', amount: 12450, orders: 45 },
    { name: 'Priya Patel', email: 'priya@example.com', amount: 9800, orders: 38 },
    { name: 'Amit Kumar', email: 'amit@example.com', amount: 8900, orders: 32 },
    { name: 'Sneha Gupta', email: 'sneha@example.com', amount: 7650, orders: 28 },
    { name: 'Vikram Singh', email: 'vikram@example.com', amount: 6780, orders: 25 },
  ];

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.pageTitle}>Dashboard</Text>

      {/* Stat Cards Row */}
      <View style={[styles.statsRow, !isDesktop && styles.statsRowMobile]}>
        <StatCard
          icon={TrendingUp}
          iconBg="#3b82f6"
          value={formatNumber(stats?.totalClicks ?? 45280)}
          label="Total Clicks"
          change="+12.5%"
        />
        <StatCard
          icon={CheckCircle}
          iconBg="#10b981"
          value={formatNumber(stats?.conversions ?? 3456)}
          label="Conversions"
          change="+8.2%"
        />
        <StatCard
          icon={DollarSign}
          iconBg="#8b5cf6"
          value={formatCurrency(stats?.cashbackIssued ?? 245700)}
          label="Cashback Issued"
          change="+15.3%"
        />
        <StatCard
          icon={Users}
          iconBg="#f97316"
          value={formatNumber(stats?.activeUsers ?? 8920)}
          label="Active Users"
          change="+6.7%"
        />
      </View>

      {/* Coins Economy */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Coins size={18} color={Colors.text} />
          <Text style={styles.sectionTitle}>Coins Economy</Text>
        </View>
        <View style={[styles.coinsRow, !isDesktop && styles.coinsRowMobile]}>
          <CoinsCard label="Coins Issued" value={formatNumber(coins?.issued ?? 1245000)} color="#10b981" />
          <CoinsCard label="Coins Redeemed" value={formatNumber(coins?.redeemed ?? 856000)} color="#f97316" />
          <CoinsCard label="Coins in Circulation" value={formatNumber(coins?.circulation ?? 389000)} color="#3b82f6" />
        </View>
      </View>

      {/* Revenue Trend Placeholder */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={18} color={Colors.text} />
          <Text style={styles.sectionTitle}>Revenue Trend (Last 30 Days)</Text>
        </View>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartPlaceholderText}>Chart coming soon</Text>
        </View>
      </View>

      {/* Top Performing Deals & Top Users */}
      <View style={[styles.tablesRow, !isDesktop && styles.tablesRowMobile]}>
        <View style={[styles.tableCard, !isDesktop && styles.tableCardMobile]}>
          <Text style={styles.tableTitle}>Top Performing Deals</Text>
          {topDeals.map((deal: any, i: number) => (
            <RankedRow
              key={i}
              rank={i + 1}
              title={deal.name}
              subtitle={deal.brand}
              amount={formatCurrency(deal.amount)}
              detail={`${deal.orders} orders`}
            />
          ))}
        </View>
        <View style={[styles.tableCard, !isDesktop && styles.tableCardMobile]}>
          <Text style={styles.tableTitle}>Top Users</Text>
          {topUsers.map((user: any, i: number) => (
            <RankedRow
              key={i}
              rank={i + 1}
              title={user.name}
              subtitle={user.email}
              amount={formatCurrency(user.amount)}
              detail={`${user.orders} orders`}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: Spacing.lg },
  pageTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statsRowMobile: { flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statIconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statChange: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  statLabel: { fontSize: 12, color: Colors.textSecondary },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },

  // Coins
  coinsRow: { flexDirection: 'row', gap: Spacing.md },
  coinsRowMobile: { flexWrap: 'wrap' },
  coinsCard: {
    flex: 1,
    minWidth: 130,
    borderRadius: 10,
    padding: Spacing.md,
  },
  coinsLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  coinsValue: { fontSize: 24, fontWeight: '700' },

  // Chart placeholder
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: { color: Colors.textSecondary, fontSize: 14 },

  // Tables
  tablesRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.lg },
  tablesRowMobile: { flexDirection: 'column' },
  tableCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableCardMobile: { marginBottom: Spacing.md },
  tableTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },

  // Ranked rows
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rankedInfo: { flex: 1 },
  rankedTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rankedSubtitle: { fontSize: 12, color: Colors.textSecondary },
  rankedAmount: { alignItems: 'flex-end' },
  rankedAmountText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  rankedDetail: { fontSize: 11, color: Colors.textSecondary },
});
