import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { ArrowDownToLine, Clock, X, ChevronRight } from 'lucide-react-native';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { Fonts } from '../../constants/theme';
// expo-camera v17 incompatible with SDK 54 in Expo Go — disabled until version aligned
// import { CameraView, useCameraPermissions } from 'expo-camera';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';
import { ShareToEarnCard } from '../../components/ShareToEarnCard';
import { ShareRewardsSummary } from '../../components/ShareRewardsSummary';

// ─── Data ───────────────────────────────────────────────────────────

const FILTER_TABS = ['All', 'Shares', 'Withdrawals'] as const;
const FILTER_MAP: Record<string, string | undefined> = {
  All: undefined, Shares: 'coin_credit', Withdrawals: 'withdrawal',
};
const COINS_PER_RUPEE = 1000; // mirrors AdminSettings.coinsPerRupee default
// Zero-state wallet used before the API responds — all zeros, never fake
// balances (which masked failures and read as real money).
const EMPTY_WALLET: Wallet = { _id: '', userId: '', confirmedCashback: 0, pendingCashback: 0, coins: 0, pendingCoins: 0, lifetimeEarned: 0 };

function timeAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// User-facing label for a withdrawal's admin-review status.
function wdStatus(status?: string): string {
  return status === 'pending' ? 'Under review'
    : status === 'processing' ? 'Processing'
    : status === 'completed' ? 'Paid'
    : status === 'rejected' ? 'Rejected'
    : (status || '');
}

// Amber = under review, blue = processing, green = paid, red = rejected.
function wdStatusColor(status?: string): { text: string; bg: string } {
  return status === 'pending' ? { text: '#b45309', bg: '#fef3c7' }
    : status === 'processing' ? { text: '#2563eb', bg: '#dbeafe' }
    : status === 'completed' ? { text: '#16a34a', bg: '#dcfce7' }
    : status === 'rejected' ? { text: '#dc2626', bg: '#fee2e2' }
    : { text: '#64748b', bg: '#f1f5f9' };
}

function WithdrawStatusPill({ status }: { status?: string }) {
  const c = wdStatusColor(status);
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 3 }}>
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{wdStatus(status)}</Text>
    </View>
  );
}

function dotColor(t: string) {
  if (t === 'cashback') return '#16a34a';
  if (t === 'withdrawal') return '#ef4444';
  if (t === 'referral') return '#f97316';
  return '#94a3b8';
}

function amtColor(t: string) { return t === 'withdrawal' ? '#ef4444' : '#16a34a'; }
function amtPrefix(t: string) { return t === 'withdrawal' ? '-' : '+'; }

// ─── Withdraw Sheet ─────────────────────────────────────────────────

function WithdrawSheet({ visible, onClose, coinBalance }: { visible: boolean; onClose: () => void; coinBalance: number }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<'UPI' | 'Bank'>('UPI');
  const [payId, setPayId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [coinAmount, setCoinAmount] = useState('');

  // Reset form each time the sheet opens.
  React.useEffect(() => {
    if (!visible) {
      setCoinAmount('');
      setPayId('');
      setAccountNumber('');
      setIfsc('');
      setMethod('UPI');
    }
  }, [visible]);

  // Fetch coinsPerRupee from the wallet backend via a lightweight settings
  // read. For simplicity we hit /api/wallet — it doesn't return the rate,
  // so we default to 10 (matches server default). Live-rate polish can come
  // later via a dedicated /api/config public endpoint.
  const RATE = 1000; // coins per ₹1 — mirrors AdminSettings default (100 coins = 10 paise)

  const coinsNum = Number(coinAmount) || 0;
  const rupees = Math.round((coinsNum / RATE) * 100) / 100;
  const overBalance = coinsNum > coinBalance;
  const belowMin = coinsNum > 0 && rupees < 10; // ₹10 minimum

  const submit = useMutation({
    mutationFn: () => walletAPI.requestWithdrawal({
      coins: coinsNum,
      method,
      paymentDetails: method === 'UPI' ? payId.trim() : accountNumber.trim(),
      ...(method === 'Bank' ? { accountNumber: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() } : {}),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'transactions', 'mobile'] });
      const paidInstant = !!res?.data?.instant;
      const dest = method === 'UPI' ? payId : accountNumber;
      Alert.alert(
        paidInstant ? 'On its way 🎉' : 'Request submitted',
        paidInstant
          ? `${coinsNum} coins → ₹${rupees} is on its way to ${dest}.`
          : `${coinsNum} coins → ₹${rupees} will be sent to ${dest} once approved.`,
        [{ text: 'OK', onPress: onClose }],
      );
    },
    onError: (e: any) => {
      Alert.alert('Failed', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const canSubmit =
    coinsNum > 0
    && !overBalance
    && !belowMin
    && (method === 'UPI' ? payId.trim().length > 0 : accountNumber.trim().length > 0 && ifsc.trim().length > 0)
    && !submit.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ws.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={ws.sheet}>
            <View style={ws.handleBar} />

            <View style={ws.header}>
              <Text style={ws.title}>Withdraw Coins</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color="#64748b" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Coin balance */}
            <View style={ws.balCard}>
              <View>
                <Text style={ws.balLabel}>Available Coins</Text>
                <Text style={ws.balAmt}>{coinBalance.toLocaleString('en-IN')}</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  ≈ ₹{Math.round((coinBalance / RATE) * 100) / 100}
                </Text>
              </View>
              <Text style={ws.balWatermark}>🪙</Text>
            </View>

            {/* Amount in coins */}
            <Text style={ws.secLabel}>Coins to withdraw</Text>
            <TextInput
              style={ws.input}
              placeholder={`Min 100 coins (₹${Math.round(100 / RATE * 100) / 100})`}
              placeholderTextColor="#b0b8c4"
              keyboardType="number-pad"
              value={coinAmount}
              onChangeText={(v) => setCoinAmount(v.replace(/[^0-9]/g, ''))}
            />
            {coinsNum > 0 && (
              <Text style={{ fontSize: 13, marginTop: -12, marginBottom: 14, color: overBalance ? '#ef4444' : belowMin ? '#d97706' : '#16a34a' }}>
                {overBalance
                  ? `Not enough coins — you have ${coinBalance}`
                  : belowMin
                  ? 'Below ₹10 minimum'
                  : `You'll receive ₹${rupees}`}
              </Text>
            )}

            {/* Quick amounts */}
            <View style={ws.quickRow}>
              {[100, 500, 1000].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[ws.chip, q > coinBalance && { opacity: 0.4 }]}
                  onPress={() => q <= coinBalance && setCoinAmount(String(q))}
                  disabled={q > coinBalance}
                >
                  <Text style={ws.chipTxt}>{q} coins</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={ws.chip}
                onPress={() => setCoinAmount(String(coinBalance))}
                disabled={coinBalance <= 0}
              >
                <Text style={ws.chipTxt}>All</Text>
              </TouchableOpacity>
            </View>

            {/* Method */}
            <Text style={ws.secLabel}>Send to</Text>
            <View style={ws.methodRow}>
              {(['UPI', 'Bank'] as const).map((m) => (
                <TouchableOpacity key={m} style={[ws.pill, method === m && ws.pillOn]} onPress={() => setMethod(m)}>
                  <Text style={[ws.pillTxt, method === m && ws.pillTxtOn]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {method === 'UPI' ? (
              <TextInput
                style={ws.input}
                placeholder="UPI ID (e.g., rahul@paytm)"
                placeholderTextColor="#b0b8c4"
                autoCapitalize="none"
                value={payId}
                onChangeText={setPayId}
              />
            ) : (
              <>
                <TextInput
                  style={ws.input}
                  placeholder="Account Number"
                  placeholderTextColor="#b0b8c4"
                  keyboardType="number-pad"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
                <TextInput
                  style={ws.input}
                  placeholder="IFSC Code"
                  placeholderTextColor="#b0b8c4"
                  autoCapitalize="characters"
                  value={ifsc}
                  onChangeText={setIfsc}
                />
              </>
            )}

            <TouchableOpacity
              style={[ws.confirmBtn, !canSubmit && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={() => canSubmit && submit.mutate()}
              disabled={!canSubmit}
            >
              {submit.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={ws.confirmTxt}>Confirm Withdrawal</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const ws = StyleSheet.create({
  // Layout
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },

  // Balance
  balCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  balLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  balAmt: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e293b',
  },
  balWatermark: {
    fontSize: 48,
    fontWeight: '800',
    color: '#e2e8f0',
  },

  // Form
  secLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 10,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  pill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
  },
  pillOn: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  pillTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center'
  },
  pillTxtOn: {

    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 16,
  },

  // Quick amounts
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: Colors.backgroundGrey
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },

  // Confirm
  confirmBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

// QR scan removed (offline-pay is a separate, unlaunched feature).

// ─── Main ───────────────────────────────────────────────────────────

export const MobileWalletScreen = () => {
  const nav = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<string>('All');
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Auto-open the withdraw sheet when navigated here with { openWithdraw: true }
  // (e.g. tapping "Withdraw" on the profile Coins card). Clear the param after so
  // returning and re-navigating re-triggers it.
  const route = useRoute<any>();
  const openWithdrawParam = route.params?.openWithdraw;
  useEffect(() => {
    if (openWithdrawParam) {
      setShowWithdraw(true);
      nav.setParams({ openWithdraw: undefined });
    }
  }, [openWithdrawParam, nav]);

  const { data: wRes, isLoading: wL } = useQuery({ queryKey: ['wallet'], queryFn: () => walletAPI.getWallet() });
  const { data: tRes, isLoading: tL } = useQuery({
    queryKey: ['transactions', filter],
    queryFn: () => walletAPI.getTransactions({ type: FILTER_MAP[filter], limit: 20 }),
  });

  const w: Wallet = wRes?.data?.wallet ?? wRes?.data ?? EMPTY_WALLET;
  const txns: Transaction[] = tRes?.data?.transactions ?? tRes?.data ?? [];
  const shareRewards = (wRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };

  if (wL) return <View style={[m.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <View style={m.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── HEADER (shared gradient header) ───────────────────────────────
            Uses the same MobileAuthHeader as every other mobile screen.
            Baseline height already leaves room for the balance card's
            -20 marginTop overlap, so no extraBottomSpace needed. */}
        <MobileAuthHeader
          hideBack
          kicker="WALLET"
          title={user?.name || 'Guest'}
          align="left"
          rightSlot={
            <View style={m.headerAvatar}>
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={m.headerAvatarImg}
                  resizeMode="cover"
                />
              ) : (
                <Text style={m.headerAvatarInitials}>
                  {(user?.name?.[0] ?? 'U').toUpperCase()}
                </Text>
              )}
            </View>
          }
        />
        {/* Balance card */}
        <View style={m.balCard}>
          <Text style={m.balLabel}>Coin Balance</Text>
          <Text style={[m.balAmt, { marginBottom: 4 }]}>{(w.coins ?? 0).toLocaleString('en-IN')}</Text>
          <Text style={m.balSub}>{'≈ ₹'}{Math.floor((w.coins ?? 0) / COINS_PER_RUPEE).toLocaleString('en-IN')}{' available to withdraw'}</Text>

          {/* Withdraw (full-width) */}
          <View style={m.btnRow}>
            <TouchableOpacity style={m.withdrawBtn} onPress={() => setShowWithdraw(true)}>
              <ArrowDownToLine size={15} color="#fff" strokeWidth={2.5} />
              <Text style={m.withdrawTxt}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          {/* Txn History link */}
          <TouchableOpacity style={m.historyRow} onPress={() => nav.navigate('TransactionHistory')}>
            <Clock size={14} color="#3b82f6" strokeWidth={2} />
            <Text style={m.historyTxt}>Transaction History</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <ShareRewardsSummary pending={shareRewards.pending} confirmed={shareRewards.confirmed} />
        </View>

        {/* Earn coins by sharing — the daily earning loop */}
        <View style={m.shareWrap}>
          <ShareToEarnCard />
        </View>

        {/* ── ACTIVITY ────────────────────────────────── */}
        <View style={m.activity}>
          <Text style={m.actTitle}>Activity</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {FILTER_TABS.map((t) => (
              <TouchableOpacity key={t} style={[m.fPill, filter === t && m.fPillOn]} onPress={() => setFilter(t)}>
                <Text style={[m.fTxt, filter === t && m.fTxtOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {tL ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
          ) : txns.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingVertical: 24 }}>
              No transactions yet.
            </Text>
          ) : txns.slice(0, 6).map((tx) => (
            <TouchableOpacity key={tx._id} style={m.txRow} activeOpacity={0.7}>
              <View style={[m.txDot, { backgroundColor: dotColor(tx.type) }]} />
              <View style={m.txInfo}>
                <Text style={m.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={m.txTime}>{timeAgo(tx.createdAt)}</Text>
                {tx.type === 'withdrawal' ? <WithdrawStatusPill status={tx.status} /> : null}
              </View>
              <Text style={[m.txAmt, { color: amtColor(tx.type) }]}>{amtPrefix(tx.type)}{(tx.type === 'coin_credit' || tx.type === 'coin_debit') ? tx.amount + ' coins' : '₹' + tx.amount}</Text>
              <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
            </TouchableOpacity>
          ))}
          {txns.length > 0 && (
            <TouchableOpacity style={m.seeAllBtn} onPress={() => nav.navigate('TransactionHistory')} activeOpacity={0.8}>
              <Text style={m.seeAllTxt}>See all transactions</Text>
              <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      <WithdrawSheet visible={showWithdraw} onClose={() => setShowWithdraw(false)} coinBalance={w.coins ?? 0} />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header avatar (rendered inside MobileAuthHeader's rightSlot)
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerAvatarImg: { width: '100%', height: '100%' },
  headerAvatarInitials: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },

  // Balance card
  balCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
    marginTop: -20,
    width: '90%',
    alignSelf: "center"
  },
  balLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 2, zIndex: 1 },
  balAmt: { fontSize: 40, fontWeight: '800', color: '#1e293b', marginBottom: 20, zIndex: 1 },
  balSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 18, zIndex: 1 },
  // buttons
  btnRow: { flexDirection: 'row', gap: 2, marginBottom: 14, zIndex: 1, width: "100%", justifyContent: 'space-evenly' },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: '#3b82f6', borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 11,
    backgroundColor: Colors.primary,
    flexGrow: 1,
  },
  withdrawTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6, zIndex: 1,
    backgroundColor: Colors.primaryLight10,
    paddingVertical: 14,
    borderRadius: 12
  },
  historyTxt: { textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#3b82f6', textDecorationStyle: 'dashed' },

  // Share-to-earn wrapper
  shareWrap: { paddingHorizontal: 20, marginTop: 16, marginBottom: 4 },

  // Activity
  activity: { paddingHorizontal: 20 },
  actTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  fPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: Colors.surface },
  fPillOn: { backgroundColor: '#3b82f6' },
  fTxt: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  fTxtOn: { color: '#fff', fontWeight: '700' },

  // Transactions
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8ecf2',
  },
  txDot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  txTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  txAmt: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, marginTop: 4,
  },
  seeAllTxt: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
