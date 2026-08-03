import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Gift, Copy, Sparkles, Users, ArrowRight, UserPlus,
  Share2, MessageCircle, Send, MoreHorizontal, MessageSquare,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI } from '../../api/wallet';

// ─── Static config ──────────────────────────────────────────────────────────

const SHARE_OPTIONS: Array<{
  label: string;
  bg: string;
  icon: React.ComponentType<any>;
}> = [
  { label: 'WhatsApp', bg: '#22c55e', icon: MessageCircle },
  { label: 'Telegram', bg: '#3b82f6', icon: Send },
  { label: 'SMS',      bg: '#3b82f6', icon: MessageSquare },
  { label: 'More',     bg: '#94a3b8', icon: MoreHorizontal },
];

const STEPS = [
  {
    num: '01',
    title: 'Share your code',
    sub: 'Send your unique referral link to friends',
    icon: Share2,
    iconBg: '#eff6ff',
    iconColor: '#3b82f6',
  },
  {
    num: '02',
    title: 'They sign up',
    sub: 'Friend registers and places their first order',
    icon: UserPlus,
    iconBg: '#faf5ff',
    iconColor: '#a855f7',
  },
  {
    num: '03',
    title: 'You earn ₹50',
    sub: 'Cashback credited to your wallet instantly',
    icon: Gift,
    iconBg: '#ecfdf5',
    iconColor: '#16a34a',
  },
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export const ReferScreen = () => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 1100; // collapse to single column under this

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const REFERRAL_CODE = user?.referralCode || 'DEV500';

  const { data: txData } = useQuery({
    queryKey: ['transactions', 'referral'],
    queryFn: () => walletAPI.getTransactions({ type: 'referral', limit: 100 }),
    enabled: isAuthenticated,
  });

  const referralTransactions: any[] = txData?.data?.transactions ?? [];
  const referralCount = referralTransactions.length;
  const referralEarned = referralTransactions.reduce(
    (sum: number, tx: any) => sum + (tx.amount || 0),
    0,
  );

  const handleCopy = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(REFERRAL_CODE);
    }
    Alert.alert('Copied', `${REFERRAL_CODE} copied to clipboard`);
  };

  const handleShare = (label?: string) => {
    Alert.alert('Share', label ? `Share via ${label}` : 'Share Referral Link');
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.rootContent}>
      {/* ── Top header ────────────────────────────────── */}
      <View style={s.topHeader}>
        <View>
          <Text style={s.eyebrow}>GROW TOGETHER</Text>
          <Text style={s.pageTitle}>Refer & Earn</Text>
        </View>
        <View style={s.topRight}>
          <View style={s.earnedPill}>
            <Sparkles size={14} color={Colors.primary} strokeWidth={2.2} />
            <Text style={s.earnedPillText}>₹{referralEarned} earned</Text>
          </View>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
            style={s.avatar}
          />
        </View>
      </View>

      {/* ── Two-column body ───────────────────────────── */}
      <View style={[s.body, isNarrow && s.bodyStacked]}>

        {/* ─── LEFT COLUMN ──────────────────────────── */}
        <View style={[s.colLeft, isNarrow && { flex: undefined as any, width: '100%' }]}>

          {/* Referral code card */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Your Referral Code</Text>
                <Text style={s.cardSub}>Share this code and earn ₹50 per friend</Text>
              </View>
              <View style={s.giftCircleSm}>
                <Gift size={18} color={Colors.primary} strokeWidth={2} />
              </View>
            </View>

            {/* Code box */}
            <View style={s.codeBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.codeLabel}>REFERRAL CODE</Text>
                <Text style={s.codeText}>{REFERRAL_CODE}</Text>
              </View>
              <TouchableOpacity style={s.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
                <Copy size={14} color={Colors.primary} strokeWidth={2.2} />
                <Text style={s.copyBtnText}>Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Share via */}
            <Text style={s.shareLabel}>SHARE VIA</Text>
            <View style={s.shareRow}>
              {SHARE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={s.shareItem}
                    activeOpacity={0.8}
                    onPress={() => handleShare(opt.label)}
                  >
                    <View style={[s.shareCircle, { backgroundColor: opt.bg }]}>
                      <Icon size={18} color="#fff" strokeWidth={2.2} />
                    </View>
                    <Text style={s.shareItemLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Big share button */}
            <TouchableOpacity
              style={s.shareBtn}
              activeOpacity={0.88}
              onPress={() => handleShare()}
            >
              <Share2 size={16} color="#fff" strokeWidth={2.2} />
              <Text style={s.shareBtnText}>Share Referral Link</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: '#faf5ff' }]}>
                <Users size={18} color="#a855f7" strokeWidth={2.2} />
              </View>
              <Text style={s.statRightLabel}>Total</Text>
              <Text style={s.statValue}>{referralCount || 0}</Text>
              <Text style={s.statSubLabel}>Friends joined</Text>
            </View>

            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: '#ecfdf5' }]}>
                <Gift size={18} color="#16a34a" strokeWidth={2.2} />
              </View>
              <Text style={s.statRightLabel}>Earned</Text>
              <Text style={s.statValue}>₹{referralEarned}</Text>
              <Text style={s.statSubLabel}>From referrals</Text>
            </View>
          </View>
        </View>

        {/* ─── RIGHT COLUMN ─────────────────────────── */}
        <View style={[s.colRight, isNarrow && { flex: undefined as any, width: '100%' }]}>

          {/* How it works */}
          <View style={s.sideCard}>
            <Text style={s.sideTitle}>How it works</Text>
            <View style={{ marginTop: 14, gap: 14 }}>
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <View key={step.num} style={s.stepRow}>
                    <View style={s.stepNumPill}>
                      <Text style={s.stepNumText}>{step.num}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.stepTitleRow}>
                        <View style={[s.stepIconBox, { backgroundColor: step.iconBg }]}>
                          <Icon size={13} color={step.iconColor} strokeWidth={2.2} />
                        </View>
                        <Text style={s.stepTitle}>{step.title}</Text>
                      </View>
                      <Text style={s.stepSub}>{step.sub}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ₹50 per referral info card */}
          <View style={s.infoCard}>
            <View style={s.infoTopRow}>
              <View style={s.infoIconBox}>
                <Sparkles size={16} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>₹50 per referral</Text>
                <Text style={s.infoSub}>No limit on earnings</Text>
              </View>
            </View>
            <Text style={s.infoBody}>
              Earn ₹50 for every friend who signs up and completes their first
              purchase. Credited within 24 hours.
            </Text>
          </View>

          {/* Recent invites */}
          <View style={s.sideCard}>
            <View style={s.recentHeader}>
              <Text style={s.sideTitle}>Recent Invites</Text>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={s.emptyBox}>
              <View style={s.emptyIconBox}>
                <UserPlus size={28} color="#cbd5e1" strokeWidth={1.5} />
              </View>
              <Text style={s.emptyTitle}>No invites yet</Text>
              <Text style={s.emptySub}>Start sharing to see activity</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  rootContent: { padding: 24, paddingBottom: 60 },

  // Top header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  earnedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  earnedPillText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  avatar: { width: 38, height: 38, borderRadius: 19 },

  // Body grid
  body: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  bodyStacked: { flexDirection: 'column' },
  colLeft: { flex: 2, gap: 16 },
  colRight: { flex: 1, gap: 16, minWidth: 280 },

  // Main card (left)
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  giftCircleSm: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },

  // Code box
  codeBox: {
    backgroundColor: '#F0F4F8',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 4,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  copyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Share row
  shareLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  shareRow: { flexDirection: 'row', gap: 18, marginBottom: 22 },
  shareItem: { alignItems: 'center', width: 60 },
  shareCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  shareItemLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  // Big share button
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  statIconBox: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  statRightLabel: {
    position: 'absolute',
    top: 18, right: 18,
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  statValue: { fontSize: 26, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  statSubLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Right column cards
  sideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  sideTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },

  // Steps
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumPill: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stepIconBox: {
    width: 22, height: 22, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  stepTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  stepSub: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },

  // Info card (₹50 per referral)
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 12,
  },
  infoTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconBox: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  infoSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  infoBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Recent invites
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 6,
  },
  emptyIconBox: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 12, color: Colors.textSecondary },
});
