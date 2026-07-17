import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Colors, Spacing } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { Card } from '../../components/Card';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { profileAPI } from '../../api/profile';
import { notificationsAPI } from '../../api/notifications';
import { registerForPush, unregisterForPush } from '../../lib/push';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionHeader = ({
  icon,
  title,
  titleColor,
}: {
  icon: string;
  title: string;
  titleColor?: string;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionIcon}>{icon}</Text>
    <Text style={[styles.sectionTitle, titleColor ? { color: titleColor } : undefined]}>
      {title}
    </Text>
  </View>
);

const ToggleItem = ({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={styles.toggleItem}>
    <View style={styles.toggleTextBlock}>
      <Text style={styles.toggleTitle}>{title}</Text>
      <Text style={styles.toggleSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#e2e8f0', true: Colors.primary }}
      thumbColor="#ffffff"
    />
  </View>
);

const ListItem = ({
  icon,
  title,
  rightLabel,
  onPress,
}: {
  icon: string;
  title: string;
  rightLabel?: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={styles.listItem}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    <View style={styles.listItemLeft}>
      <Text style={styles.listItemIcon}>{icon}</Text>
      <Text style={styles.listItemTitle}>{title}</Text>
    </View>
    <View style={styles.listItemRight}>
      {rightLabel ? <Text style={styles.listItemLabel}>{rightLabel}</Text> : null}
      <Text style={styles.chevron}>{'›'}</Text>
    </View>
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export const SettingsScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { logout } = useAuthStore();

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileAPI.getProfile(),
  });
  const prefs = profileData?.data?.user?.notificationPrefs;

  // Notification toggle states
  const [cashbackUpdates, setCashbackUpdates] = useState(true);
  const [dealAlerts, setDealAlerts] = useState(true);
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

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: isMobile ? 16 : Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backArrow}>{'←'}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>ACCOUNT</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
        </View>

        {/* Notifications */}
        <Card style={styles.card}>
          <SectionHeader icon="🔔" title="Notifications" />
          <ToggleItem
            title="Cashback Updates"
            subtitle="Get notified when cashback is confirmed"
            value={cashbackUpdates}
            onValueChange={onToggleCashback}
          />
          <View style={styles.divider} />
          <ToggleItem
            title="Withdrawal Updates"
            subtitle="When a withdrawal is submitted, paid, or rejected"
            value={withdrawalUpdates}
            onValueChange={onToggleWithdrawals}
          />
          <View style={styles.divider} />
          <ToggleItem
            title="Push Notifications"
            subtitle="Get alerts on your device"
            value={pushEnabled}
            onValueChange={onTogglePush}
          />
          <View style={styles.divider} />
          <ToggleItem
            title="Deal Alerts"
            subtitle="Notify about new deals and offers"
            value={dealAlerts}
            onValueChange={setDealAlerts}
          />
          <View style={styles.divider} />
          <ToggleItem
            title="Referral Updates"
            subtitle="Updates about your referrals"
            value={referralUpdates}
            onValueChange={setReferralUpdates}
          />
          <View style={styles.divider} />
          <ToggleItem
            title="Email Notifications"
            subtitle="Receive updates via email"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
          />
        </Card>

        {/* Security & Privacy */}
        <Card style={styles.card}>
          <SectionHeader icon="🛡️" title="Security & Privacy" />
          <ListItem icon="🔒" title="Change Password" onPress={() => {}} />
          <View style={styles.divider} />
          <ListItem
            icon="📱"
            title="Two-Factor Authentication"
            rightLabel="Disabled"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <ListItem icon="🔗" title="Linked Accounts" onPress={() => {}} />
        </Card>

        {/* Account Actions */}
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => setLogoutModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.listItemLeft}>
              <Text style={styles.listItemIcon}>🚪</Text>
              <Text style={[styles.listItemTitle, { color: Colors.danger }]}>Logout</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Danger Zone */}
        <Card style={[styles.card, styles.dangerCard]}>
          <SectionHeader icon="⚠️" title="Danger Zone" titleColor={Colors.danger} />
          <Text style={styles.dangerText}>
            Once you delete your account, there is no going back. All your data including
            cashback, coins, and transaction history will be permanently deleted.
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setDeleteModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </Card>
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
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="This action is irreversible. All your data including cashback, coins, and transaction history will be permanently deleted."
        confirmText="Delete Account"
        confirmColor={Colors.danger}
        icon="warning"
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backArrow: {
    fontSize: 20,
    color: Colors.text,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },

  // Card
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 12,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },

  // Toggle item
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleTextBlock: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // List item
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Danger zone
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
