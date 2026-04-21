import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Bell,
  Shield,
  Lock,
  Smartphone,
  Link2,
  LogOut,
  Trash2,
  ChevronRight,
  Tag,
  Info,
  FileText,
  HelpCircle,
  Star,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { profileAPI } from '../../api/profile';
import { Fonts, Colors } from '../../constants/theme';

// ─── Sub-components ──────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}

function ToggleRow({ label, subtitle, value, onToggle }: ToggleRowProps) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleInfo}>
        <Text style={s.toggleLabel}>{label}</Text>
        {subtitle ? <Text style={s.toggleSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#e2e8f0', true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : '#f8fafc'}
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
}

interface NavRowProps {
  icon: React.ComponentType<any>;
  label: string;
  subtitle?: string;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  onPress: () => void;
}

function NavRow({ icon: Icon, label, subtitle, iconBg = '#f1f5f9', iconColor = '#64748b', badge, onPress }: NavRowProps) {
  return (
    <TouchableOpacity style={s.navRow} onPress={onPress} activeOpacity={0.65}>
      <View style={[s.navIconWrap, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={s.navInfo}>
        <Text style={s.navLabel}>{label}</Text>
        {subtitle ? <Text style={s.navSub}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={s.navBadge}>
          <Text style={s.navBadgeTxt}>{badge}</Text>
        </View>
      ) : (
        <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

// ─── Main ────────────────────────────────────────────────────────────

export const MobileSettingsScreen = () => {
  const nav = useNavigation<any>();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  // ── Notification states
  const [cashback, setCashback] = useState(true);
  const [deals, setDeals] = useState(true);
  const [referral, setReferral] = useState(false);
  const [email, setEmail] = useState(true);

  // ── Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: profileAPI.deleteAccount,
    onSuccess: () => logout(),
    onError: () => Alert.alert('Error', 'Failed to delete account. Please try again.'),
  });

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent. All your cashback, coins, transaction history and referral data will be erased and cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Header ─────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerSmall}>ACCOUNT</Text>
          <Text style={s.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >

        {/* ── Profile quick info ──────────────────────── */}
        {user && (
          <TouchableOpacity
            style={s.profileStrip}
            onPress={() => nav.navigate('EditProfile')}
            activeOpacity={0.75}
          >
            <View style={s.profileAvatarSmall}>
              <Text style={s.profileAvatarTxt}>
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={s.profileStripInfo}>
              <Text style={s.profileStripName}>{user.name}</Text>
              <Text style={s.profileStripSub}>{user.phone || user.email || 'Edit profile →'}</Text>
            </View>
            <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* ── Notifications ───────────────────────────── */}
        <View style={s.sectionRow}>
          <Bell size={15} color={Colors.primary} strokeWidth={2} />
          <Text style={s.sectionTitle}>Notifications</Text>
        </View>
        <View style={s.card}>
          <ToggleRow
            label="Cashback Updates"
            subtitle="Notified when cashback is confirmed"
            value={cashback}
            onToggle={setCashback}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Deal Alerts"
            subtitle="New deals and limited-time offers"
            value={deals}
            onToggle={setDeals}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Referral Updates"
            subtitle="When someone uses your code"
            value={referral}
            onToggle={setReferral}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Email Notifications"
            subtitle="Receive updates via email"
            value={email}
            onToggle={setEmail}
          />
        </View>

        {/* ── Security & Privacy ──────────────────────── */}
        <View style={s.sectionRow}>
          <Shield size={15} color="#f97316" strokeWidth={2} />
          <Text style={s.sectionTitle}>Security & Privacy</Text>
        </View>
        <View style={s.card}>
          <NavRow
            icon={Lock}
            label="Change Password"
            iconBg="#eff6ff"
            iconColor={Colors.primary}
            onPress={() => {}}
          />
          <View style={s.divider} />
          <NavRow
            icon={Smartphone}
            label="Two-Factor Authentication"
            subtitle="Add extra protection to your account"
            iconBg="#f0fdf4"
            iconColor="#16a34a"
            badge="Off"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <NavRow
            icon={Link2}
            label="Linked Accounts"
            subtitle="Manage connected Google / social accounts"
            onPress={() => {}}
          />
        </View>

        {/* ── About ───────────────────────────────────── */}
        <View style={s.sectionRow}>
          <Info size={15} color="#8b5cf6" strokeWidth={2} />
          <Text style={s.sectionTitle}>About</Text>
        </View>
        <View style={s.card}>
          <NavRow
            icon={HelpCircle}
            label="Help & Support"
            iconBg="#f0f9ff"
            iconColor="#0ea5e9"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <NavRow
            icon={FileText}
            label="Terms of Service"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <NavRow
            icon={Tag}
            label="Privacy Policy"
            onPress={() => {}}
          />
          <View style={s.divider} />
          <NavRow
            icon={Star}
            label="Rate the App"
            iconBg="#fffbeb"
            iconColor="#f59e0b"
            onPress={() => {}}
          />
        </View>

        {/* ── Log Out ─────────────────────────────────── */}
        <TouchableOpacity style={s.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <View style={s.logoutIcon}>
            <LogOut size={18} color="#64748b" strokeWidth={2} />
          </View>
          <Text style={s.logoutTxt}>Log Out</Text>
          <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
        </TouchableOpacity>

        {/* ── Delete Account ──────────────────────────── */}
        <TouchableOpacity
          style={[s.deleteRow, deleteMutation.isPending && { opacity: 0.5 }]}
          onPress={handleDeleteAccount}
          activeOpacity={0.75}
          disabled={deleteMutation.isPending}
        >
          <View style={s.deleteIcon}>
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Trash2 size={18} color="#ef4444" strokeWidth={2} />
            )}
          </View>
          <Text style={s.deleteTxt}>Delete Account</Text>
          <ChevronRight size={16} color="#fca5a5" strokeWidth={2} />
        </TouchableOpacity>

        {/* ── Version ─────────────────────────────────── */}
        <Text style={s.versionTxt}>ChingiRingi v1.0.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },

  // Header
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSmall: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },

  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Profile strip
  profileStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  profileAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileAvatarTxt: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.primary,
  },
  profileStripInfo: { flex: 1 },
  profileStripName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#1e293b',
  },
  profileStripSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 1,
  },

  // Section headers
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Card container
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f1f5f9', marginHorizontal: 12 },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Nav rows
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  navInfo: { flex: 1 },
  navLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
  },
  navSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 2,
  },
  navBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  navBadgeTxt: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },

  // Logout row
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutTxt: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },

  // Delete row
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deleteTxt: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },

  // Version
  versionTxt: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#cbd5e1',
    marginBottom: 8,
  },
});
