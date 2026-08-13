import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Modal, TextInput, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Wallet as WalletIcon, TrendingUp, ArrowDownToLine, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';
import { ShareToEarnCard } from '../../components/ShareToEarnCard';
import { PendingRewardCard } from '../../components/PendingRewardCard';
import { WithdrawalPendingCard } from '../../components/WithdrawalPendingCard';
import { TransactionRow } from '../../components/TransactionRow';

// Coins→₹ conversion. Mirrors AdminSettings.coinsPerRupee default (1000);
// 100 coins = 10 paise. The exact rate is re-locked server-side at request time.
const COINS_PER_RUPEE = 1000;
const MIN_WITHDRAW_RUPEES = 100;
const QUICK_AMOUNTS = [100, 500, 1000];
type WithdrawMethod = 'UPI' | 'Bank' | 'Paytm';

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

// react-native-web's Alert is a no-op, and this screen is web-first — route
// through window.alert there so the user actually sees the message.
function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// ─── Withdraw Funds overlay (Figma node 64:1451) ─────────────────────────────
function WithdrawFundsModal({ visible, onClose, coinBalance }: {
  visible: boolean;
  onClose: () => void;
  coinBalance: number;
}) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<WithdrawMethod>('UPI');
  const [details, setDetails] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [amount, setAmount] = useState('');

  // Withdrawal is coin-based server-side; the UI is ₹ per the design. Convert
  // the ₹ ceiling from the withdrawable coin balance, and the entered ₹ back
  // to coins when submitting.
  const availableRupees = Math.floor(coinBalance / COINS_PER_RUPEE);
  const amountNum = Number(amount) || 0;
  const coinsToRedeem = Math.round(amountNum * COINS_PER_RUPEE);
  const overBalance = amountNum > availableRupees;
  const belowMin = amountNum > 0 && amountNum < MIN_WITHDRAW_RUPEES;

  const detailsLabel =
    method === 'UPI' ? 'Enter UPI ID'
    : method === 'Paytm' ? 'Enter Paytm number'
    : 'Account number';

  const mutation = useMutation({
    mutationFn: () => walletAPI.requestWithdrawal({
      coins: coinsToRedeem,
      method: method === 'Bank' ? 'Bank' : 'UPI', // Paytm rides the UPI rail
      paymentDetails: details.trim(),
      ...(method === 'Bank' ? { accountNumber: details.trim(), ifsc: ifsc.trim() } : {}),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['walletSummary'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      const paidInstant = !!res?.data?.instant;
      const dest = method === 'Bank' ? 'bank account' : method === 'Paytm' ? 'Paytm' : 'UPI';
      setAmount(''); setDetails(''); setIfsc('');
      onClose();
      notify(
        paidInstant ? 'On its way 🎉' : 'Request submitted',
        paidInstant
          ? `₹${amountNum.toLocaleString('en-IN')} is on its way to your ${dest}.`
          : `Your ₹${amountNum.toLocaleString('en-IN')} withdrawal is pending approval.`,
      );
    },
    onError: (e: any) => notify('Withdrawal failed', e?.response?.data?.message || e?.message || 'Please try again.'),
  });

  const canSubmit =
    amountNum >= MIN_WITHDRAW_RUPEES &&
    !overBalance &&
    details.trim().length > 0 &&
    (method !== 'Bank' || ifsc.trim().length > 0) &&
    !mutation.isPending;

  const handleConfirm = () => {
    if (!details.trim()) { notify('Missing details', `Enter your ${detailsLabel.toLowerCase()}.`); return; }
    if (method === 'Bank' && !ifsc.trim()) { notify('Missing IFSC', 'Enter the bank IFSC code.'); return; }
    if (amountNum < MIN_WITHDRAW_RUPEES) { notify('Amount too low', `Minimum withdrawal is ₹${MIN_WITHDRAW_RUPEES}.`); return; }
    if (overBalance) { notify('Insufficient balance', `You can withdraw up to ₹${availableRupees}.`); return; }
    mutation.mutate();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          <View style={m.header}>
            <Text style={m.title}>Withdraw Funds</Text>
            <TouchableOpacity style={m.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={16} color="#64748b" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={m.availCard}>
            <View>
              <Text style={m.availLabel}>Available</Text>
              <Text style={m.availAmount}>₹{availableRupees.toLocaleString('en-IN')}</Text>
              <Text style={m.availSub}>{coinBalance.toLocaleString('en-IN')} coins</Text>
            </View>
            <CheckCircle2 size={22} color="#16a34a" strokeWidth={2} />
          </View>

          <Text style={m.sectionLabel}>WITHDRAW TO</Text>
          <View style={m.segment}>
            {(['UPI', 'Bank', 'Paytm'] as WithdrawMethod[]).map((opt) => {
              const active = method === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[m.segBtn, active && m.segBtnActive]}
                  onPress={() => setMethod(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[m.segTxt, active && m.segTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={m.input}
            value={details}
            onChangeText={setDetails}
            placeholder={detailsLabel}
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
          {method === 'Bank' && (
            <TextInput
              style={[m.input, { marginTop: 10 }]}
              value={ifsc}
              onChangeText={setIfsc}
              placeholder="IFSC code"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
            />
          )}

          <Text style={m.sectionLabel}>AMOUNT</Text>
          <TextInput
            style={m.input}
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            placeholder={`Minimum ₹${MIN_WITHDRAW_RUPEES}`}
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />
          <View style={m.chipRow}>
            {QUICK_AMOUNTS.map((amt) => {
              const disabled = amt > availableRupees;
              return (
                <TouchableOpacity
                  key={amt}
                  style={[m.chip, disabled && m.chipDisabled]}
                  disabled={disabled}
                  onPress={() => setAmount(String(amt))}
                  activeOpacity={0.8}
                >
                  <Text style={[m.chipTxt, disabled && m.chipTxtDisabled]}>₹{amt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(belowMin || overBalance) && (
            <Text style={m.errTxt}>
              {overBalance ? `You can withdraw up to ₹${availableRupees}.` : `Minimum withdrawal is ₹${MIN_WITHDRAW_RUPEES}.`}
            </Text>
          )}

          <TouchableOpacity
            style={[m.confirmBtn, !canSubmit && m.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {mutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={m.confirmTxt}>Confirm Withdrawal</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 20px 50px rgba(0,0,0,0.25)' } as any) : {
      shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 20 }, shadowRadius: 40, elevation: 12,
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  availCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 18,
  },
  availLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' },
  availAmount: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  availSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },

  segment: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segBtn: {
    flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
  },
  segBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  segTxt: { fontSize: 13, fontWeight: '600', color: '#334155' },
  segTxtActive: { color: '#3b82f6', fontWeight: '700' },

  input: {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14, fontSize: 14, color: '#0f172a', backgroundColor: '#ffffff',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
  },
  chipDisabled: { opacity: 0.4 },
  chipTxt: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipTxtDisabled: { color: '#94a3b8' },

  errTxt: { fontSize: 12, color: '#dc2626', fontWeight: '600', marginTop: 8 },

  confirmBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#4784E2',
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});

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

      <WithdrawFundsModal
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
