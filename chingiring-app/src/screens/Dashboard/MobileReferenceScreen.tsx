import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Gift, Copy, Share2, Users, Coins } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI } from '../../api/wallet';

const SHARE_OPTIONS = [
  { label: 'WhatsApp', color: '#25D366', icon: 'W' },
  { label: 'Telegram', color: '#0088cc', icon: 'T' },
  { label: 'SMS', color: '#1e3a5f', icon: 'S' },
  { label: 'More', color: '#9ca3af', icon: '···' },
];

const STEPS = [
  { num: '01', title: 'Share your referral code', icon: '📤' },
  { num: '02', title: 'They sign up & order', icon: '📱' },
  { num: '03', title: 'You earn ₹50', icon: '🎉' },
];

export const MobileReferenceScreen = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const REFERRAL_CODE = user?.referralCode || 'DEV500';

  const { data: txData } = useQuery({
    queryKey: ['transactions', 'referral'],
    queryFn: () => walletAPI.getTransactions({ type: 'referral', limit: 100 }),
    enabled: isAuthenticated,
  });

  const referralTransactions = txData?.data?.transactions ?? [];
  const referralCount = referralTransactions.length;
  const referralEarned = referralTransactions.reduce(
    (sum: number, tx: any) => sum + (tx.amount || 0), 0,
  );

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── HEADER (blue gradient) ──────────────────── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.headerSmall}>Earn Reward</Text>
              <Text style={s.headerName}>Refer & Earn</Text>
            </View>
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
              style={s.avatar}
            />
          </View>
        </View>

        {/* ── REFERRAL CARD ──────────────────────────── */}
        <View style={s.card}>
          {/* Top row */}
          <View style={s.cardHeader}>
            <View style={s.giftCircle}>
              <Gift size={20} color={Colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.cardTitle}>Refer & Earn</Text>
              <Text style={s.cardSub}>₹50 for every friend who joins</Text>
            </View>
            <TouchableOpacity style={s.freeBadge}>
              <Text style={s.freeTxt}>Free</Text>
            </TouchableOpacity>
          </View>

          {/* Code box */}
          <View style={s.codeBox}>
            <Text style={s.codeLabel}>REFERRAL CODE</Text>
            <View style={s.codeRow}>
              <Text style={s.codeText}>{REFERRAL_CODE}</Text>
              <TouchableOpacity style={s.copyBtn} activeOpacity={0.7}>
                <Copy size={14} color="#fff" strokeWidth={2.5} />
                <Text style={s.copyTxt}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Share icons */}
          <View style={s.shareRow}>
            {SHARE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.label} style={s.shareItem} activeOpacity={0.7}>
                <View style={[s.shareCircle, { backgroundColor: opt.color }]}>
                  <Text style={s.shareIcon}>{opt.icon}</Text>
                </View>
                <Text style={s.shareLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Share button */}
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
            <Share2 size={16} color="#fff" strokeWidth={2.5} />
            <Text style={s.shareBtnTxt}>Share Referral Link</Text>
          </TouchableOpacity>
        </View>

        {/* ── STATS ROW ──────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#eff6ff' }]}>
              <Users size={18} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={s.statVal}>{referralCount}</Text>
            <Text style={s.statLabel}>FRIENDS JOINED</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#ecfdf5' }]}>
              <Coins size={18} color="#10b981" strokeWidth={2} />
            </View>
            <Text style={s.statVal}>₹{referralEarned}</Text>
            <Text style={s.statLabel}>TOTAL EARNINGS</Text>
          </View>
        </View>

        {/* ── HOW IT WORKS ───────────────────────────── */}
        <View style={s.section}>
          <Text style={s.secTitle}>How it works</Text>
          <View style={s.stepsCard}>
            {STEPS.map((step, i) => (
              <View key={step.num} style={[s.stepRow, i < STEPS.length - 1 && s.stepBorder]}>
                <View style={s.stepNum}>
                  <Text style={s.stepNumTxt}>{step.num}</Text>
                </View>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepEmoji}>{step.icon}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── RECENT INVITES ─────────────────────────── */}
        <View style={s.section}>
          <View style={s.invHeader}>
            <Text style={s.secTitle}>Recent Invites</Text>
            <TouchableOpacity>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>👤</Text>
            <Text style={s.emptyTitle}>No invites yet</Text>
            <Text style={s.emptySub}>Start sharing to see activity</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef2f8' },

  // Header — matches MobileWalletScreen blue gradient header
  header: {
    backgroundColor: '#3b82f6',
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    paddingHorizontal: 20,
    paddingTop: 68,
    paddingBottom: 60,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSmall: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 1,
  },
  headerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Referral card — overlaps header
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    marginTop: -32,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  giftCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  cardSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  freeBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },

  // Code box
  codeBox: {
    backgroundColor: '#F5F8FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 14,
    marginBottom: 18,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 3,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  copyTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Share
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
    marginBottom: 18,
  },
  shareItem: {
    alignItems: 'center',
  },
  shareCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  shareIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shareLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
  },
  shareBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  secTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },

  // Steps
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stepBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8ecf2',
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  stepTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  stepEmoji: {
    fontSize: 18,
  },

  // Recent invites
  invHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
