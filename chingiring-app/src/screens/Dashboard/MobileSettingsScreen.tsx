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
  Image,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  Shield,
  Lock,
  Smartphone,
  Link2,
  LogOut,
  Trash2,
  ChevronRight,
  Info,
  FileText,
  HelpCircle,
  Star,
  ScrollText,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { profileAPI } from '../../api/profile';
import { Fonts, Colors } from '../../constants/theme';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

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
        thumbColor={value ? Colors.primary : '#F5F8FF'}
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
  onPress: () => void;
}

function NavRow({
  icon: Icon, label, subtitle, iconBg = '#f1f5f9', iconColor = '#64748b', onPress,
}: NavRowProps) {
  return (
    <TouchableOpacity style={s.navRow} onPress={onPress} activeOpacity={0.65}>
      <View style={[s.navIconWrap, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={s.navInfo}>
        <Text style={s.navLabel}>{label}</Text>
        {subtitle ? <Text style={s.navSub}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
    </TouchableOpacity>
  );
}

// ─── Main ────────────────────────────────────────────────────────────

export const MobileSettingsScreen = () => {
  const nav = useNavigation<any>();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const refresh = usePullToRefresh();

  // ── Notification states
  const [cashback, setCashback] = useState(true);
  const [deals, setDeals] = useState(true);
  const [referral, setReferral] = useState(false);
  const [email, setEmail] = useState(true);

  // ── Delete account
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: profileAPI.deleteAccount,
    onSuccess: () => {
      setDeleteModalOpen(false);
      logout();
    },
    onError: () =>
      Alert.alert('Error', 'Failed to delete account. Please try again.'),
  });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl {...refresh} />}
      >
        {/* Shared blue gradient header */}
        <MobileAuthHeader
          kicker="ACCOUNT"
          title="Settings"
          align="left"
        />

        <View style={s.body}>
          {/* ── Profile quick info ──────────────────────── */}
          {user && (
            <TouchableOpacity
              style={s.profileStrip}
              onPress={() => nav.navigate('EditProfile')}
              activeOpacity={0.75}
            >
              <View style={s.profileAvatarSmall}>
                {user.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={s.profileAvatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={s.profileAvatarTxt}>
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </Text>
                )}
              </View>
              <View style={s.profileStripInfo}>
                <Text style={s.profileStripName}>{user.name}</Text>
                <Text style={s.profileStripSub}>
                  {user.phone || user.email || 'Edit profile →'}
                </Text>
              </View>
              <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* ── Notifications ───────────────────────────── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionIcon, { backgroundColor: '#eff6ff' }]}>
              <Bell size={13} color={Colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={s.sectionTitle}>Notifications</Text>
          </View>
          <View style={s.card}>
            <ToggleRow
              label="Cashback Updates"
              subtitle="Get notified when cashback is confirmed"
              value={cashback}
              onToggle={setCashback}
            />
            <View style={s.divider} />
            <ToggleRow
              label="Deal Alerts"
              subtitle="Notify about new deals and offers"
              value={deals}
              onToggle={setDeals}
            />
            <View style={s.divider} />
            <ToggleRow
              label="Referral Updates"
              subtitle="Updates about your referrals"
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
            <View style={[s.sectionIcon, { backgroundColor: '#f5f3ff' }]}>
              <Shield size={13} color="#8b5cf6" strokeWidth={2.2} />
            </View>
            <Text style={s.sectionTitle}>Security & Privacy</Text>
          </View>
          <View style={s.card}>
            <NavRow
              icon={Lock}
              label="Change Password"
              iconBg="#f1f5f9"
              iconColor="#64748b"
              onPress={() => {}}
            />
            <View style={s.divider} />
            <NavRow
              icon={Smartphone}
              label="Two-Factor Authentication"
              subtitle="Disabled"
              iconBg="#f1f5f9"
              iconColor="#64748b"
              onPress={() => {}}
            />
            <View style={s.divider} />
            <NavRow
              icon={Link2}
              label="Linked Accounts"
              iconBg="#f1f5f9"
              iconColor="#64748b"
              onPress={() => {}}
            />
          </View>

          {/* ── About ───────────────────────────────────── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionIcon, { backgroundColor: '#f0fdfa' }]}>
              <Info size={13} color="#0d9488" strokeWidth={2.2} />
            </View>
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
              icon={ScrollText}
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

          {/* ── Account Actions ─────────────────────────── */}
          <View style={s.sectionRow}>
            <View style={[s.sectionIcon, { backgroundColor: '#f1f5f9' }]}>
              <LogOut size={13} color="#64748b" strokeWidth={2.2} />
            </View>
            <Text style={s.sectionTitle}>Account Actions</Text>
          </View>
          <View style={s.card}>
            <TouchableOpacity
              style={s.navRow}
              onPress={handleLogout}
              activeOpacity={0.65}
            >
              <View style={[s.navIconWrap, { backgroundColor: '#f1f5f9' }]}>
                <LogOut size={18} color="#64748b" strokeWidth={2} />
              </View>
              <Text style={s.logoutLabel}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* ── Delete Account — full-width red button ──── */}
          <TouchableOpacity
            style={[s.deleteBtn, deleteMutation.isPending && { opacity: 0.7 }]}
            onPress={() => setDeleteModalOpen(true)}
            activeOpacity={0.85}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Trash2 size={18} color="#fff" strokeWidth={2.2} />
                <Text style={s.deleteBtnText}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.versionTxt}>ChingiRingi v1.0.0</Text>
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={() => deleteMutation.mutate()}
        onShowDeals={() => {
          setDeleteModalOpen(false);
          // Mobile has no dedicated Deals tab — Home shows banners + product
          // grids, which is the closest match. Fall back gracefully if the
          // route name differs (e.g. on desktop builds).
          try {
            nav.navigate('MainTabs', { screen: 'Home' });
          } catch {
            try { nav.navigate('Home'); } catch { /* ignore */ }
          }
        }}
        isDeleting={deleteMutation.isPending}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  scroll: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile strip
  profileStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  profileAvatarImg: { width: '100%', height: '100%' },
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
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },

  // Card container
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 12,
  },

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
    fontFamily: Fonts.bold,
    color: '#0f172a',
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
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  navSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },

  // Delete button — big red CTA
  deleteBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#ef4444',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
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

export default MobileSettingsScreen;
