import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';

const FILTER_TABS = ['All', 'Cashback', 'Coins', 'Withdrawals'];

const TRANSACTIONS = [
  { id: '1', brand: 'Myntra', timeAgo: '2 days ago', amount: 150, type: 'income' as const },
  { id: '2', brand: 'Amazon', timeAgo: '15 days ago', amount: 300, type: 'income' as const },
  { id: '3', brand: 'Withdrawal to UPI', timeAgo: '20 days ago', amount: 500, type: 'withdrawal' as const },
  { id: '4', brand: 'Referral bonus (User: RAHUL99)', timeAgo: '5 days ago', amount: 50, type: 'income' as const },
  { id: '5', brand: 'QR Scan Reward', timeAgo: '1 day ago', amount: 100, type: 'income' as const },
];

export const WalletScreen = () => {
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.overviewLabel}>OVERVIEW</Text>
          <Text style={styles.headerTitle}>My Wallet</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.userInfo}>
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
      <View style={styles.cardsRow}>
        {/* Confirmed Balance Card */}
        <View style={styles.confirmedCard}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIconText}>{'💳'}</Text>
          </View>
          <Text style={styles.confirmedLabel}>Confirmed Balance</Text>
          <Text style={styles.confirmedAmount}>{'\u20B9'}1250</Text>
          <Text style={styles.confirmedSubText}>Available to withdraw</Text>
          <TouchableOpacity style={styles.withdrawBtn}>
            <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Card */}
        <View style={styles.balanceCard}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIconText}>{'🕐'}</Text>
          </View>
          <Text style={styles.cardLabel}>Pending</Text>
          <Text style={styles.cardAmount}>{'\u20B9'}450</Text>
          <Text style={styles.cardSubText}>In lock period</Text>
        </View>

        {/* Coins Card */}
        <View style={styles.balanceCard}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIconText}>{'🪙'}</Text>
          </View>
          <Text style={styles.cardLabel}>Coins</Text>
          <Text style={styles.cardAmount}>840</Text>
          <Text style={styles.cardSubText}>Reward points</Text>
        </View>
      </View>

      {/* Total Earned Row */}
      <View style={styles.totalEarnedRow}>
        <View style={styles.totalEarnedLeft}>
          <Text style={styles.trendIcon}>{'📈'}</Text>
          <Text style={styles.totalEarnedLabel}>Total Earned (Lifetime)</Text>
          <Text style={styles.totalEarnedAmount}>{'\u20B9'}1700</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.allTimeLink}>All time {'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction History */}
      <View style={styles.transactionSection}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionTitle}>Transaction History</Text>
          <View style={styles.filterRow}>
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
          </View>
        </View>

        {/* Transaction List */}
        {TRANSACTIONS.map((tx) => (
          <View key={tx.id} style={styles.transactionItem}>
            <View style={[
              styles.txIconContainer,
              { backgroundColor: tx.type === 'income' ? '#ecfdf5' : '#fef2f2' },
            ]}>
              <Text style={styles.txIcon}>
                {tx.type === 'income' ? '↓' : '↑'}
              </Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txBrand}>{tx.brand}</Text>
              <Text style={styles.txTime}>{tx.timeAgo}</Text>
            </View>
            <View style={styles.txAmountContainer}>
              <Text style={[
                styles.txAmount,
                { color: tx.type === 'income' ? Colors.success : Colors.danger },
              ]}>
                {tx.type === 'income' ? '+' : '-'}{'\u20B9'}{tx.amount}
              </Text>
              <Text style={styles.txChevron}>{'›'}</Text>
            </View>
          </View>
        ))}
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
    padding: 32,
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
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  confirmedCard: {
    flex: 1,
    minWidth: 240,
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#3b82f6',
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
    marginBottom: 32,
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
});
