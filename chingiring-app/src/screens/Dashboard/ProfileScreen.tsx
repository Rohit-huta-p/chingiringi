import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { profileAPI } from '../../api/profile';

const FALLBACK_PROFILE = {
  name: 'Dev Chavan',
  memberSince: '2024',
  email: 'dev.chavan@email.com',
  phone: '+91 98765 43210',
  location: 'Mumbai, India',
};

const FALLBACK_WALLET_STATS = [
  { label: 'CONFIRMED', amount: '\u20B91250', accentColor: '#10b981', link: 'Withdraw \u2192' },
  { label: 'PENDING', amount: '\u20B9450', accentColor: '#f59e0b', link: 'Processing \u2192' },
  { label: 'COINS', amount: '840', accentColor: '#8b5cf6', link: 'Redeem \u2192' },
];

const QUICK_ACTIONS = ['Manage Addresses', 'Withdraw Money', 'Account Settings'];

const RECENT_ACTIVITY = [
  { store: 'Myntra', timeAgo: '2 days ago', amount: '+\u20B9150', status: 'pending', statusColor: '#f59e0b' },
  { store: 'Amazon', timeAgo: '15 days ago', amount: '+\u20B9300', status: 'confirmed', statusColor: '#10b981' },
  { store: 'Withdrawal to UPI', timeAgo: '20 days ago', amount: '-\u20B9500', status: 'completed', statusColor: '#3b82f6' },
];

const REFERRAL_DATA = {
  totalReferred: 12,
  earnings: '\u20B9600',
  code: 'DEV500',
};

export const ProfileScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const navigation = useNavigation();

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: profileAPI.getProfile,
  });

  const user = profileData?.user;
  const wallet = profileData?.wallet;

  const PROFILE_DATA = user
    ? {
        name: user.name || FALLBACK_PROFILE.name,
        memberSince: user.createdAt
          ? new Date(user.createdAt).getFullYear().toString()
          : FALLBACK_PROFILE.memberSince,
        email: user.email || FALLBACK_PROFILE.email,
        phone: user.phone || FALLBACK_PROFILE.phone,
        location: FALLBACK_PROFILE.location,
      }
    : FALLBACK_PROFILE;

  const WALLET_STATS = wallet
    ? [
        {
          label: 'CONFIRMED',
          amount: `\u20B9${wallet.confirmed ?? 0}`,
          accentColor: '#10b981',
          link: 'Withdraw \u2192',
        },
        {
          label: 'PENDING',
          amount: `\u20B9${wallet.pending ?? 0}`,
          accentColor: '#f59e0b',
          link: 'Processing \u2192',
        },
        {
          label: 'COINS',
          amount: `${wallet.coins ?? 0}`,
          accentColor: '#8b5cf6',
          link: 'Redeem \u2192',
        },
      ]
    : FALLBACK_WALLET_STATS;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { padding: isMobile ? 16 : 24 }]}>
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <Text style={styles.headerTitle}>Profile</Text>

      {/* Profile Header */}
      <Card style={isMobile ? [styles.card, { padding: 12 }] : styles.card}>
        <View style={styles.profileCenter}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar} />
            <View style={styles.cameraIcon}>
              <Text style={styles.cameraIconText}>📷</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{PROFILE_DATA.name}</Text>
          <Text style={styles.memberSince}>Member since {PROFILE_DATA.memberSince}</Text>
        </View>

        <View style={styles.infoRows}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>✉️</Text>
            <Text style={styles.infoText}>{PROFILE_DATA.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📱</Text>
            <Text style={styles.infoText}>{PROFILE_DATA.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{PROFILE_DATA.location}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editProfileLink}
          onPress={() => navigation.navigate('EditProfile' as never)}
        >
          <Text style={styles.editProfileText}>✏️ Edit Profile</Text>
        </TouchableOpacity>
      </Card>

      {/* Wallet Stats */}
      <View style={[styles.walletRow, isMobile && { flexDirection: 'column' }]}>
        {WALLET_STATS.map((stat) => (
          <Card key={stat.label} style={styles.walletCard}>
            <View style={[styles.walletAccent, { backgroundColor: stat.accentColor }]} />
            <Text style={styles.walletLabel}>{stat.label}</Text>
            <Text style={styles.walletAmount}>{stat.amount}</Text>
            <TouchableOpacity>
              <Text style={[styles.walletLink, { color: stat.accentColor }]}>{stat.link}</Text>
            </TouchableOpacity>
          </Card>
        ))}
      </View>

      {/* Referral Program */}
      <View style={[styles.referralCard, isMobile && { padding: 16 }]}>
        <View style={styles.referralHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralTitle}>Referral Program</Text>
            <Text style={styles.referralSubtitle}>Earn \u20B950 for every friend</Text>
          </View>
          <Text style={styles.qrIcon}>📱</Text>
        </View>

        <View style={styles.referralStatsRow}>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatLabel}>Total Referred</Text>
            <Text style={styles.referralStatValue}>{REFERRAL_DATA.totalReferred}</Text>
          </View>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatLabel}>Earnings</Text>
            <Text style={styles.referralStatValue}>{REFERRAL_DATA.earnings}</Text>
          </View>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatLabel}>Your Code</Text>
            <Text style={styles.referralStatValue}>{REFERRAL_DATA.code}</Text>
          </View>
        </View>

        <TouchableOpacity>
          <Text style={styles.referralLink}>View Details ›</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <Card style={styles.card}>
        {QUICK_ACTIONS.map((action, index) => (
          <React.Fragment key={action}>
            <TouchableOpacity style={styles.actionItem}>
              <Text style={styles.actionItemText}>{action}</Text>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
            {index < QUICK_ACTIONS.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </Card>

      {/* Recent Activity */}
      <View style={styles.activityHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>
      <Card style={styles.card}>
        {RECENT_ACTIVITY.map((item, index) => (
          <React.Fragment key={item.store}>
            <View style={styles.activityItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityStore}>{item.store}</Text>
                <Text style={styles.activityTime}>{item.timeAgo}</Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={styles.activityAmount}>{item.amount}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
                </View>
              </View>
            </View>
            {index < RECENT_ACTIVITY.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 24,
  },
  card: {
    padding: 16,
    marginBottom: 24,
    borderRadius: 12,
  },
  profileCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#cbd5e1',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: {
    fontSize: 14,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoRows: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
  },
  editProfileLink: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  walletRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  walletCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  walletAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  walletLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  walletAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  walletLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  referralCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  referralSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  qrIcon: {
    fontSize: 28,
  },
  referralStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  referralStat: {},
  referralStatLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  referralLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  actionItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 24,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activityStore: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
