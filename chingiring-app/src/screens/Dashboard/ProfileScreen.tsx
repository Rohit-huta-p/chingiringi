import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  useWindowDimensions, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mail, Phone, MapPin, Pencil, Gift, IndianRupee, Clock, Coins,
  ArrowUpRight, ChevronRight, MapPinHouse, Settings as SettingsIcon,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { profileAPI } from '../../api/profile';
import { walletAPI } from '../../api/wallet';

// Quick action items
const QUICK_ACTIONS: Array<{
  label: string;
  icon: React.ComponentType<any>;
  route?: string;
}> = [
  { label: 'Manage Addresses', icon: MapPinHouse, route: 'MyAddress' },
];

// Legal & support items (2 cols + 1 full row)
const LEGAL_ITEMS = [
  ['About', 'Help & Support'],
  ['Affiliate Partners', 'Privacy Policy'],
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 1100;
  const navigation = useNavigation<any>();

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: profileAPI.getProfile,
  });

  const { data: walletSummary } = useQuery({
    queryKey: ['walletSummary'],
    queryFn: walletAPI.getWalletSummary,
  });

  const { data: referralTxData } = useQuery({
    queryKey: ['transactions', 'referral'],
    queryFn: () => walletAPI.getTransactions({ type: 'referral', limit: 100 }),
  });

  const user = profileData?.data?.user;
  const wallet = walletSummary?.data?.wallet ?? {
    confirmedCashback: 0,
    pendingCashback: 0,
    coins: 0,
  };

  const profile = user
    ? {
        name: user.name || '',
        memberSince: user.createdAt
          ? new Date(user.createdAt).getFullYear().toString()
          : '',
        email: user.email || '',
        phone: user.phone || '',
        location: '',
        referralCode: user.referralCode || '',
        avatarUrl: user.avatarUrl || '',
      }
    : { name: '', memberSince: '', email: '', phone: '', location: '', referralCode: '', avatarUrl: '' };

  const referralTxns: any[] = referralTxData?.data?.transactions ?? [];
  const totalReferred = referralTxns.length;
  const referralEarnings = referralTxns.reduce(
    (sum: number, tx: any) => sum + (tx.amount || 0),
    0,
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={s.rootContent}>
      {/* Top header */}
      <View style={s.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ACCOUNT</Text>
          <Text style={s.pageTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          style={s.settingsBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <SettingsIcon size={20} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Body grid */}
      <View style={[s.body, isNarrow && s.bodyStacked]}>

        {/* ─── LEFT COLUMN ─────────────────────────── */}
        <View style={[s.colLeft, isNarrow && { flex: undefined as any, width: '100%' }]}>

          {/* Profile card */}
          <View style={s.card}>
            {/* Avatar */}
            <View style={s.avatarWrap}>
              <Image
                source={{
                  uri: profile.avatarUrl
                    || `https://ui-avatars.com/api/?background=4784E2&color=fff&bold=true&name=${encodeURIComponent(profile.name)}`,
                }}
                style={s.avatar}
              />
              <View style={s.avatarBadge}>
                <Pencil size={11} color="#fff" strokeWidth={2.5} />
              </View>
            </View>

            <Text style={s.profileName}>{profile.name}</Text>
            <Text style={s.memberSince}>Member since {profile.memberSince}</Text>

            {/* Info rows */}
            <View style={s.infoCol}>
              {profile.email ? (
                <View style={s.infoRow}>
                  <Mail size={14} color="#94a3b8" strokeWidth={2} />
                  <Text style={s.infoText}>{profile.email}</Text>
                </View>
              ) : null}
              {profile.phone ? (
                <View style={s.infoRow}>
                  <Phone size={14} color="#94a3b8" strokeWidth={2} />
                  <Text style={s.infoText}>{profile.phone}</Text>
                </View>
              ) : null}
              {profile.location ? (
                <View style={s.infoRow}>
                  <MapPin size={14} color="#94a3b8" strokeWidth={2} />
                  <Text style={s.infoText}>{profile.location}</Text>
                </View>
              ) : null}
            </View>

            {/* Edit Profile button */}
            <TouchableOpacity
              style={s.editBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Pencil size={13} color={Colors.text} strokeWidth={2} />
              <Text style={s.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Quick Actions</Text>
            <View style={s.quickList}>
              {QUICK_ACTIONS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[s.quickRow, idx < QUICK_ACTIONS.length - 1 && s.quickRowDivider]}
                    activeOpacity={0.7}
                    onPress={() => item.route && navigation.navigate(item.route)}
                  >
                    <View style={s.quickIconBox}>
                      <Icon size={15} color="#64748b" strokeWidth={2} />
                    </View>
                    <Text style={s.quickLabel}>{item.label}</Text>
                    <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ─── RIGHT COLUMN ────────────────────────── */}
        <View style={[s.colRight, isNarrow && { flex: undefined as any, width: '100%' }]}>

          {/* Wallet stats row */}
          <View style={s.walletRow}>
            {/* CONFIRMED — gradient */}
            <View style={s.walletCardGradient}>
              <LinearGradient
                colors={['#4784E2', '#2D6BC9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View pointerEvents="none" style={[s.glob, s.globTopRight]} />
              <View pointerEvents="none" style={[s.glob, s.globBottomLeft]} />

              <View style={s.walletEyebrowRow}>
                <View style={[s.walletDot, { backgroundColor: '#fb923c' }]}>
                  <IndianRupee size={9} color="#fff" strokeWidth={3} />
                </View>
                <Text style={[s.walletEyebrow, { color: 'rgba(255,255,255,0.85)' }]}>CONFIRMED</Text>
              </View>
              <Text style={[s.walletAmount, { color: '#fff' }]}>₹{wallet.confirmedCashback}</Text>
              <TouchableOpacity style={s.walletLinkRow} activeOpacity={0.8}>
                <Text style={[s.walletLinkText, { color: 'rgba(255,255,255,0.95)' }]}>Withdraw</Text>
                <ArrowUpRight size={13} color="rgba(255,255,255,0.95)" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* PENDING */}
            <View style={s.walletCard}>
              <View style={s.walletEyebrowRow}>
                <View style={[s.walletDot, { backgroundColor: '#fbbf24' }]}>
                  <Clock size={9} color="#fff" strokeWidth={3} />
                </View>
                <Text style={s.walletEyebrow}>PENDING</Text>
              </View>
              <Text style={s.walletAmount}>₹{wallet.pendingCashback}</Text>
              <Text style={s.walletSubtext}>Processing</Text>
            </View>

            {/* COINS */}
            <View style={s.walletCard}>
              <View style={s.walletEyebrowRow}>
                <View style={[s.walletDot, { backgroundColor: '#facc15' }]}>
                  <Coins size={9} color="#fff" strokeWidth={3} />
                </View>
                <Text style={s.walletEyebrow}>COINS</Text>
              </View>
              <Text style={s.walletAmount}>{wallet.coins}</Text>
              <TouchableOpacity style={s.walletLinkRow} activeOpacity={0.8}>
                <Text style={[s.walletLinkText, { color: Colors.primary }]}>Redeem</Text>
                <ArrowUpRight size={13} color={Colors.primary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Referral program — dark navy card */}
          <View style={s.referralCard}>
            <View style={s.referralTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.referralTitle}>Referral Program</Text>
                <Text style={s.referralSubtitle}>Earn ₹50 for every friend</Text>
              </View>
              <View style={s.referralGiftBox}>
                <Gift size={18} color="rgba(255,255,255,0.9)" strokeWidth={2} />
              </View>
            </View>

            <View style={s.referralStatsRow}>
              <View style={s.referralStat}>
                <Text style={s.referralStatLabel}>Total Referred</Text>
                <Text style={s.referralStatValue}>{totalReferred}</Text>
              </View>
              <View style={s.referralStat}>
                <Text style={s.referralStatLabel}>Earnings</Text>
                <Text style={s.referralStatValue}>₹{referralEarnings}</Text>
              </View>
              <View style={s.referralStat}>
                <Text style={s.referralStatLabel}>Your Code</Text>
                <Text style={[s.referralStatValue, { color: '#60a5fa', letterSpacing: 1 }]}>
                  {profile.referralCode}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.referralBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Referrals')}
            >
              <Text style={s.referralBtnText}>View Details</Text>
              <ChevronRight size={14} color="#fff" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Legal & Support card */}
          <View style={s.legalCard}>
            <Text style={s.legalEyebrow}>LEGAL & SUPPORT</Text>

            {LEGAL_ITEMS.map((row, ri) => (
              <View key={ri} style={s.legalRow}>
                {row.map((label) => (
                  <TouchableOpacity
                    key={label}
                    style={s.legalCell}
                    activeOpacity={0.7}
                    onPress={() => label === 'About' && navigation.navigate('About')}
                  >
                    <Text style={s.legalLabel}>{label}</Text>
                    <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Last full-width row */}
            <View style={s.legalRow}>
              <TouchableOpacity style={[s.legalCell, { flex: 1 }]} activeOpacity={0.7}>
                <Text style={s.legalLabel}>Terms & Conditions</Text>
                <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
              </TouchableOpacity>
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
    marginBottom: 24, paddingHorizontal: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  settingsBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e8ecf2',
    justifyContent: 'center', alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },

  // Body grid
  body: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  bodyStacked: { flexDirection: 'column' },
  colLeft: { flex: 1, gap: 16, minWidth: 280, maxWidth: 360 },
  colRight: { flex: 2, gap: 16 },

  // Generic card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },

  // Avatar
  avatarWrap: {
    alignSelf: 'center',
    width: 110, height: 110,
    marginBottom: 14,
    position: 'relative',
  },
  avatar: {
    width: 110, height: 110,
    borderRadius: 55,
    backgroundColor: '#cbd5e1',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 4, right: 4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Info rows
  infoCol: { gap: 10, marginBottom: 18 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: { fontSize: 13, color: Colors.text, fontWeight: '500' },

  // Edit profile button
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 11,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  // Quick actions list
  quickList: {},
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  quickRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  quickIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center', alignItems: 'center',
  },
  quickLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },

  // Wallet row
  walletRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  walletCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    gap: 6,
  },
  walletCardGradient: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#4784E2',
  },
  glob: {
    position: 'absolute',
    width: 140, height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  globTopRight: { top: -55, right: -45 },
  globBottomLeft: { bottom: -55, left: -45 },

  walletEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  walletDot: {
    width: 14, height: 14, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  walletEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  walletAmount: { fontSize: 24, fontWeight: '900', color: Colors.text, letterSpacing: -0.5 },
  walletSubtext: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  walletLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  walletLinkText: { fontSize: 11, fontWeight: '700' },

  // Referral card
  referralCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 22,
  },
  referralTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  referralTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  referralSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 3 },
  referralGiftBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  referralStatsRow: { flexDirection: 'row', gap: 24, marginBottom: 18, flexWrap: 'wrap' },
  referralStat: { gap: 6 },
  referralStatLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  referralStatValue: { fontSize: 18, fontWeight: '800', color: '#fff' },

  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  referralBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Legal & support
  legalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  legalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 14,
  },
  legalRow: { flexDirection: 'row', gap: 24 },
  legalCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  legalLabel: { fontSize: 13, color: Colors.text, fontWeight: '500' },
});
