/**
 * BuyerProfileScreen — Profile tab for buyers.
 *
 * Mockup: https://claude.ai/code/artifact/47ecc858-95b6-400b-b6e2-1f889bea5068
 *
 * The mockup restructures this screen as an account/settings list (flat
 * navbar, account card, Account/Notifications/Linked/App sections, "Open a
 * Store" upgrade CTA, Sign Out) with no stats row and no followed-stores or
 * referral UI. Implemented as shown, but the followed-stores list and
 * referral card are kept — they're real, already-working features backed
 * by live data (GET /users/me/following, referralsAPI) with no replacement
 * anywhere else in the app; the mockup omitting them reads as scope, not an
 * instruction to remove them. Two things intentionally aren't wired to a
 * real endpoint and are called out where they appear: the notification
 * toggles (backend only exposes cashback/withdrawals/push prefs, not
 * per-category ones) and any row whose mockup subtitle would need a field
 * (location, interests) that isn't on UserType.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
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
  Shield,
  FileText,
  HelpCircle,
  Info,
  MessageCircle,
  Pencil,
  User,
  Mail,
  Phone,
  LogOut,
  Star,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { useFollowStore } from '../../hooks/useFollow';
import { followsAPI } from '../../api/follows';
import { referralsAPI } from '../../api/referrals';
import apiClient from '../../api/client';
import { navigationRef } from '../../lib/navigationRef';

// ─── Helpers ────────────────────────────────────────────────────────────────

function initialsFor(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Same retry-until-ready pattern RoleSelectionScreen uses for its own role
// switch — reused here so "Open a Store" is a real one-tap upgrade instead
// of just linking back to a screen with no route to navigate to (Role
// Selection isn't a registered route; RootNavigator renders it purely from
// user.role being unset).
function navigateWhenReady(routeName: string, maxAttempts = 8, baseDelayMs = 100) {
  let attempt = 0;
  const tryNavigate = () => {
    attempt += 1;
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeName as never);
    } else if (attempt < maxAttempts) {
      setTimeout(tryNavigate, baseDelayMs * attempt);
    }
  };
  setTimeout(tryNavigate, baseDelayMs);
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

// ─── Section label ──────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={s.sectionLabel}>{label}</Text>
);

// ─── List row (Account / App sections) ──────────────────────────────────────

const ListRow: React.FC<{
  icon: any;
  iconBg: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}> = ({ icon: Icon, iconBg, title, subtitle, right, onPress }) => (
  <TouchableOpacity style={s.listRow} activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
    <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
      <Icon size={16} color={Colors.text} strokeWidth={2} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle}>{title}</Text>
      {subtitle ? <Text style={s.rowSub} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    {right ?? (onPress ? <ChevronRight size={16} color="#cbd5e1" /> : null)}
  </TouchableOpacity>
);

// ─── Inline toggle (visual only — see file header note) ─────────────────────

const InlineToggle: React.FC<{ value: boolean; onToggle: () => void }> = ({ value, onToggle }) => (
  <Pressable onPress={onToggle} style={[s.toggle, !value && s.toggleOff]}>
    <View style={[s.toggleKnob, !value && s.toggleKnobOff]} />
  </Pressable>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export const BuyerProfileScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const user = useAuthStore((st) => st.user);
  const logout = useAuthStore((st) => st.logout);
  const { followedIds, hydrateFollowedIds } = useFollowStore();
  const qc = useQueryClient();

  // Notification toggles are local-only (see file header) — no per-category
  // preference field exists on the backend yet.
  const [liveStreamNotifs, setLiveStreamNotifs] = useState(true);
  const [storeUpdateNotifs, setStoreUpdateNotifs] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (user) hydrateFollowedIds();
  }, [user, hydrateFollowedIds]);

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

  const handleOpenStore = useCallback(async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      await apiClient.patch('/api/profile/role', { role: 'seller' });
      useAuthStore.getState().setRole('seller');
      navigateWhenReady('BusinessOnboarding');
    } catch (err: any) {
      Alert.alert('Could not open a store', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
    } finally {
      setUpgrading(false);
    }
  }, [upgrading]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  const followingCount = followedStores.length || followedIds.size;

  return (
    <View style={s.root}>
      {/* Flat navbar */}
      <View style={s.navbar}>
        <Text style={s.navbarTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={s.body}>
          {/* ── Account card ──────────────────────────────────────────── */}
          <View style={s.accountCard}>
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={s.acctAvatar}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={s.acctAvatarText}>{initialsFor(user?.name)}</Text>
              )}
              <TouchableOpacity style={s.acctAvatarEdit} onPress={() => nav.navigate('EditProfile')} hitSlop={6}>
                <Pencil size={10} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={s.acctInfo}>
              <Text style={s.acctName} numberOfLines={1}>{user?.name ?? 'Guest'}</Text>
              {!!user?.email && <Text style={s.acctEmail} numberOfLines={1}>{user.email}</Text>}
              <View style={s.acctRolePill}>
                <Text style={s.acctRolePillText}>🛍️ Buyer</Text>
              </View>
            </View>
            <TouchableOpacity style={s.editBtn} onPress={() => nav.navigate('EditProfile')} accessibilityLabel="Edit profile">
              <Pencil size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Account ───────────────────────────────────────────────── */}
          <SectionLabel label="Account" />
          <View style={s.sectionCard}>
            <ListRow icon={User} iconBg="#EBF2FF" title="Personal Info" subtitle="Name, phone number" onPress={() => nav.navigate('EditProfile')} />
          </View>

          {/* ── Stores you follow — kept; real data, no equivalent elsewhere ── */}
          <SectionLabel label={`Stores You Follow (${followingCount})`} />
          <View style={[s.sectionCard, s.followCard]}>
            {loadingStores ? (
              <View style={s.loader}><ActivityIndicator color={Colors.primary} /></View>
            ) : followedStores.length === 0 ? (
              <View style={s.emptyFollowing}>
                <Store size={28} color={Colors.border} />
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
                  <FollowedStoreCard store={item} onPress={() => handleStorePress(item)} />
                )}
              />
            )}
          </View>

          {/* ── Notifications (visual toggles — see file header note) ──── */}
          <SectionLabel label="Notifications" />
          <View style={s.sectionCard}>
            <ListRow
              icon={Star} iconBg="#FFF7ED" title="Live Streams" subtitle="When a followed store goes live"
              right={<InlineToggle value={liveStreamNotifs} onToggle={() => setLiveStreamNotifs((v) => !v)} />}
            />
            <ListRow
              icon={Store} iconBg="#F0FDF4" title="Store Updates" subtitle="New products from followed stores"
              right={<InlineToggle value={storeUpdateNotifs} onToggle={() => setStoreUpdateNotifs((v) => !v)} />}
            />
          </View>

          {/* ── Linked accounts — real values only, no fabricated "Connected" status ── */}
          {(!!user?.email || !!user?.phone) && (
            <>
              <SectionLabel label="Linked Accounts" />
              <View style={s.sectionCard}>
                {!!user?.email && <ListRow icon={Mail} iconBg="#F1F5F9" title="Email" subtitle={user.email} />}
                {!!user?.phone && <ListRow icon={Phone} iconBg="#F0FDF4" title="Phone" subtitle={user.phone} />}
              </View>
            </>
          )}

          {/* ── Referral card — kept; real, working growth feature ──────── */}
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

          {/* ── App ───────────────────────────────────────────────────── */}
          <SectionLabel label="App" />
          <View style={s.sectionCard}>
            <ListRow icon={HelpCircle} iconBg="#f5f3ff" title="Help & Support" onPress={() => {}} />
            <ListRow icon={Info} iconBg="#eff6ff" title="About Chingiringi" onPress={() => {}} />
            <ListRow icon={Shield} iconBg="#fee2e2" title="Privacy Policy" onPress={() => {}} />
            <ListRow icon={FileText} iconBg="#fef3c7" title="Terms & Conditions" onPress={() => {}} />
            <ListRow icon={MessageCircle} iconBg="#dcfce7" title="Contact Us" onPress={() => {}} />
            <ListRow icon={Settings} iconBg="#f1f5f9" title="Settings" onPress={() => nav.navigate('Settings')} />
          </View>

          {/* ── Open a Store CTA ──────────────────────────────────────── */}
          <Pressable onPress={handleOpenStore} disabled={upgrading} style={s.openStore}>
            <View style={s.openStoreIcon}>
              {upgrading ? <ActivityIndicator size="small" color={Colors.orange} /> : <Store size={20} color={Colors.orange} />}
            </View>
            <View style={s.openStoreText}>
              <Text style={s.openStoreTitle}>Open your own store</Text>
              <Text style={s.openStoreSub}>List products, go live, and reach buyers near you</Text>
            </View>
            <ChevronRight size={16} color={Colors.orange} />
          </Pressable>

          {/* ── Sign out ──────────────────────────────────────────────── */}
          <Pressable onPress={handleSignOut} style={s.signoutBtn}>
            <LogOut size={16} color={Colors.danger} />
            <Text style={s.signoutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  navbar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingVertical: 13 },
  navbarTitle: { fontSize: 19, fontFamily: Fonts.extraBold, color: Colors.text },

  body: { paddingHorizontal: 16, paddingTop: 14 },

  // Account card
  accountCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
  },
  acctAvatar: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  acctAvatarText: { fontFamily: Fonts.extraBold, fontSize: 20, color: '#fff' },
  acctAvatarEdit: {
    position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  acctInfo: { flex: 1, minWidth: 0 },
  acctName: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 2 },
  acctEmail: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 6 },
  acctRolePill: { alignSelf: 'flex-start', backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  acctRolePillText: { fontSize: 11, fontFamily: Fonts.bold, color: '#7c3aed' },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 4, paddingLeft: 2 },
  sectionCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  rowSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },

  toggle: { width: 40, height: 23, borderRadius: 12, backgroundColor: Colors.success, padding: 3, justifyContent: 'center' },
  toggleOff: { backgroundColor: Colors.border },
  toggleKnob: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#fff', alignSelf: 'flex-end' },
  toggleKnobOff: { alignSelf: 'flex-start' },

  followCard: { paddingVertical: 4 },
  loader: { alignItems: 'center', paddingVertical: 20 },
  emptyFollowing: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 20 },
  emptyFollowingText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  storeList: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  storeCard: { width: 84, alignItems: 'center', gap: 6 },
  storeAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryLight10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  storeInitial: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.primary },
  storeName: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.text, textAlign: 'center', lineHeight: 14 },
  storeCategory: { fontSize: 10, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  // Referral card (navy gradient)
  referralCard: { borderRadius: 18, padding: 16, marginBottom: 16 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  referralGiftBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(167,139,250,0.18)', justifyContent: 'center', alignItems: 'center' },
  referralTitle: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  referralSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  referralStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  referralStatBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 },
  referralStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 4 },
  referralStatValue: { color: '#fff', fontSize: 18, fontFamily: Fonts.extraBold },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 },
  referralCode: { color: '#fff', fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: 2, marginTop: 2 },
  referralIconBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  referralIconBtnPrimary: { width: 34, height: 34, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },

  // Open a Store CTA
  openStore: {
    backgroundColor: 'rgba(249,115,22,0.05)', borderWidth: 1.5, borderColor: '#fed7aa', borderStyle: 'dashed',
    borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  openStoreIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  openStoreText: { flex: 1 },
  openStoreTitle: { fontSize: 14, fontFamily: Fonts.bold, color: '#c2410c', marginBottom: 2 },
  openStoreSub: { fontSize: 11.5, fontFamily: Fonts.regular, color: '#9a3412', lineHeight: 16 },

  signoutBtn: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  signoutText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.danger },
});

export default BuyerProfileScreen;
