import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Share, Platform, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight, Info, HelpCircle, MessageCircle,
  Shield, FileText, Copy, Share2, Gift,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { walletAPI, Wallet } from '../../api/wallet';
import { referralsAPI } from '../../api/referrals';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { MobileProfileHeader } from '../../components/MobileProfileHeader';
import { ShareRewardsSummary } from '../../components/ShareRewardsSummary';

// ─── Helpers ────────────────────────────────────────────────────────────────

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
const num = (n: number) => (n || 0).toLocaleString('en-IN');

// ─── Stat card (top row) ────────────────────────────────────────────────────

function StatCard({
  label, value, action, actionColor, accent, onAction,
}: {
  label: string;
  value: string;
  action?: string;
  actionColor?: string;
  /** Highlights the card in brand blue when true (used for "Total Earning"). */
  accent?: boolean;
  onAction?: () => void;
}) {
  return (
    <View style={[s.statCard, accent && s.statCardAccent]}>
      <Text style={[s.statLabel, accent && s.statLabelAccent]}>{label}</Text>
      <Text style={[s.statValue, accent && s.statValueAccent]} numberOfLines={1}>{value}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text
            style={[
              s.statAction,
              accent ? s.statActionAccent : { color: actionColor ?? Colors.primary },
            ]}
            numberOfLines={1}
          >
            {action}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Quick action row ───────────────────────────────────────────────────────

function QuickAction({
  icon: Icon, iconColor, iconBg, title, subtitle, rightSlot, onPress,
}: {
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.actionRow} activeOpacity={0.85} onPress={onPress}>
      <View style={[s.actionIconBox, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actionTitle}>{title}</Text>
        {subtitle ? <Text style={s.actionSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightSlot ?? <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />}
    </TouchableOpacity>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export const MobileProfileScreen = () => {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);

  const { data: walletRes } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletAPI.getWallet(),
    staleTime: 30_000,
  });
  const wallet: Wallet | undefined =
    (walletRes as any)?.data?.wallet ??
    (walletRes as any)?.wallet ??
    (walletRes as any)?.data;

  const coins = wallet?.coins ?? 0;
  const shareRewards = (walletRes as any)?.data?.shareRewards ?? { pending: 0, confirmed: 0 };

  const { data: referralStats } = useQuery({
    queryKey: ['referralStats'],
    queryFn: referralsAPI.getStats,
  });
  const referralCount = referralStats?.data?.confirmedCount ?? 0;
  // earningsCoins from the API is a coin count, not rupees — this card
  // renders ₹ via inr(), so use referrerRupees (₹ per confirmed referral,
  // computed server-side from live AdminSettings) instead of raw coins.
  const referralEarnings = referralCount * (referralStats?.data?.referrerRupees ?? 0);
  const referralCode     = user?.referralCode || '';

  const handleCopyCode = async () => {
    if (!referralCode) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(referralCode);
      } catch {
        /* clipboard blocked — fall through to alert */
      }
      return;
    }
    // Native: no expo-clipboard installed yet. Show the code so user can
    // long-press to copy. Install expo-clipboard and swap for
    // `Clipboard.setStringAsync(referralCode)` for one-tap copy.
    Alert.alert('Your referral code', referralCode, [{ text: 'OK' }]);
  };

  const handleShareCode = async () => {
    if (!referralCode) return;
    try {
      const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
      await Share.share({
        message: `Join Chingiringi with my code ${referralCode} — get ₹5 to start! ${base}/r/${referralCode}`,
      });
    } catch {
      /* user cancelled — ignore */
    }
  };

  const refresh = usePullToRefresh();

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl {...refresh} />}
      >
        {/* Dedicated profile header per Figma 235:4012 — centered avatar +
            name, edit pencil top-right, no back / kicker. Kept as its own
            component so the shared MobileAuthHeader stays uniform. */}
        <MobileProfileHeader
          name={user?.name || 'Guest'}
          avatarUrl={user?.avatarUrl}
          onEditPress={() => nav.navigate('EditProfile')}
          onSettingsPress={() => nav.navigate('Settings')}
        />

        <View style={s.body}>
          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <View style={s.statsRow}>
            <StatCard
              accent
              label="COINS"
              value={num(coins)}
              action="Withdraw  ›"
              onAction={() => (nav as any).navigate('Wallet', { openWithdraw: true })}
            />
            <StatCard
              label="Pending Coins"
              value={num(shareRewards.pending)}
              action="Processing  ›"
              actionColor="#f59e0b"
            />
          </View>


          {/* ── Referral Program card (dark navy gradient) ─────────────────
              Figma spec: linear-gradient(140deg, #0F172A 3.67%, #1E293B
              59.27%, #1E3A5F 96.33%). Expo's LinearGradient takes a unit
              vector start→end instead of a CSS angle — {x:0,y:0}→{x:0.85,y:1}
              approximates 140°. Locations match Figma stop percentages. */}
          <LinearGradient
            colors={['#0F172A', '#1E293B', '#1E3A5F']}
            locations={[0.0367, 0.5927, 0.9633]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={s.referralCard}
          >
            <View style={s.referralHeader}>
              <View style={s.referralGiftBox}>
                <Gift size={16} color="#a78bfa" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.referralTitle}>Referral Program</Text>
                <Text style={s.referralSubtitle}>Earn ₹25 — your friend gets ₹5</Text>
              </View>
              <TouchableOpacity style={s.detailsBtn}>
                <Text style={s.detailsBtnText}>Details ›</Text>
              </TouchableOpacity>
            </View>

            <View style={s.referralStatsRow}>
              <View style={s.referralStatBox}>
                <Text style={s.referralStatLabel}>Referred</Text>
                <Text style={s.referralStatValue}>{referralCount}</Text>
              </View>
              <View style={[s.referralStatBox, s.referralStatBoxAlt]}>
                <Text style={s.referralStatLabel}>Earnings</Text>
                <Text style={[s.referralStatValue, { color: '#22c55e' }]}>
                  {inr(referralEarnings)}
                </Text>
              </View>
            </View>

            <View style={s.referralCodeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.referralStatLabel}>YOUR CODE</Text>
                <Text style={s.referralCode}>
                  {referralCode || '—'}
                </Text>
              </View>
              <TouchableOpacity style={s.referralIconBtn} onPress={handleCopyCode}>
                <Copy size={16} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity style={s.referralIconBtnPrimary} onPress={handleShareCode}>
                <Share2 size={16} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ── Legal & Support ───────────────────────────────────────────── */}
          <Text style={s.sectionHeader}>LEGAL & SUPPORT</Text>

          <QuickAction
            icon={Info}
            iconColor="#3b82f6"
            iconBg="#eff6ff"
            title="About"
            subtitle="Our story, mission & values"
            onPress={() => nav.navigate('About')}
          />
          <QuickAction
            icon={HelpCircle}
            iconColor="#a78bfa"
            iconBg="#f5f3ff"
            title="Help & Support"
            subtitle="FAQs, raise a ticket & more"
          />
          <QuickAction
            icon={MessageCircle}
            iconColor="#16a34a"
            iconBg="#dcfce7"
            title="Contact Us"
            subtitle="Get in touch with our team"
          />
          <QuickAction
            icon={Shield}
            iconColor="#ef4444"
            iconBg="#fee2e2"
            title="Privacy Policy"
            subtitle="How we handle your data"
          />
          <QuickAction
            icon={FileText}
            iconColor="#f59e0b"
            iconBg="#fef3c7"
            title="Terms & Conditions"
            subtitle="Rules, policies & agreements"
          />
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },


  body: { paddingHorizontal: 16, paddingTop: 14 },

  // Stats row
  statsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  statCardAccent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statLabel: {
    fontSize: 9, fontFamily: Fonts.bold, color: Colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 6,
  },
  statLabelAccent: { color: 'rgba(255,255,255,0.8)' },
  statValue: {
    fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text,
  },
  statValueAccent: { color: '#fff' },
  statAction: { fontSize: 11, fontFamily: Fonts.semiBold, marginTop: 4 },
  statActionAccent: { color: 'rgba(255,255,255,0.92)' },

  // Referral card
  referralCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  referralHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 14,
  },
  referralGiftBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  referralTitle: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  referralSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  detailsBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  detailsBtnText: { color: '#fff', fontSize: 11, fontFamily: Fonts.bold },

  referralStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  referralStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 10,
  },
  referralStatBoxAlt: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.22)',
  },
  referralStatLabel: {
    color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 0.5, marginBottom: 4,
  },
  referralStatValue: { color: '#fff', fontSize: 18, fontFamily: Fonts.extraBold },

  referralCodeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 12,
  },
  referralCode: {
    color: '#fff', fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: 2,
    marginTop: 2,
  },
  referralIconBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  referralIconBtnPrimary: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  // Section headers
  sectionHeader: {
    fontSize: 10, fontFamily: Fonts.bold,
    color: Colors.textSecondary, letterSpacing: 1.1,
    marginTop: 6, marginBottom: 8,
  },

  // Action rows
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  actionIconBox: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  actionTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  actionSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});

export default MobileProfileScreen;
