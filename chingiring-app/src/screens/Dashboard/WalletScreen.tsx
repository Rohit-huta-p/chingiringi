import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';

const FILTER_TABS = ['All', 'Cashback', 'Coins', 'Withdrawals'] as const;

const FILTER_TYPE_MAP: Record<string, string | undefined> = {
  All: undefined,
  Cashback: 'cashback',
  Coins: 'coin_credit',
  Withdrawals: 'withdrawal',
};

const FALLBACK_WALLET: Wallet = {
  _id: '',
  userId: '',
  confirmedCashback: 1250,
  pendingCashback: 450,
  coins: 840,
  lifetimeEarned: 1700,
};

const FALLBACK_TRANSACTIONS: Transaction[] = [
  { _id: '1', userId: '', type: 'cashback', amount: 150, status: 'confirmed', description: 'Myntra', metadata: { brand: 'Myntra' }, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { _id: '2', userId: '', type: 'cashback', amount: 300, status: 'confirmed', description: 'Amazon', metadata: { brand: 'Amazon' }, createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
  { _id: '3', userId: '', type: 'withdrawal', amount: 500, status: 'completed', description: 'Withdrawal to UPI', createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  { _id: '4', userId: '', type: 'referral', amount: 50, status: 'confirmed', description: 'Referral bonus (User: RAHUL99)', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { _id: '5', userId: '', type: 'bonus', amount: 100, status: 'confirmed', description: 'QR Scan Reward', createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function getTxDisplayType(tx: Transaction): 'income' | 'withdrawal' {
  return tx.type === 'withdrawal' || tx.type === 'coin_debit' ? 'withdrawal' : 'income';
}

export const WalletScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useQuery({
    queryKey: ['walletSummary'],
    queryFn: walletAPI.getWalletSummary,
  });

  const filterType = FILTER_TYPE_MAP[activeFilter];

  const {
    data: filteredTxData,
    isLoading: isFilteredLoading,
  } = useQuery({
    queryKey: ['walletTransactions', activeFilter],
    queryFn: () => walletAPI.getTransactions({ type: filterType }),
    enabled: activeFilter !== 'All',
  });

  const wallet: Wallet = summaryData?.data?.wallet ?? FALLBACK_WALLET;
  const transactions: Transaction[] =
    activeFilter === 'All'
      ? (summaryData?.data?.recentTransactions ?? FALLBACK_TRANSACTIONS)
      : (filteredTxData?.data?.transactions ?? FALLBACK_TRANSACTIONS);

  const isLoadingTransactions = activeFilter === 'All' ? isSummaryLoading : isFilteredLoading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: isMobile ? 16 : 32 }]}>
      {/* Header */}
      <View style={[styles.header, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View>
          <Text style={styles.overviewLabel}>OVERVIEW</Text>
          <Text style={styles.headerTitle}>My Wallet</Text>
        </View>
        <View style={[styles.headerRight, isMobile && { alignSelf: 'flex-start' }]}>
          <View style={[styles.userInfo, isMobile && { alignItems: 'flex-start' }]}>
            <Text style={styles.userName}>{user?.name || 'Dev Chavan'}</Text>
            <Text style={styles.userRole}>Member</Text>
          </View>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
            style={styles.avatar}
          />
        </View>
      </View>

      {/* Balance Cards */}
      {isSummaryLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={[styles.cardsRow, isMobile && { flexDirection: 'column' }]}>
          {/* Confirmed Balance Card */}
          <View style={[styles.confirmedCard, isMobile && { minWidth: 'auto' as any }]}>
            {/* Gradient background */}
            <LinearGradient
              colors={['#4784E2', '#2D6BC9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Decorative globs (slightly off card edges) */}
            <View pointerEvents="none" style={[styles.glob, styles.globTopRight]} />
            <View pointerEvents="none" style={[styles.glob, styles.globBottomLeft]} />

            {/* Content */}
            <View style={styles.cardIconContainer}>
              <Text style={styles.cardIconText}>{'💳'}</Text>
            </View>
            <Text style={styles.confirmedLabel}>Confirmed Balance</Text>
            <Text style={styles.confirmedAmount}>{'\u20B9'}{wallet.confirmedCashback}</Text>
            <Text style={styles.confirmedSubText}>Available to withdraw</Text>
            <TouchableOpacity style={styles.withdrawBtn}>
              <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 2, gap: 20, flexDirection: 'column' }}>
            <View style={[styles.cardsRow_Pending_Coins_Card, isMobile && { flexDirection: 'row' }]}>
              {/* Pending Card */}
              <View style={styles.balanceCard}>
                <View style={styles.cardIconContainer}>
                  <Text style={styles.cardIconText}>{'🕐'}</Text>
                </View>
                <Text style={styles.cardLabel}>Pending</Text>
                <Text style={styles.cardAmount}>{'\u20B9'}{wallet.pendingCashback}</Text>
                <Text style={styles.cardSubText}>In lock period</Text>
              </View>

              {/* Coins Card */}
              <View style={styles.balanceCard}>
                <View style={styles.cardIconContainer}>
                  <Text style={styles.cardIconText}>{'🪙'}</Text>
                </View>
                <Text style={styles.cardLabel}>Coins</Text>
                <Text style={styles.cardAmount}>{wallet.coins}</Text>
                <Text style={styles.cardSubText}>Reward points</Text>
              </View>
            </View>
            {/* Total Earned Row */}
            <View style={styles.totalEarnedRow}>
              <View style={styles.totalEarnedLeft}>
                <Text style={styles.trendIcon}>{'📈'}</Text>
                <Text style={styles.totalEarnedLabel}>Total Earned (Lifetime)</Text>
                <Text style={styles.totalEarnedAmount}>{'$'}{wallet.lifetimeEarned}</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.allTimeLink}>All time {'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}



      {/* Transaction History */}
      <View style={[styles.transactionSection, isMobile && { padding: 16 }]}>
        <View style={[styles.transactionHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={styles.transactionTitle}>Transaction History</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterRow}>
            {FILTER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.filterPill, activeFilter === tab && styles.filterPillActive]}
                onPress={() => setActiveFilter(tab)}
              >
                <Text style={[styles.filterPillText, activeFilter === tab && styles.filterPillTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View></ScrollView>
        </View>

        {/* Transaction List */}
        {isLoadingTransactions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          transactions.map((tx) => {
            const displayType = getTxDisplayType(tx);
            const label = tx.metadata?.brand || tx.description;
            return (
              <View key={tx._id} style={styles.transactionItem}>
                <View style={[
                  styles.txIconContainer,
                  { backgroundColor: displayType === 'income' ? '#ecfdf5' : '#fef2f2' },
                ]}>
                  <Text style={styles.txIcon}>
                    {displayType === 'income' ? '↓' : '↑'}
                  </Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txBrand}>{label}</Text>
                  <Text style={styles.txTime}>{formatTimeAgo(tx.createdAt)}</Text>
                </View>
                <View style={styles.txAmountContainer}>
                  <Text style={[
                    styles.txAmount,
                    { color: displayType === 'income' ? Colors.success : Colors.danger },
                  ]}>
                    {displayType === 'income' ? '+' : '-'}{'\u20B9'}{tx.amount}
                  </Text>
                  <Text style={styles.txChevron}>{'›'}</Text>
                </View>
              </View>
            );
          })
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
  overviewLabel: {
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  userRole: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  cardsRow_Pending_Coins_Card: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  confirmedCard: {
    flex: 1,
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#4784E2',
    overflow: 'hidden',
    position: 'relative',
  },
  glob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  globTopRight: {
    top: -70,
    right: -60,
  },
  globBottomLeft: {
    bottom: -80,
    left: -50,
  },
  balanceCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIconContainer: {
    marginBottom: 12,
  },
  cardIconText: {
    fontSize: 24,
  },
  confirmedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  confirmedAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  confirmedSubText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  withdrawBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  cardAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  totalEarnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  totalEarnedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendIcon: {
    fontSize: 20,
  },
  totalEarnedLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  totalEarnedAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  allTimeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  transactionSection: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  transactionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: Colors.text,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
  txTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  txAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  txChevron: {
    fontSize: 20,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
