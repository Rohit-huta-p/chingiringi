import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { ArrowDownToLine, Clock, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts } from '../../constants/theme';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';
import { ShareToEarnCard } from '../../components/ShareToEarnCard';
import { PendingRewardCard } from '../../components/PendingRewardCard';
import { WithdrawalPendingCard } from '../../components/WithdrawalPendingCard';
import { WithdrawModal } from '../../components/WithdrawModal';
import { TransactionRow } from '../../components/TransactionRow';

// ─── Data ───────────────────────────────────────────────────────────

const FILTER_TABS = ['All', 'Shares', 'Withdrawals'] as const;
const FILTER_MAP: Record<string, string | undefined> = {
  All: undefined, Shares: 'coin_credit', Withdrawals: 'withdrawal',
};
const COINS_PER_RUPEE = 1000; // mirrors AdminSettings.coinsPerRupee default
// Zero-state wallet used before the API responds — all zeros, never fake
// balances (which masked failures and read as real money).
const EMPTY_WALLET: Wallet = { _id: '', userId: '', confirmedCashback: 0, pendingCashback: 0, coins: 0, pendingCoins: 0, lifetimeEarned: 0 };

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
  const pendingWithdrawals = (wRes as any)?.data?.pendingWithdrawals ?? { total: 0, count: 0 };

  if (wL) return <View style={[m.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <View style={m.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── BLUE BALANCE HERO — the mockup’s balance card; replaces the
            shared gradient header on the wallet tab only. ─────── */}
        <LinearGradient
          colors={['#4784E2', '#2D6BC9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={m.hero}
        >
          <View pointerEvents="none" style={[m.heroGlob, m.heroGlobTR]} />
          <View pointerEvents="none" style={[m.heroGlob, m.heroGlobBL]} />
          <SafeAreaView edges={['top']} style={m.heroInner}>
            <View style={m.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={m.heroKicker}>WALLET</Text>
                <Text style={m.heroName} numberOfLines={1}>{user?.name || 'Guest'}</Text>
              </View>
              <View style={m.headerAvatar}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={m.headerAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={m.headerAvatarInitials}>{(user?.name?.[0] ?? 'U').toUpperCase()}</Text>
                )}
              </View>
            </View>

            <Text style={m.heroLabel}>Coin Balance</Text>
            <Text style={m.heroAmt}>{(w.coins ?? 0).toLocaleString('en-IN')}</Text>
            <Text style={m.heroSub}>{'≈ ₹'}{Math.floor((w.coins ?? 0) / COINS_PER_RUPEE).toLocaleString('en-IN')}{' · available to withdraw'}</Text>

            <TouchableOpacity style={m.heroWithdraw} onPress={() => setShowWithdraw(true)} activeOpacity={0.9}>
              <ArrowDownToLine size={16} color="#2563eb" strokeWidth={2.6} />
              <Text style={m.heroWithdrawTxt}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity style={m.heroHistory} onPress={() => nav.navigate('TransactionHistory')} activeOpacity={0.85}>
              <Clock size={14} color="#fff" strokeWidth={2} />
              <Text style={m.heroHistoryTxt}>Transaction History</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20 }}>
          <WithdrawalPendingCard total={pendingWithdrawals.total} count={pendingWithdrawals.count} />
          <PendingRewardCard pending={shareRewards.pending} confirmed={shareRewards.confirmed} />
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
            <TransactionRow key={tx._id} tx={tx} onPress={() => {}} />
          ))}
          {txns.length > 0 && (
            <TouchableOpacity style={m.seeAllBtn} onPress={() => nav.navigate('TransactionHistory')} activeOpacity={0.8}>
              <Text style={m.seeAllTxt}>See all transactions</Text>
              <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      <WithdrawModal visible={showWithdraw} onClose={() => setShowWithdraw(false)} coinBalance={w.coins ?? 0} />
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

  // Blue balance hero — replaces the shared gradient header on the wallet tab
  // so the balance reads as the mockup's blue card. Other screens keep MobileAuthHeader.
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 22px rgba(37,99,235,0.28)' } as any)
      : { shadowColor: '#2563eb', shadowOpacity: 0.28, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 8 }),
  },
  heroInner: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 22 },
  heroGlob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroGlobTR: { top: -70, right: -55 },
  heroGlobBL: { bottom: -85, left: -55 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heroKicker: { fontSize: 10, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  heroName: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.2 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  heroAmt: { fontSize: 40, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 18 },
  heroWithdraw: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12 },
  heroWithdrawTxt: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  heroHistory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroHistoryTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Share-to-earn wrapper
  shareWrap: { paddingHorizontal: 20, marginTop: 16, marginBottom: 4 },

  // Activity
  activity: { paddingHorizontal: 20 },
  actTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  fPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: Colors.surface },
  fPillOn: { backgroundColor: '#0f172a' },
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
