import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';

const TRANSACTION_TYPES = ['All', 'Cashback', 'Withdrawal', 'Coins', 'Referral'];
const TIME_PERIODS = ['All Time', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'];

const TRANSACTIONS = [
  {
    id: '1',
    brand: 'Myntra',
    category: 'Cashback',
    timeAgo: '2 days ago',
    purchaseAmount: 1250,
    cashbackAmount: 150,
    date: '15 Mar 2026',
    status: 'pending' as const,
    type: 'income' as const,
  },
  {
    id: '2',
    brand: 'Amazon',
    category: 'Cashback',
    timeAgo: '15 days ago',
    purchaseAmount: 6000,
    cashbackAmount: 300,
    date: '02 Mar 2026',
    status: 'confirmed' as const,
    type: 'income' as const,
  },
];

export const TransactionHistoryScreen = () => {
  const navigation = useNavigation();
  const [activeType, setActiveType] = useState('Cashback');
  const [activePeriod, setActivePeriod] = useState('All Time');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>{'<-'}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.accountLabel}>ACCOUNT</Text>
            <Text style={styles.headerTitle}>Transaction History</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      <View style={styles.filtersSection}>
        <View style={styles.filtersHeader}>
          <Text style={styles.filtersIcon}>{'🔽'}</Text>
          <Text style={styles.filtersLabel}>Filters</Text>
        </View>

        {/* Transaction Type */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>TRANSACTION TYPE</Text>
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
        </View>

        {/* Time Period */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>TIME PERIOD</Text>
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
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Net Amount ({TRANSACTIONS.length} transactions)</Text>
        <Text style={styles.summaryAmount}>{'\u20B9'}450</Text>
      </View>

      {/* Transaction List */}
      <View style={styles.transactionList}>
        {TRANSACTIONS.map((tx) => (
          <View key={tx.id} style={styles.transactionItem}>
            <View style={styles.txRow}>
              <View style={[
                styles.txIconContainer,
                { backgroundColor: tx.type === 'income' ? '#ecfdf5' : '#fef2f2' },
              ]}>
                <Text style={[
                  styles.txIcon,
                  { color: tx.type === 'income' ? Colors.success : Colors.danger },
                ]}>
                  {tx.type === 'income' ? '↓' : '↑'}
                </Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txBrand}>{tx.brand}</Text>
                <Text style={styles.txMeta}>
                  {tx.category} {' \u00B7 '} {'🕐'} {tx.timeAgo}
                </Text>
                <Text style={styles.txPurchase}>Purchase of {tx.purchaseAmount}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[
                  styles.txAmount,
                  { color: tx.type === 'income' ? Colors.success : Colors.danger },
                ]}>
                  {tx.type === 'income' ? '+' : '-'}{'\u20B9'}{tx.cashbackAmount}
                </Text>
                <Text style={styles.txDate}>{tx.date}</Text>
                <View style={[
                  styles.statusBadge,
                  tx.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending,
                ]}>
                  <Text style={[
                    styles.statusText,
                    tx.status === 'confirmed' ? styles.statusTextConfirmed : styles.statusTextPending,
                  ]}>
                    {tx.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                  </Text>
                </View>
              </View>
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
});
