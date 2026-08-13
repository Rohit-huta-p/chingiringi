import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { walletAPI, Transaction } from '../../api/wallet';

const TRANSACTION_TYPES = ['All', 'Shares', 'Withdrawals'];
const TIME_PERIODS = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'];

const PERIOD_MAP: Record<string, string | undefined> = {
  'All Time': undefined,
  'Last 7 Days': '7d',
  'Last 30 Days': '30d',
  'Last 90 Days': '90d',
};

const TYPE_MAP: Record<string, string | undefined> = {
  'All': undefined,
  'Shares': 'coin_credit',
  'Withdrawals': 'withdrawal',
};

const STATUS_FILTERS = ['All', 'Under review', 'Paid', 'Rejected'];
const PAGE_SIZE = 15;

const COINS_PER_RUPEE = 1000; // 1,000 coins = 1 rupee (mirrors AdminSettings default)

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const TransactionHistoryScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const navigation = useNavigation();
  const [activeType, setActiveType] = useState('All');
  const [activePeriod, setActivePeriod] = useState('All Time');
  const [activeStatus, setActiveStatus] = useState('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Fetch a wide window once, then filter client-side so chip toggles feel
  // instant (no refetch flash). Pagination is a display slice.
  const { data: txResponse, isLoading } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => walletAPI.getTransactions({ limit: 200 }),
  });

  const allTx: Transaction[] = txResponse?.data?.transactions ?? [];
  const wantType = TYPE_MAP[activeType];
  const periodCode = PERIOD_MAP[activePeriod];
  const periodDays = periodCode === '7d' ? 7 : periodCode === '30d' ? 30 : periodCode === '90d' ? 90 : 0;
  const transactions: Transaction[] = useMemo(() => allTx.filter((tx) => {
    if (wantType && tx.type !== wantType) return false;
    if (periodDays && Date.now() - new Date(tx.createdAt).getTime() > periodDays * 86400000) return false;
    if (activeStatus === 'Under review' && tx.status !== 'pending') return false;
    if (activeStatus === 'Paid' && !(tx.status === 'completed' || tx.status === 'confirmed')) return false;
    if (activeStatus === 'Rejected' && tx.status !== 'rejected') return false;
    return true;
  }), [allTx, wantType, periodDays, activeStatus]);

  // Reset paging whenever a filter changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeType, activePeriod, activeStatus]);
  const visibleTx = transactions.slice(0, visibleCount);
  // Net value in rupees. Coin transactions are converted at the coin rate so
  // we don't add coins and rupees together as if they were the same unit.
  const totalAmount = useMemo(() =>
    transactions.reduce((sum, tx) => {
      const isIncome = ['cashback', 'referral', 'bonus', 'coin_credit'].includes(tx.type);
      const isCoin = tx.type === 'coin_credit' || tx.type === 'coin_debit';
      const rupees = isCoin ? tx.amount / COINS_PER_RUPEE : tx.amount;
      return sum + (isIncome ? rupees : -rupees);
    }, 0),
    [transactions]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: isMobile ? 16 : 32 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>{'<-'}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.accountLabel}>ACCOUNT</Text>
            <Text style={[styles.headerTitle, isMobile && { fontSize: 22 }]}>Transaction History</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      <View style={[styles.filtersSection, isMobile && { padding: 16 }]}>
        <View style={styles.filtersHeader}>
          <Text style={styles.filtersIcon}>{'🔽'}</Text>
          <Text style={styles.filtersLabel}>Filters</Text>
        </View>

        {/* Transaction Type */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>TRANSACTION TYPE</Text>
          <ScrollView horizontal={isMobile} showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {TRANSACTION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterPill, activeType === type && styles.filterPillActive]}
                  onPress={() => setActiveType(type)}
                >
                  <Text style={[styles.filterPillText, activeType === type && styles.filterPillTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Time Period */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>TIME PERIOD</Text>
          <ScrollView horizontal={isMobile} showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {TIME_PERIODS.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[styles.filterPill, activePeriod === period && styles.filterPillActive]}
                  onPress={() => setActivePeriod(period)}
                >
                  <Text style={[styles.filterPillText, activePeriod === period && styles.filterPillTextActive]}>
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Status */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>STATUS</Text>
          <ScrollView horizontal={isMobile} showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {STATUS_FILTERS.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterPill, activeStatus === st && styles.filterPillActive]}
                  onPress={() => setActiveStatus(st)}
                >
                  <Text style={[styles.filterPillText, activeStatus === st && styles.filterPillTextActive]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Net Amount ({transactions.length} transactions)</Text>
        <Text style={styles.summaryAmount}>{'\u20B9'}{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
      </View>

      {/* Transaction List */}
      <View style={[styles.transactionList, isMobile && { padding: 16 }]}>
        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>{'\u{1F4B3}'}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 }}>No transactions yet</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Your transaction history will appear here</Text>
          </View>
        ) : visibleTx.map((tx) => {
          const isIncome = ['cashback', 'referral', 'bonus', 'coin_credit'].includes(tx.type);
          const isCoin = tx.type === 'coin_credit' || tx.type === 'coin_debit';
          const brandName = tx.metadata?.brand || tx.description || tx.type;
          const categoryLabel = tx.type.charAt(0).toUpperCase() + tx.type.slice(1).replace('_', ' ');
          return (
            <View key={tx._id} style={styles.transactionItem}>
              <View style={styles.txRow}>
                <View style={[
                  styles.txIconContainer,
                  { backgroundColor: isIncome ? '#ecfdf5' : '#fef2f2' },
                ]}>
                  <Text style={[
                    styles.txIcon,
                    { color: isIncome ? Colors.success : Colors.danger },
                  ]}>
                    {isIncome ? '\u2193' : '\u2191'}
                  </Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txBrand}>{brandName}</Text>
                  <Text style={styles.txMeta}>
                    {categoryLabel} {' \u00B7 '} {'\u{1F552}'} {formatTimeAgo(tx.createdAt)}
                  </Text>
                  <Text style={styles.txPurchase}>{tx.description}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[
                    styles.txAmount,
                    { color: isIncome ? Colors.success : Colors.danger },
                  ]}>
                    {isIncome ? '+' : '-'}{isCoin ? tx.amount + ' coins' : '\u20B9' + tx.amount}
                  </Text>
                  <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  <View style={[
                    styles.statusBadge,
                    tx.status === 'confirmed' || tx.status === 'completed' ? styles.statusConfirmed : styles.statusPending,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      tx.status === 'confirmed' || tx.status === 'completed' ? styles.statusTextConfirmed : styles.statusTextPending,
                    ]}>
                      {tx.type === 'withdrawal' && tx.status === 'pending'
                        ? 'Under review'
                        : tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        {visibleCount < transactions.length && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
            activeOpacity={0.8}
          >
            <Text style={styles.loadMoreTxt}>Load more ({transactions.length - visibleCount} left)</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  accountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  exportBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  filtersSection: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  filtersIcon: {
    fontSize: 16,
  },
  filtersLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    backgroundColor: '#10b981',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
  },
  transactionList: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transactionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  txIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  txInfo: {
    flex: 1,
  },
  txBrand: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  txPurchase: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConfirmed: {
    backgroundColor: '#ecfdf5',
  },
  statusPending: {
    backgroundColor: '#fff7ed',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextConfirmed: {
    color: Colors.success,
  },
  statusTextPending: {
    color: '#f59e0b',
  },
  loadMoreBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  loadMoreTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
