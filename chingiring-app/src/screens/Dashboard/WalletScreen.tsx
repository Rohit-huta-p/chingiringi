import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { Wallet as WalletIcon, TrendingUp, ArrowDownToLine, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';
import { ShareToEarnCard } from '../../components/ShareToEarnCard';
import { PendingRewardCard } from '../../components/PendingRewardCard';
import { WithdrawalPendingCard } from '../../components/WithdrawalPendingCard';
import { TransactionRow } from '../../components/TransactionRow';
import { WithdrawModal } from '../../components/WithdrawModal';

// Coins→₹ conversion. Mirrors AdminSettings.coinsPerRupee default (1000);
// 100 coins = 10 paise. The exact rate is re-locked server-side at request time.
const COINS_PER_RUPEE = 1000;

const FILTER_TABS = ['All', 'Shares', 'Withdrawals'] as const;

const FILTER_TYPE_MAP: Record<string, string | undefined> = {
  All: undefined,
  Shares: 'coin_credit',
  Withdrawals: 'withdrawal',
};

// Zero-state wallet used before the API responds — all zeros, never fake
// balances (which masked failures and read as real money).
const EMPTY_WALLET: Wallet = {
  _id: '',
  userId: '',
  confirmedCashback: 0,
  pendingCashback: 0,
  coins: 0,
  pendingCoins: 0,
  lifetimeEarned: 0,
};

export const WalletScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  // Auto-open the withdraw modal when navigated here with { openWithdraw: true }
  // (from the profile Coins card). Clear the param after so it re-triggers next time.
  const openWithdrawParam = route.params?.openWithdraw;
  useEffect(() => {
    if (openWithdrawParam) {
      setShowWithdraw(true);
      navigation.setParams({ openWithdraw: undefined });
    }
  }, [openWithdrawParam, navigation]);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useQuery({
    queryKey: ['walletSummary'],
    queryFn: walletAPI.getWalletSummary,
  });

  // Not otherwise queried on this screen (it reads walletSummary for the
  // wallet fields) — added to surface shareRewards; react-query dedupes
  // this key with other ['wallet'] consumers (e.g. the withdraw modal's
  // invalidation) so it's not a second network path.
  const { data: walletRes } = useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() });

  const filterType = FILTER_TYPE_MAP[activeFilter];

  const {
    data: filteredTxData,
    isLoading: isFilteredLoading,
  } = useQuery({
    queryKey: ['walletTransactions', activeFilter],
    queryFn: () => walletAPI.getTransactions({ type: filterType }),
    enabled: activeFilter !== 'All',
  });

  const wallet: Wallet = summaryData?.data?.wallet ?? EMPTY_WALLET;
  const shareRewards = (walletRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };
  const pendingWithdrawals = (walletRes as any)?.data?.pendingWithdrawals ?? { total: 0, count: 0 };
  const transactions: Transaction[] =
    activeFilter === 'All'
      ? (summaryData?.data?.recentTransactions ?? [])
      : (filteredTxData?.data?.transactions ?? []);

  const isLoadingTransactions = activeFilter === 'All' ? isSummaryLoading : isFilteredLoading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: isMobile ? 16 : 32 }]}>
      {/* Header */}
      <View style={[styles.header, isMobile && { flexDirection: 'column', gap: 12 }]}>
        <View>
          <Text style={styles.overviewLabel}>OVERVIEW</Text>
          <Text style={styles.headerTitle}>My Wallet</Text>
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
            <View style={[styles.iconChip, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <WalletIcon size={22} color="#ffffff" strokeWidth={2} />
            </View>
            <Text style={styles.confirmedLabel}>Coin Balance</Text>
            <Text style={styles.confirmedAmount}>{(wallet.coins ?? 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.confirmedSubText}>{'\u2248 \u20B9'}{Math.floor((wallet.coins ?? 0) / COINS_PER_RUPEE).toLocaleString('en-IN')}{' \u00B7 Available to withdraw'}</Text>
           
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => setShowWithdraw(true)}>
              <ArrowDownToLine size={15} color="#3b82f6" strokeWidth={2.5} />
              <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 2, gap: 20, flexDirection: 'column' }}>
            <ShareToEarnCard />
            {/* Total Earned Row */}
            <View style={styles.totalEarnedRow}>
              <View style={styles.totalEarnedLeft}>
                <View style={[styles.iconChip, { backgroundColor: '#dcfce7', marginBottom: 0, width: 34, height: 34, borderRadius: 10 }]}>
                  <TrendingUp size={17} color="#16a34a" strokeWidth={2.2} />
                </View>
                <Text style={styles.totalEarnedLabel}>Total Earned (Lifetime)</Text>
                <Text style={styles.totalEarnedAmount}>{(wallet.lifetimeEarned ?? 0).toLocaleString('en-IN')} coins</Text>
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={styles.allTimeLink}>All time</Text>
                <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <WithdrawalPendingCard total={pendingWithdrawals.total} count={pendingWithdrawals.count} />
      <PendingRewardCard pending={shareRewards.pending} confirmed={shareRewards.confirmed} />

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
        ) : transactions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>No transactions yet.</Text>
          </View>
        ) : (
          transactions.slice(0, 6).map((tx) => (
            <TransactionRow key={tx._id} tx={tx} />
          ))
        )}

        {transactions.length > 0 && (
          <TouchableOpacity style={styles.seeAllBtn} onPress={() => navigation.navigate('TransactionHistory')} activeOpacity={0.8}>
            <Text style={styles.seeAllTxt}>See all transactions</Text>
            <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>

      <WithdrawModal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        coinBalance={wallet.coins ?? 0}
      />
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
  cardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
    flexWrap: 'wrap',
    alignItems: 'stretch',
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
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  withdrawBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
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
    backgroundColor: '#F8FAFC',
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
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  seeAllTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
