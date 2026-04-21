import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pencil,
  Gift,
  Copy,
  Share2,
  ChevronRight,
  ArrowDownToLine,
  Settings as SettingsIcon,
  Info,
  HelpCircle,
  Phone,
  ShieldCheck,
  FileText,
  LogOut,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { profileAPI } from '../../api/profile';
import { walletAPI } from '../../api/wallet';
import { Fonts, Colors, Gradient } from '../../constants/theme';

// ─── Helpers ────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmt(n?: number) {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Row Item ───────────────────────────────────────────────────────

interface RowProps {
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  rightChip?: { label: string; color: string; bg: string };
}

function Row({ icon: Icon, iconBg, iconColor, title, subtitle, onPress, rightChip }: RowProps) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
      <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      {rightChip ? (
        <View style={[s.chip, { backgroundColor: rightChip.bg }]}>
          <Text style={[s.chipTxt, { color: rightChip.color }]}>{rightChip.label}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileProfileScreen = () => {
  const nav = useNavigation<any>();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data: profileRes } = useQuery({
    queryKey: ['profile'],
    queryFn: profileAPI.getProfile,
  });

  const { data: walletRes } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletAPI.getWallet,
  });

  const profile = profileRes?.data?.user ?? profileRes?.data ?? null;
  const wallet = walletRes?.data?.wallet ?? walletRes?.data ?? null;

  const name = profile?.name ?? authUser?.name ?? 'User';
  const referralCode = profile?.referralCode ?? authUser?.referralCode ?? 'DEV500';

  const confirmed = wallet?.confirmedCashback ?? 0;
  const pending = wallet?.pendingCashback ?? 0;
  const coins = wallet?.coins ?? 0;
  const referredCount = profile?.referredCount ?? 0;
  const referralEarnings = profile?.referralEarnings ?? 0;

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleCopyCode = () => {
    if (Platform.OS === 'web') {
      (navigator as any)?.clipboard?.writeText?.(referralCode);
    } else {
      (Clipboard as any).setString?.(referralCode);
    }
    Alert.alert('Copied', `Referral code ${referralCode} copied to clipboard.`);
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join ChingiRingi with my referral code ${referralCode} and earn rewards!`,
      });
    } catch {
      /* no-op */
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Gradient Header ─────────────────────────── */}
        <LinearGradient
          colors={Gradient.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => nav.navigate('EditProfile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={16} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarInitials}>{initials(name)}</Text>
            </View>
          </View>

          <Text style={s.headerName}>{name}</Text>
        </LinearGradient>

        {/* ── Stat Cards (overlap header) ─────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>TOTAL EARNING</Text>
            <Text style={[s.statVal, { color: '#0f172a' }]}>{fmt(confirmed || 1250)}</Text>
            <TouchableOpacity onPress={() => nav.navigate('Wallet')}>
              <Text style={[s.statAction, { color: '#16a34a' }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>PENDING</Text>
            <Text style={[s.statVal, { color: '#f59e0b' }]}>{fmt(pending || 450)}</Text>
            <Text style={[s.statAction, { color: '#94a3b8' }]}>Processing...</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>COINS</Text>
            <Text style={[s.statVal, { color: '#8b5cf6' }]}>{coins || 840}</Text>
            <TouchableOpacity>
              <Text style={[s.statAction, { color: '#8b5cf6' }]}>Redeem</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Referral Program (dark card) ────────────── */}
        <View style={s.referralCard}>
          <View style={s.referralTop}>
            <View style={s.referralIcon}>
              <Gift size={20} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.referralTitle}>Referral Program</Text>
              <Text style={s.referralSub}>Earn ₹50 per friend</Text>
            </View>
            <TouchableOpacity
              style={s.detailsBtn}
              onPress={() => nav.navigate('Refer')}
              activeOpacity={0.7}
            >
              <Text style={s.detailsBtnTxt}>Details</Text>
              <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={s.referralStats}>
            <View style={s.referralStat}>
              <Text style={s.referralStatLabel}>Referred</Text>
              <Text style={s.referralStatVal}>{referredCount || 12}</Text>
            </View>
            <View style={s.referralStatDivider} />
            <View style={s.referralStat}>
              <Text style={s.referralStatLabel}>Earnings</Text>
              <Text style={[s.referralStatVal, { color: '#22c55e' }]}>
                {fmt(referralEarnings || 600)}
              </Text>
            </View>
          </View>

          <Text style={s.codeLabel}>YOUR CODE</Text>
          <View style={s.codeRow}>
            <View style={s.codeBox}>
              <Text style={s.codeTxt}>{referralCode}</Text>
            </View>
            <TouchableOpacity
              style={s.codeAction}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Copy size={16} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.codeAction}
              onPress={handleShareCode}
              activeOpacity={0.7}
            >
              <Share2 size={16} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Quick Actions ───────────────────────────── */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.listCard}>
          <Row
            icon={ArrowDownToLine}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            title="Withdraw Money"
            subtitle="Transfer to bank or UPI"
            rightChip={{
              label: fmt(confirmed || 1250),
              color: '#16a34a',
              bg: '#dcfce7',
            }}
            onPress={() => nav.navigate('Wallet')}
          />
          <View style={s.divider} />
          <Row
            icon={SettingsIcon}
            iconBg="#e0e7ff"
            iconColor="#4f46e5"
            title="Account Settings"
            subtitle="Notifications, security & more"
            onPress={() => nav.navigate('Settings')}
          />
        </View>

        {/* ── Legal & Support ─────────────────────────── */}
        <Text style={s.sectionLabel}>LEGAL & SUPPORT</Text>
        <View style={s.listCard}>
          <Row
            icon={Info}
            iconBg="#dbeafe"
            iconColor="#2563eb"
            title="About"
            subtitle="Learn about ChingiRingi"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <Row
            icon={HelpCircle}
            iconBg="#fef3c7"
            iconColor="#d97706"
            title="Help & Support"
            subtitle="FAQs and troubleshooting"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <Row
            icon={Phone}
            iconBg="#dcfce7"
            iconColor="#16a34a"
            title="Contact Us"
            subtitle="Get in touch with our team"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <Row
            icon={ShieldCheck}
            iconBg="#ede9fe"
            iconColor="#7c3aed"
            title="Privacy Policy"
            subtitle="How we protect your data"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <Row
            icon={FileText}
            iconBg="#fee2e2"
            iconColor="#dc2626"
            title="Terms & Conditions"
            subtitle="Rules and guidelines"
            onPress={() => {}}
          />
        </View>

        {/* ── Logout ──────────────────────────────────── */}
        <TouchableOpacity style={s.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <View style={s.logoutIcon}>
            <LogOut size={18} color="#ef4444" strokeWidth={2} />
          </View>
          <Text style={s.logoutTxt}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },

  // ── Header
  header: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 80, // extra space for stat cards overlap
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  editBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 30,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },
  headerName: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Stats (overlap header)
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -60,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statVal: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    marginBottom: 4,
  },
  statAction: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },

  // ── Referral card (dark navy)
  referralCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 16,
  },
  referralTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  referralIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(71,132,226,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  referralSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 1,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
  },
  detailsBtnTxt: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  referralStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  referralStat: {
    flex: 1,
    alignItems: 'center',
  },
  referralStatLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#94a3b8',
    marginBottom: 4,
  },
  referralStatVal: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },
  referralStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  codeTxt: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 1.5,
  },
  codeAction: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Section label
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#94a3b8',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },

  // ── List card
  listCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#0f172a',
  },
  rowSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 1,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  chipTxt: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 14,
  },

  // ── Logout
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  logoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutTxt: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
});
