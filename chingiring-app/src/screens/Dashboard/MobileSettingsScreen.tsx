import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Bell, ShieldCheck, LifeBuoy, UserCog, Lock, LogOut, ChevronRight,
  IndianRupee, Banknote, Users, Mail, HelpCircle, FileText, ScrollText, Star,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { profileAPI } from '../../api/profile';
import { notificationsAPI } from '../../api/notifications';
import { registerForPush, unregisterForPush } from '../../lib/push';
import { Fonts, Colors } from '../../constants/theme';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { SettingsSection, SettingRow, SettingToggle, Tint } from '../../components/SettingsList';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// ─── Main ────────────────────────────────────────────────────────────

export const MobileSettingsScreen = () => {
  const nav = useNavigation<any>();
  const logout = useAuthStore((st) => st.logout);
  const user = useAuthStore((st) => st.user);
  const refresh = usePullToRefresh();

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.getProfile(),
  });
  const prefs = profileData?.data?.user?.notificationPrefs;

  // ── Notification states
  const [cashback, setCashback] = useState(true);
  const [referral, setReferral] = useState(false);
  const [email, setEmail] = useState(true);
  const [withdrawals, setWithdrawals] = useState(true);
  const [push, setPush] = useState(true);

  useEffect(() => {
    if (prefs) {
      setCashback(prefs.cashback !== false);
      setWithdrawals(prefs.withdrawals !== false);
      setPush(prefs.push !== false);
    }
  }, [prefs]);

  const savePref = (patch: { cashback?: boolean; withdrawals?: boolean; push?: boolean }) => {
    notificationsAPI.updatePrefs(patch).catch((e: any) => console.warn('updatePrefs failed:', e?.message));
  };
  const onToggleCashback = (v: boolean) => { setCashback(v); savePref({ cashback: v }); };
  const onToggleWithdrawals = (v: boolean) => { setWithdrawals(v); savePref({ withdrawals: v }); };
  const onTogglePush = (v: boolean) => {
    setPush(v);
    savePref({ push: v });
    if (v) registerForPush(); else unregisterForPush();
  };

  // ── Change password / delete account
  const [changePwOpen, setChangePwOpen] = useState(false);
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
    // Alert.alert is a no-op on react-native-web (the mobile-web view), so the
    // confirm never shows and logout never fires. Use the browser confirm there.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm('Are you sure you want to log out?')) logout();
      return;
    }
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
        <MobileAuthHeader kicker="ACCOUNT" title="Settings" align="left" />

        <View style={s.body}>
          {/* ── Profile strip ───────────────────────────── */}
          {user && (
            <TouchableOpacity
              style={s.profileStrip}
              onPress={() => nav.navigate('EditProfile')}
              activeOpacity={0.75}
            >
              <View style={s.profileAvatar}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={s.profileAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={s.profileAvatarTxt}>
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.profileName}>{user.name}</Text>
                <Text style={s.profileSub}>{user.email || user.phone || 'Edit profile →'}</Text>
              </View>
              <View style={s.editPill}>
                <Text style={s.editPillTxt}>Edit</Text>
                <ChevronRight size={14} color={Colors.primary} strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Notifications ───────────────────────────── */}
          <SettingsSection title="Notifications" icon={Bell} {...Tint.primary}>
            <SettingToggle
              icon={IndianRupee} {...Tint.green}
              label="Cashback Updates"
              sublabel="When cashback is confirmed"
              value={cashback}
              onValueChange={onToggleCashback}
            />
            <SettingToggle
              icon={Banknote} {...Tint.blue}
              label="Withdrawal Updates"
              sublabel="Submitted, paid or rejected"
              value={withdrawals}
              onValueChange={onToggleWithdrawals}
            />
            <SettingToggle
              icon={Bell} {...Tint.primary}
              label="Push Notifications"
              sublabel="Get alerts on your device"
              value={push}
              onValueChange={onTogglePush}
            />
            <SettingToggle
              icon={Users} {...Tint.purple}
              label="Referral Updates"
              sublabel="Updates about your referrals"
              value={referral}
              onValueChange={setReferral}
            />
            <SettingToggle
              icon={Mail} {...Tint.amber}
              label="Email Notifications"
              sublabel="Receive updates via email"
              value={email}
              onValueChange={setEmail}
            />
          </SettingsSection>

          {/* ── Security & Privacy ──────────────────────── */}
          <SettingsSection title="Security & Privacy" icon={ShieldCheck} {...Tint.purple}>
            <SettingRow
              icon={Lock} {...Tint.slate}
              label="Change Password"
              sublabel="Reset via email code"
              onPress={() => setChangePwOpen(true)}
            />
          </SettingsSection>

          {/* ── Support ─────────────────────────────────── */}
          <SettingsSection title="Support" icon={LifeBuoy} {...Tint.teal}>
            <SettingRow icon={HelpCircle} {...Tint.sky} label="Help & Support" onPress={() => {}} />
            <SettingRow icon={FileText} {...Tint.slate} label="Terms of Service" onPress={() => {}} />
            <SettingRow icon={ScrollText} {...Tint.teal} label="Privacy Policy" onPress={() => {}} />
            <SettingRow icon={Star} {...Tint.amber} label="Rate the App" onPress={() => {}} />
          </SettingsSection>

          {/* ── Account ─────────────────────────────────── */}
          <SettingsSection title="Account" icon={UserCog} {...Tint.slate}>
            <SettingRow
              icon={LogOut} {...Tint.slate}
              label="Logout"
              onPress={handleLogout}
              hideChevron
            />
          </SettingsSection>

          {/* ── Delete account — quiet, low-emphasis text link ──── */}
          <TouchableOpacity
            style={[s.deleteLink, deleteMutation.isPending && { opacity: 0.5 }]}
            onPress={() => setDeleteModalOpen(true)}
            activeOpacity={0.6}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator color={Colors.danger} size="small" />
            ) : (
              <Text style={s.deleteLinkText}>Delete account</Text>
            )}
          </TouchableOpacity>

          <Text style={s.versionTxt}>ChingiRingi v1.0.0</Text>
        </View>
      </ScrollView>

      <ChangePasswordModal
        visible={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        email={user?.email}
      />

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirmDelete={() => deleteMutation.mutate()}
        onShowDeals={() => {
          setDeleteModalOpen(false);
          // Mobile has no dedicated Deals tab — Home is the closest match.
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
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile strip
  profileStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, overflow: 'hidden',
  },
  profileAvatarImg: { width: '100%', height: '100%' },
  profileAvatarTxt: { fontSize: 19, fontFamily: Fonts.extraBold, color: Colors.primary },
  profileName: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  profileSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.primaryLight10,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  editPillTxt: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary },

  // Delete account — quiet destructive text link (least-important action)
  deleteLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  deleteLinkText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.danger },

  versionTxt: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#cbd5e1',
    marginBottom: 8,
  },
});

export default MobileSettingsScreen;
