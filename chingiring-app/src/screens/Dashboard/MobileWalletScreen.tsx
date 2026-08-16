import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { ArrowDownToLine, Clock, ChevronRight, ArrowUpRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Fonts } from '../../constants/theme';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI, Wallet, Transaction } from '../../api/wallet';
import { ShareToEarnCard } from '../../components/ShareToEarnCard';
import { WithdrawModal } from '../../components/WithdrawModal';
import { TransactionRow } from '../../components/TransactionRow';

// ─── Data ───────────────────────────────────────────────────────────

const FILTER_TABS = ['All', 'Shares', 'Withdrawals'] as const;
const FILTER_MAP: Record<string, string | undefined> = {
  All: undefined, Shares: 'coin_credit', Withdrawals: 'withdrawal',
};
const COINS_PER_RUPEE = 1000;
// ponytail: streak hardcoded, add /api/wallet/streak endpoint when ready
const STREAK_DAYS = 4;
// ponytail: payout goal is a static milestone, make dynamic if needed
const PAYOUT_GOAL = 300; // ₹

const RING_R = 26;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 163.4

const EMPTY_WALLET: Wallet = {
  _id: '', userId: '', confirmedCashback: 0, pendingCashback: 0,
  coins: 0, pendingCoins: 0, lifetimeEarned: 0,
};

export const MobileWalletScreen = () => {
  const nav = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<string>('All');
  const [showWithdraw, setShowWithdraw] = useState(false);

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

  const rupees = Math.floor((w.coins ?? 0) / COINS_PER_RUPEE);
  const goalPct = Math.min(100, (rupees / PAYOUT_GOAL) * 100);
  const toGoal = Math.max(0, PAYOUT_GOAL - rupees);
  const ringOffset = RING_CIRC * (1 - Math.min(STREAK_DAYS / 7, 1));
  const firstName = user?.name?.split(' ')[0] || 'there';
  const hasPending = pendingWithdrawals.count > 0 || shareRewards.pending > 0;

  if (wL) {
    return (
      <View style={[m.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2F6BFF" />
      </View>
    );
  }

  return (
    <View style={m.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── COBALT HERO ───────────────────────────────────────────── */}
        <LinearGradient
          colors={['#2F6BFF', '#1E3FC0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={m.hero}
        >
          {/* decorative blobs */}
          <View pointerEvents="none" style={[m.blob, m.blobTR]} />
          <View pointerEvents="none" style={[m.blob, m.blobBL]} />

          <SafeAreaView edges={['top']} style={m.heroInner}>
            {/* greeting + streak pill */}
            <View style={m.heroTop}>
              <Text style={m.greeting}>Hi, {firstName} 👋</Text>
              <View style={m.streakPill}>
                <Text style={m.streakFire}>🔥</Text>
                <Text style={m.streakTxt}>{STREAK_DAYS}-day streak</Text>
              </View>
            </View>

            {/* balance + ring */}
            <View style={m.heroMid}>
              <View style={{ flex: 1 }}>
                <Text style={m.heroLabel}>Coin Balance</Text>
                <Text style={m.heroAmt}>{(w.coins ?? 0).toLocaleString('en-IN')}</Text>
                <Text style={m.heroSub}>{'≈ ₹'}{rupees.toLocaleString('en-IN')}{' to withdraw'}</Text>
              </View>

              {/* streak ring */}
              <View style={m.ringWrap}>
                <Svg width={64} height={64} style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle
                    cx={32} cy={32} r={RING_R}
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={7}
                  />
                  <Circle
                    cx={32} cy={32} r={RING_R}
                    fill="none"
                    stroke="#FBBF24"
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={ringOffset}
                  />
                </Svg>
                <View style={m.ringLabel} pointerEvents="none">
                  <Text style={m.ringNum}>{STREAK_DAYS}</Text>
                  <Text style={m.ringDay}>DAYS</Text>
                </View>
              </View>
            </View>

            {/* withdraw */}
            <TouchableOpacity style={m.heroWithdraw} onPress={() => setShowWithdraw(true)} activeOpacity={0.9}>
              <ArrowDownToLine size={16} color="#1E3FC0" strokeWidth={2.6} />
              <Text style={m.heroWithdrawTxt}>Withdraw</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </LinearGradient>

        {/* ── GOAL BAR ─────────────────────────────────────────────── */}
        <View style={m.goalCard}>
          <View style={m.goalRow}>
            <Text style={m.goalMain}>
              {toGoal > 0
                ? `₹${toGoal.toLocaleString('en-IN')} to your next payout`
                : 'Payout milestone reached 🎉'}
            </Text>
            <Text style={m.goalSub}>₹{rupees} / ₹{PAYOUT_GOAL}</Text>
          </View>
          <View style={m.gbar}>
            <View style={[m.gfill, { width: `${goalPct}%` as any }]} />
          </View>
        </View>

        {/* ── SHARE TO EARN (promoted as featured card) ─────────── */}
        <View style={m.shareWrap}>
          <ShareToEarnCard />
        </View>

        {/* ── PENDING TWIN CHIPS ───────────────────────────────────── */}
        {hasPending && (
          <View style={m.pendGrid}>
            {shareRewards.pending > 0 && (
              <View style={[m.pchip, { flex: 1 }]}>
                <View style={[m.picon, { backgroundColor: '#DCFCE7' }]}>
                  <Clock size={15} color="#12A150" strokeWidth={2.4} />
                </View>
                <Text style={m.plabel}>REWARDS IN</Text>
                <Text style={m.pval}>{shareRewards.pending.toLocaleString('en-IN')}</Text>
                <Text style={m.psub}>CR confirming</Text>
              </View>
            )}
            {pendingWithdrawals.count > 0 && (
              <View style={[m.pchip, { flex: 1 }]}>
                <View style={[m.picon, { backgroundColor: '#FFF3D6' }]}>
                  <ArrowUpRight size={15} color="#B4770B" strokeWidth={2.4} />
                </View>
                <Text style={m.plabel}>UNDER REVIEW</Text>
                <Text style={m.pval}>
                  {'₹'}{(pendingWithdrawals.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={m.psub}>{pendingWithdrawals.count} withdrawal{pendingWithdrawals.count > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── ACTIVITY ─────────────────────────────────────────────── */}
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
            <ActivityIndicator color="#2F6BFF" style={{ marginTop: 20 }} />
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
  root: { flex: 1, backgroundColor: '#FBF8F2' },

  // Hero
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(30,63,192,.32)' } as any)
      : { shadowColor: '#1E3FC0', shadowOpacity: 0.32, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 10 }),
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  blobTR: { width: 200, height: 200, top: -70, right: -50 },
  blobBL: { width: 160, height: 160, bottom: -80, left: -40, backgroundColor: 'rgba(251,191,36,0.14)' },
  heroInner: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24 },

  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  greeting: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#fff', letterSpacing: -.01 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  streakFire: { fontSize: 14 },
  streakTxt: { fontSize: 12.5, fontFamily: Fonts.bold, color: '#fff' },

  heroMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  heroAmt: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -.02, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  ringWrap: { position: 'relative', width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff', lineHeight: 18 },
  ringDay: { fontSize: 8, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: .06 },

  heroWithdraw: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
  },
  heroWithdrawTxt: { fontSize: 15, fontFamily: Fonts.extraBold, color: '#1E3FC0' },

  // Goal bar
  goalCard: {
    marginHorizontal: 20, marginTop: 18,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#EAE7E0',
  },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  goalMain: { fontSize: 14, fontFamily: Fonts.bold, color: '#15171C', flex: 1 },
  goalSub: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#71757E', marginLeft: 8 },
  gbar: { height: 9, borderRadius: 5, backgroundColor: '#F0ECE3', overflow: 'hidden' },
  gfill: { height: '100%', borderRadius: 5, backgroundColor: '#FBBF24' },

  // Share to earn
  shareWrap: { paddingHorizontal: 20, marginTop: 16 },

  // Pending twin chips
  pendGrid: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 20, marginTop: 12,
  },
  pchip: {
    backgroundColor: '#fff', borderRadius: 16, padding: 13,
    borderWidth: 1, borderColor: '#EAE7E0',
  },
  picon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  plabel: { fontSize: 10, fontFamily: Fonts.extraBold, color: '#9A9CA6', letterSpacing: .08, textTransform: 'uppercase' },
  pval: { fontSize: 19, fontFamily: Fonts.extraBold, marginTop: 1, color: '#15171C', fontVariant: ['tabular-nums'] },
  psub: { fontSize: 11.5, color: '#71757E', marginTop: 1 },

  // Activity
  activity: { paddingHorizontal: 20, marginTop: 20 },
  actTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#1e293b', marginBottom: 14 },
  fPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE7E0' },
  fPillOn: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  fTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#94a3b8' },
  fTxtOn: { color: '#fff', fontFamily: Fonts.bold },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, marginTop: 4,
  },
  seeAllTxt: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary },
});
