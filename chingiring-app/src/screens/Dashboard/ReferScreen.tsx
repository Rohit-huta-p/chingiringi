import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store';
import { walletAPI } from '../../api/wallet';

const SHARE_OPTIONS = [
  { label: 'WhatsApp', color: '#25D366', icon: 'W' },
  { label: 'Telegram', color: '#0088cc', icon: 'T' },
  { label: 'SMS', color: '#1e3a5f', icon: 'S' },
  { label: 'More', color: '#9ca3af', icon: '...' },
];

const STEPS = [
  { step: '01', title: 'Share your code', description: 'Send your unique referral link to friends' },
  { step: '02', title: 'They sign up', description: 'Friend registers and places their first order' },
  { step: '03', title: 'You earn ₹50', description: 'Cashback credited to your wallet instantly' },
];

export const ReferScreen = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const REFERRAL_CODE = user?.referralCode || 'SHARE50';

  const { data: txData } = useQuery({
    queryKey: ['transactions', 'referral'],
    queryFn: () => walletAPI.getTransactions({ type: 'referral', limit: 100 }),
    enabled: isAuthenticated,
  });

  const referralTransactions = txData?.data?.transactions ?? [];
  const referralCount = referralTransactions.length;
  const referralEarned = referralTransactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

  const leftColumn = (
    <View style={isWide ? styles.column : undefined}>
      {/* Referral Code Card */}
      <Card style={styles.card}>
        <View style={styles.referralHeader}>
          <View>
            <Text style={styles.cardTitle}>Your Referral Code</Text>
            <Text style={styles.cardSubtitle}>Share this code and earn ₹50 per friend</Text>
          </View>
          <Text style={styles.giftIcon}>{'\u{1F381}'}</Text>
        </View>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{REFERRAL_CODE}</Text>
            <TouchableOpacity style={styles.copyButton} activeOpacity={0.7}>
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.shareViaLabel}>SHARE VIA</Text>
        <View style={styles.shareRow}>
          {SHARE_OPTIONS.map((option) => (
            <TouchableOpacity key={option.label} style={styles.shareOption} activeOpacity={0.7}>
              <View style={[styles.shareCircle, { backgroundColor: option.color }]}>
                <Text style={styles.shareCircleText}>{option.icon}</Text>
              </View>
              <Text style={styles.shareLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Share Referral Link →"
          onPress={() => {}}
          style={styles.shareButton}
        />
      </Card>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>{'\u{1F465}'}</Text>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{referralCount} Friends joined</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statIcon}>{'\u{1F4B0}'}</Text>
          <Text style={styles.statLabel}>Earned</Text>
          <Text style={styles.statValue}>{'\u20B9'}{referralEarned} From referrals</Text>
        </Card>
      </View>
    </View>
  );

  const rightColumn = (
    <View style={isWide ? styles.column : undefined}>
      {/* How It Works */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        {STEPS.map((item, index) => (
          <View key={item.step} style={[styles.stepRow, index < STEPS.length - 1 && styles.stepDivider]}>
            <View style={styles.stepNumberCircle}>
              <Text style={styles.stepNumber}>{item.step}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Per Referral Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{'\u20B9'}50 per referral</Text>
        <Text style={styles.infoSubtitle}>No limit on earnings</Text>
        <Text style={styles.infoBody}>
          Earn {'\u20B9'}50 for every friend who signs up and completes their first purchase. Credited within 24 hours.
        </Text>
      </View>

      {/* Recent Invites */}
      <Card style={styles.card}>
        <View style={styles.invitesHeader}>
          <Text style={styles.cardTitle}>Recent Invites</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F464}'}</Text>
          <Text style={styles.emptyTitle}>No invites yet</Text>
          <Text style={styles.emptySubtitle}>Start sharing to see activity</Text>
        </View>
      </Card>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>GROW TOGETHER</Text>
          <Text style={styles.headerTitle}>Refer & Earn</Text>
        </View>
        <View style={styles.earnedBadge}>
          <View style={styles.earnedAvatar} />
          <Text style={styles.earnedText}>{'\u20B9'}{referralEarned} earned</Text>
        </View>
      </View>

      {/* Content */}
      <View style={isWide ? styles.twoColumns : undefined}>
        {leftColumn}
        {rightColumn}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  earnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  earnedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#a7f3d0',
    marginRight: 8,
  },
  earnedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  giftIcon: {
    fontSize: 28,
  },
  codeBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 14,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 3,
  },
  copyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  shareViaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
    marginBottom: 16,
  },
  shareOption: {
    alignItems: 'center',
  },
  shareCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  shareCircleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shareLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  shareButton: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  stepDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  invitesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
