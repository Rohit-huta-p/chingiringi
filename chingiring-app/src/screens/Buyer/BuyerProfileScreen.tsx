/**
 * BuyerProfileScreen — Profile tab for buyers.
 *
 * Shows:
 *   - Avatar + name (gradient header via MobileProfileHeader)
 *   - Following count + followed stores list (hydrated from GET /users/me/following)
 *   - Referral code card with copy/share
 *   - Quick settings links
 */
import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Share2,
  Gift,
  ChevronRight,
  Settings,
  Store,
  UserCheck,
  Shield,
  FileText,
  HelpCircle,
  Info,
  MessageCircle,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { useFollowStore } from '../../hooks/useFollow';
import { followsAPI } from '../../api/follows';
import { MobileProfileHeader } from '../../components/MobileProfileHeader';
import { referralsAPI } from '../../api/referrals';

// ─── Helpers ────────────────────────────────────────────────────────────────

function initialsFor(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Followed store card (horizontal list) ──────────────────────────────────

interface FollowedStore {
  _id: string;
  name: string;
  logoUrl?: string;
  category?: string;
}

const FollowedStoreCard: React.FC<{
  store: FollowedStore;
  onPress: () => void;
}> = ({ store, onPress }) => (
  <TouchableOpacity style={s.storeCard} activeOpacity={0.85} onPress={onPress}>
    <View style={s.storeAvatar}>
      {store.logoUrl ? (
        <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Text style={s.storeInitial}>{store.name[0]?.toUpperCase()}</Text>
      )}
    </View>
    <Text style={s.storeName} numberOfLines={2}>{store.name}</Text>
    {store.category ? <Text style={s.storeCategory} numberOfLines={1}>{store.category}</Text> : null}
  </TouchableOpacity>
);

// ─── Section header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <Text style={s.sectionLabel}>{label}</Text>
);

// ─── Quick action row ─────────────────────────────────────────────────────

const ActionRow: React.FC<{
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}> = ({ icon: Icon, iconColor, iconBg, title, subtitle, onPress }) => (
  <TouchableOpacity style={s.actionRow} activeOpacity={0.85} onPress={onPress}>
    <View style={[s.actionIcon, { backgroundColor: iconBg }]}>
      <Icon size={18} color={iconColor} strokeWidth={2} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.actionTitle}>{title}</Text>
      {subtitle ? <Text style={s.actionSub} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
  </TouchableOpacity>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export const BuyerProfileScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);
  const { followedIds, hydrateFollowedIds } = useFollowStore();
  const qc = useQueryClient();

  // Hydrate followed IDs from backend on first mount
  useEffect(() => {
    if (user) hydrateFollowedIds();
  }, [user, hydrateFollowedIds]);

  // Fetch the full store objects for followed stores (for name + logo display)
  const {
    data: followedStores = [],
    isLoading: loadingStores,
    refetch: refetchStores,
    isRefetching,
  } = useQuery({
    queryKey: ['following'],
    queryFn: followsAPI.getFollowing,
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: referralStats } = useQuery({
    queryKey: ['referralStats'],
    queryFn: referralsAPI.getStats,
    enabled: !!user,
  });
  const referralCount = referralStats?.data?.confirmedCount ?? 0;
  const referralCode = user?.referralCode ?? '';

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try { await navigator.clipboard.writeText(referralCode); } catch { /* */ }
      return;
    }
    Alert.alert('Your referral code', referralCode, [{ text: 'OK' }]);
  }, [referralCode]);

  const handleShareCode = useCallback(async () => {
    if (!referralCode) return;
    const base = process.env.EXPO_PUBLIC_SHARE_BASE ?? 'https://chingiringi-backend.onrender.com';
    try {
      await Share.share({
        message: `Join Chingiringi with my code ${referralCode} and get ₹5 to start! ${base}/r/${referralCode}`,
      });
    } catch { /* user cancelled */ }
  }, [referralCode]);

  const handleStorePress = useCallback((store: FollowedStore) => {
    nav.navigate('SellerProfile', { storeId: store._id, store });
  }, [nav]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      refetchStores(),
      qc.invalidateQueries({ queryKey: ['referralStats'] }),
    ]);
  }, [refetchStores, qc]);

  const followingCount = followedStores.length || followedIds.size;

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <MobileProfileHeader
          name={user?.name ?? 'Guest'}
          avatarUrl={user?.avatarUrl}
          onEditPress={() => nav.navigate('EditProfile')}
          onSettingsPress={() => nav.navigate('Settings')}
        />

        <View style={s.body}>
          {/* ── Stats strip ───────────────────────────────────────────── */}
          <View style={s.statsStrip}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{followingCount}</Text>
              <Text style={s.statLabel}>Following</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{referralCount}</Text>
              <Text style={s.statLabel}>Referrals</Text>
            </View>
          </View>

          {/* ── Followed stores ───────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <View style={s.sectionIcon}>
                <Store size={14} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <SectionHeader label={`Stores You Follow (${followingCount})`} />
            </View>

            {loadingStores ? (
              <View style={s.loader}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : followedStores.length === 0 ? (
              <View style={s.emptyFollowing}>
                <UserCheck size={32} color={Colors.border} />
                <Text style={s.emptyFollowingText}>
                  {user
                    ? "You haven't followed any stores yet.\nFind stores on the Live or Stores tab."
                    : 'Sign in to see your followed stores.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={followedStores as FollowedStore[]}
                keyExtractor={(item) => item._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.storeList}
                renderItem={({ item }) => (
                  <FollowedStoreCard
                    store={item}
                    onPress={() => handleStorePress(item)}
                  />
                )}
              />
            )}
          </View>

          {/* ── Referral card ─────────────────────────────────────────── */}
          <LinearGradient
            colors={['#0F172A', '#1E293B', '#1E3A5F']}
            locations={[0.04, 0.59, 0.96]}
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
                <Text style={s.referralSubtitle}>Earn ₹25 · your friend gets ₹5</Text>
              </View>
            </View>

            <View style={s.referralStats}>
              <View style={s.referralStatBox}>
                <Text style={s.referralStatLabel}>REFERRED</Text>
                <Text style={s.referralStatValue}>{referralCount}</Text>
              </View>
            </View>

            <View style={s.referralCodeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.referralStatLabel}>YOUR CODE</Text>
                <Text style={s.referralCode}>{referralCode || '—'}</Text>
              </View>
              <TouchableOpacity style={s.referralIconBtn} onPress={handleCopyCode}>
                <Copy size={16} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity style={s.referralIconBtnPrimary} onPress={handleShareCode}>
                <Share2 size={16} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ── Support & legal ───────────────────────────────────────── */}
          <SectionHeader label="SUPPORT & LEGAL" />
          <ActionRow
            icon={HelpCircle}
            iconColor="#a78bfa"
            iconBg="#f5f3ff"
            title="Help & Support"
            subtitle="FAQs and contact"
          />
          <ActionRow
            icon={Info}
            iconColor="#3b82f6"
            iconBg="#eff6ff"
            title="About Chingiringi"
            subtitle="Our story and mission"
          />
          <ActionRow
            icon={Shield}
            iconColor="#ef4444"
            iconBg="#fee2e2"
            title="Privacy Policy"
          />
          <ActionRow
            icon={FileText}
            iconColor="#f59e0b"
            iconBg="#fef3c7"
            title="Terms & Conditions"
          />
          <ActionRow
            icon={MessageCircle}
            iconColor="#16a34a"
            iconBg="#dcfce7"
            title="Contact Us"
          />
          <ActionRow
            icon={Settings}
            iconColor="#64748b"
            iconBg="#f1f5f9"
            title="Settings"
            onPress={() => nav.navigate('Settings')}
          />
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },
  statValue: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.textSecondary, marginTop: 2 },

  // Followed stores section
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },

  loader: { alignItems: 'center', paddingVertical: 20 },

  emptyFollowing: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  emptyFollowingText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  storeList: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },

  storeCard: {
    width: 88,
    alignItems: 'center',
    gap: 6,
  },
  storeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeInitial: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.primary,
  },
  storeName: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  storeCategory: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Referral card (navy gradient)
  referralCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  referralGiftBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralTitle: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  referralSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },

  referralStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  referralStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 10,
  },
  referralStatLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  referralStatValue: { color: '#fff', fontSize: 18, fontFamily: Fonts.extraBold },

  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
  },
  referralCode: {
    color: '#fff',
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: 2,
    marginTop: 2,
  },
  referralIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralIconBtnPrimary: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  actionSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});

export default BuyerProfileScreen;
