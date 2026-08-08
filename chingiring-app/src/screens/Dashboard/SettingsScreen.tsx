import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import {
  Bell, ShieldCheck, LifeBuoy, UserCog, Lock, LogOut, ChevronRight,
  IndianRupee, Banknote, Users, Mail, HelpCircle, FileText, ScrollText, Star,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ChangePasswordModal } from '../../components/ChangePasswordModal';
import { SettingsSection, SettingRow, SettingToggle, Tint } from '../../components/SettingsList';
import { profileAPI } from '../../api/profile';
import { notificationsAPI } from '../../api/notifications';
import { registerForPush, unregisterForPush } from '../../lib/push';

// ---------------------------------------------------------------------------
// SettingsScreen (desktop / wide web)
// ---------------------------------------------------------------------------

export const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.getProfile(),
  });
  const user = profileData?.data?.user;
  const prefs = user?.notificationPrefs;

  // Notification toggle states
  const [cashbackUpdates, setCashbackUpdates] = useState(true);
  const [referralUpdates, setReferralUpdates] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [withdrawalUpdates, setWithdrawalUpdates] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    if (prefs) {
      setCashbackUpdates(prefs.cashback !== false);
      setWithdrawalUpdates(prefs.withdrawals !== false);
      setPushEnabled(prefs.push !== false);
    }
  }, [prefs]);

  const savePref = (patch: { cashback?: boolean; withdrawals?: boolean; push?: boolean }) => {
    notificationsAPI.updatePrefs(patch).catch((e: any) => console.warn('updatePrefs failed:', e?.message));
  };
  const onToggleCashback = (v: boolean) => { setCashbackUpdates(v); savePref({ cashback: v }); };
  const onToggleWithdrawals = (v: boolean) => { setWithdrawalUpdates(v); savePref({ withdrawals: v }); };
  const onTogglePush = (v: boolean) => {
    setPushEnabled(v);
    savePref({ push: v });
    if (v) registerForPush(); else unregisterForPush();
  };

  // Modal states
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const deleteAccountMutation = useMutation({
    mutationFn: profileAPI.deleteAccount,
    onSuccess: async () => {
      setDeleteModalVisible(false);
      await useAuthStore.getState().logout();
    },
    onError: () => {
      setDeleteModalVisible(false);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    },
  });

  const handleLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.column}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>ACCOUNT</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>

          {/* Profile strip */}
          {user && (
            <TouchableOpacity
              style={styles.profileStrip}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.75}
            >
              <View style={styles.profileAvatar}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.profileAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.profileAvatarTxt}>
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileSub}>{user.email || user.phone || 'Edit profile →'}</Text>
              </View>
              <View style={styles.editPill}>
                <Text style={styles.editPillTxt}>Edit</Text>
                <ChevronRight size={14} color={Colors.primary} strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          )}

          {/* Notifications */}
          <SettingsSection title="Notifications" icon={Bell} {...Tint.primary}>
            <SettingToggle
              icon={IndianRupee} {...Tint.green}
              label="Cashback Updates"
              sublabel="When cashback is confirmed"
              value={cashbackUpdates}
              onValueChange={onToggleCashback}
            />
            <SettingToggle
              icon={Banknote} {...Tint.blue}
              label="Withdrawal Updates"
              sublabel="Submitted, paid or rejected"
              value={withdrawalUpdates}
              onValueChange={onToggleWithdrawals}
            />
            <SettingToggle
              icon={Bell} {...Tint.primary}
              label="Push Notifications"
              sublabel="Get alerts on your device"
              value={pushEnabled}
              onValueChange={onTogglePush}
            />
            <SettingToggle
              icon={Users} {...Tint.purple}
              label="Referral Updates"
              sublabel="Updates about your referrals"
              value={referralUpdates}
              onValueChange={setReferralUpdates}
            />
            <SettingToggle
              icon={Mail} {...Tint.amber}
              label="Email Notifications"
              sublabel="Receive updates via email"
              value={emailNotifications}
              onValueChange={setEmailNotifications}
            />
          </SettingsSection>

          {/* Security & Privacy */}
          <SettingsSection title="Security & Privacy" icon={ShieldCheck} {...Tint.purple}>
            <SettingRow
              icon={Lock} {...Tint.slate}
              label="Change Password"
              sublabel="Reset via email code"
              onPress={() => setChangePwOpen(true)}
            />
          </SettingsSection>

          {/* Support */}
          <SettingsSection title="Support" icon={LifeBuoy} {...Tint.teal}>
            <SettingRow icon={HelpCircle} {...Tint.sky} label="Help & Support" onPress={() => {}} />
            <SettingRow icon={FileText} {...Tint.slate} label="Terms of Service" onPress={() => {}} />
            <SettingRow icon={ScrollText} {...Tint.teal} label="Privacy Policy" onPress={() => {}} />
            <SettingRow icon={Star} {...Tint.amber} label="Rate the App" onPress={() => {}} />
          </SettingsSection>

          {/* Account */}
          <SettingsSection title="Account" icon={UserCog} {...Tint.slate}>
            <SettingRow
              icon={LogOut} {...Tint.slate}
              label="Logout"
              onPress={() => setLogoutModalVisible(true)}
              hideChevron
            />
          </SettingsSection>

          {/* Delete account — quiet, low-emphasis text link */}
          <TouchableOpacity
            style={styles.deleteLink}
            onPress={() => setDeleteModalVisible(true)}
            activeOpacity={0.6}
          >
            <Text style={styles.deleteLinkText}>Delete account</Text>
          </TouchableOpacity>

          <Text style={styles.versionTxt}>ChingiRingi v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      <ConfirmationModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to log out? You will need to sign in again to access your account."
        confirmText="Logout"
        icon="logout"
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={() => deleteAccountMutation.mutate()}
        title="Delete Account"
        message="This action is irreversible. All your data including cashback, coins, and transaction history will be permanently deleted."
        confirmText="Delete Account"
        confirmColor={Colors.danger}
        icon="warning"
      />

      <ChangePasswordModal
        visible={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        email={user?.email}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  // Constrain content on wide screens so cards don't stretch edge-to-edge.
  column: { width: '100%', maxWidth: 640 },

  // Header
  header: { marginBottom: 20, paddingHorizontal: 4 },
  headerLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginTop: 2,
  },

  // Profile strip
  profileStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
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
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14, overflow: 'hidden',
  },
  profileAvatarImg: { width: '100%', height: '100%' },
  profileAvatarTxt: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.primary },
  profileName: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  profileSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.primaryLight10,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
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
  },
});
