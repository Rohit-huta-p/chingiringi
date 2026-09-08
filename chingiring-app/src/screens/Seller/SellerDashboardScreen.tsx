/**
 * SellerDashboardScreen — Dashboard tab for sellers.  (Redesign: "A · Stage")
 *
 * Fetches the seller's store (GET /api/stores/mine) and store stats
 * (GET /api/stores/:id/stats) and renders:
 *   - Compact navy header: store avatar + name (+ verified check) + greeting,
 *     a "Shop" (shop-as-buyer) pill, and a messages bell (unread badge)
 *   - Verification banner (links to StoreVerification if unverified)
 *   - The "Stage" hero — the primary go-live CTA (followers-notified + last
 *     stream), navigates to the GoLive tab
 *   - "Today at a glance": horizontal stat chips (Followers · Views 7d ·
 *     Streams · Products)
 *   - "Pick up where you left off": reply to buyers → Messages, add a product
 *
 * Loading / no-store / pending / rejected states are handled inline here;
 * the fuller per-state screens are tracked separately.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UsersRound,
  Video,
  Package,
  Eye,
  ChevronRight,
  Play,
  MessageCircle,
  ShoppingBag,
  Plus,
  BadgeCheck,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { getUnreadTotal } from '../../api/chat';
import apiClient from '../../api/client';
import { getMyStreams, formatStreamMeta } from '../../api/streams';
import { type SellerStore } from '../../api/verification';
import { useMyStore } from '../../hooks/useMyStore';

// ── API helpers ───────────────────────────────────────────────────────────

interface StoreStats {
  followerCount: number;
  totalStreams: number;
  viewsLast7Days: number;
  totalProducts: number;
}

async function fetchStoreStats(storeId: string): Promise<StoreStats> {
  try {
    const res = await apiClient.get(`/api/stores/${storeId}/stats`);
    // Backend shape is { status, data: { …stats } } — unwrap data, not the whole body.
    return res.data?.data ?? res.data ?? { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 };
  } catch {
    return { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 };
  }
}

const inr = (n: number) => (n ?? 0).toLocaleString('en-IN');

// The seller tab bar (SellerTabNavigator) is position:absolute and overlays
// screen content — so every tab screen must pad its scroll content past it or
// the last rows hide behind the bar. ~64px bar + chrome + a small gap; the
// safe-area inset is added on top at the call site.
const TAB_BAR_CLEARANCE = 90;

// ── Glance chip (horizontal stat strip) ─────────────────────────────────────

const GlanceChip: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({
  icon, value, label,
}) => (
  <View style={styles.chip}>
    {icon}
    <Text style={styles.chipValue}>{value}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

// ── Pick-up action row ──────────────────────────────────────────────────────

const ActionRow: React.FC<{
  icon: React.ReactNode; title: string; sub: string; badge?: number; onPress: () => void;
}> = ({ icon, title, sub, badge, onPress }) => (
  <Pressable style={styles.actionRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
    <View style={styles.actionIcon}>{icon}</View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub} numberOfLines={1}>{sub}</Text>
    </View>
    {badge && badge > 0 ? (
      <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{badge > 9 ? '9+' : badge}</Text></View>
    ) : (
      <ChevronRight size={18} color="#cbd5e1" strokeWidth={2} />
    )}
  </Pressable>
);

// ── Verification banner (single visual treatment; copy adapts to status) ──

const VerifBanner: React.FC<{ status: SellerStore['verificationStatus']; rejectionReason?: string; onPress: () => void }> = ({
  status, rejectionReason, onPress,
}) => {
  if (status === 'verified') return null;

  const text =
    status === 'pending'
      ? 'Your documents are under review'
      : status === 'rejected'
        ? `Verification rejected${rejectionReason ? ` — ${rejectionReason}` : ''}`
        : "Your store isn't verified yet — going live is locked";

  return (
    <Pressable onPress={onPress} style={[styles.banner, status === 'rejected' && styles.bannerRejected]}>
      <Text style={styles.bannerText} numberOfLines={2}>{text}</Text>
      <Text style={styles.bannerLink}>View details →</Text>
    </Pressable>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────

export const SellerDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setViewAsBuyer = useAuthStore((s) => s.setViewAsBuyer);

  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: getUnreadTotal,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const {
    data: store,
    isLoading: storeLoading,
    refetch: refetchStore,
    isRefetching,
  } = useMyStore();

  const { data: stats = { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 } } = useQuery({
    queryKey: ['seller', 'stats', store?._id],
    queryFn: () => fetchStoreStats(store!._id),
    enabled: !!store?._id,
    staleTime: 60_000,
  });

  const { data: recentStreams = [] } = useQuery({
    queryKey: ['seller', 'streams', store?._id],
    queryFn: () => getMyStreams(5),
    enabled: !!store,
    staleTime: 60_000,
  });
  const lastStream = recentStreams[0];

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };
  const isVerified = store?.verificationStatus === 'verified';
  const followers = stats.followerCount ?? 0;

  if (storeLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetchStore}
          colors={[Colors.orange]}
          tintColor={Colors.orange}
        />
      }
    >
      {/* ── Compact header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          {store?.logoUrl ? (
            <Image source={{ uri: store.logoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{(store?.name ?? user?.name ?? 'S').trim()[0]?.toUpperCase() ?? 'S'}</Text>
            </View>
          )}

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.storeName} numberOfLines={1}>{store?.name ?? 'Your store'}</Text>
              {isVerified ? <BadgeCheck size={15} color="#6ee7b7" strokeWidth={2.4} /> : null}
            </View>
            <Text style={styles.greeting} numberOfLines={1}>{greeting()}, {firstName}</Text>
          </View>

          <Pressable
            style={styles.shopPill}
            onPress={() => setViewAsBuyer(true)}
            accessibilityRole="button"
            accessibilityLabel="Shop as a buyer"
          >
            <ShoppingBag size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.shopText}>Shop</Text>
          </Pressable>

          <Pressable
            style={styles.bell}
            onPress={() => navigation.navigate('Messages')}
            accessibilityRole="button"
            accessibilityLabel="Messages"
          >
            <MessageCircle size={18} color="#fff" strokeWidth={2} />
            {chatUnread > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {/* ── Verification banner ── */}
        {store && (
          <VerifBanner
            status={store.verificationStatus}
            rejectionReason={store.verificationDoc?.rejectionReason}
            onPress={() => navigation.navigate('StoreVerification', { store })}
          />
        )}

        {/* ── The Stage (primary go-live CTA) ── */}
        <LinearGradient
          colors={['#15274f', '#0C1A3D', '#5a2a10']}
          locations={[0, 0.46, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.stage}
        >
          <View style={styles.stageGlow} pointerEvents="none" />

          <View style={styles.stageKicker}>
            <View style={styles.stageDot} />
            <Text style={styles.stageKickerText}>STAGE READY</Text>
          </View>

          <Text style={styles.stageTitle}>You're set to{'\n'}go live.</Text>
          <Text style={styles.stageSub}>
            {followers > 0
              ? `${inr(followers)} followers get notified the moment you start.`
              : 'Start a stream and connect with buyers in real time.'}
          </Text>

          <Pressable
            style={styles.goLiveBtn}
            onPress={() => navigation.navigate('GoLive')}
            accessibilityRole="button"
            accessibilityLabel="Go Live"
          >
            <View style={styles.goLiveDot} />
            <Text style={styles.goLiveText}>Go Live Now</Text>
          </Pressable>

          {lastStream ? (
            <View style={styles.lastRow}>
              <Play size={12} color="rgba(255,255,255,0.5)" fill="rgba(255,255,255,0.5)" />
              <Text style={styles.lastText} numberOfLines={1}>
                Last: {lastStream.title || 'Untitled'} · {formatStreamMeta(lastStream)}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* ── Today at a glance ── */}
        <View>
          <Text style={styles.sectionLabel}>Today at a glance</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <GlanceChip icon={<UsersRound size={21} color={Colors.orange} />} value={inr(followers)} label="Followers" />
            <GlanceChip icon={<Eye size={21} color={Colors.orange} />} value={inr(stats.viewsLast7Days)} label="Views · 7d" />
            <GlanceChip icon={<Video size={21} color={Colors.orange} />} value={String(stats.totalStreams ?? 0)} label="Streams" />
            <GlanceChip icon={<Package size={21} color={Colors.orange} />} value={String(stats.totalProducts ?? 0)} label="Products" />
          </ScrollView>
        </View>

        {/* ── Pick up where you left off ── */}
        <View>
          <Text style={styles.sectionLabel}>Pick up where you left off</Text>
          <View style={{ gap: 10 }}>
            <ActionRow
              icon={<MessageCircle size={20} color={Colors.orange} strokeWidth={2} />}
              title="Reply to your buyers"
              sub={chatUnread > 0
                ? `${chatUnread} ${chatUnread === 1 ? 'person is' : 'people are'} waiting`
                : "You're all caught up"}
              badge={chatUnread}
              onPress={() => navigation.navigate('Messages')}
            />
            <ActionRow
              icon={<Plus size={20} color={Colors.orange} strokeWidth={2} />}
              title="Add a new product"
              sub="Keep your shelf fresh for tonight"
              onPress={() => navigation.navigate('MyStore')}
            />
          </View>
        </View>

        {/* ── No store state ── */}
        {!store && (
          <View style={styles.noStore}>
            <Text style={styles.noStoreTitle}>No store yet</Text>
            <Text style={styles.noStoreSub}>Complete store setup to start selling.</Text>
            <Pressable
              style={styles.setupBtn}
              onPress={() => navigation.navigate('BusinessOnboarding')}
            >
              <Text style={styles.setupBtnText}>Set up my store</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, fontFamily: Fonts.extraBold, color: '#fff' },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff', flexShrink: 1 },
  greeting: { fontSize: 11.5, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  shopPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11,
  },
  shopText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
  bell: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.navy,
  },
  bellBadgeText: { fontSize: 9.5, fontFamily: Fonts.extraBold, color: '#fff' },

  body: { padding: 16, gap: 18 },

  // Verification banner
  banner: {
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE047', borderRadius: 12,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 18 },
  bannerLink: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },
  bannerRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

  // Stage hero
  stage: {
    borderRadius: 22, padding: 22, overflow: 'hidden',
    shadowColor: '#0C1A3D', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.38, shadowRadius: 24, elevation: 8,
  },
  stageGlow: {
    position: 'absolute', top: -46, right: -34, width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(249,115,22,0.28)',
  },
  stageKicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  stageDot: {
    width: 9, height: 9, borderRadius: 4.5, backgroundColor: Colors.orange,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
  },
  stageKickerText: { fontSize: 11, fontFamily: Fonts.extraBold, letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  stageTitle: { fontSize: 26, fontFamily: Fonts.extraBold, color: '#fff', lineHeight: 30 },
  stageSub: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.72)', marginTop: 9, lineHeight: 18 },
  goLiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: Colors.orange, borderRadius: 15, paddingVertical: 16, marginTop: 18,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.42, shadowRadius: 18, elevation: 6,
  },
  goLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  goLiveText: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  lastText: { flex: 1, fontSize: 11.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.62)' },

  // Section label
  sectionLabel: {
    fontSize: 11.5, fontFamily: Fonts.bold, letterSpacing: 0.5, textTransform: 'uppercase',
    color: Colors.textSecondary, marginBottom: 11,
  },

  // Glance chips
  chipRow: { gap: 11, paddingRight: 4 },
  chip: {
    minWidth: 120, backgroundColor: Colors.surface, borderRadius: 15, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  chipValue: { fontSize: 23, fontFamily: Fonts.extraBold, color: Colors.navy, marginTop: 9, lineHeight: 26 },
  chipLabel: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary },

  // Pick-up action rows
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 11, backgroundColor: '#FFF1E6',
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  actionSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  actionBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  actionBadgeText: { fontSize: 11, fontFamily: Fonts.extraBold, color: '#fff' },

  // No store
  noStore: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noStoreTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  noStoreSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  setupBtn: {
    marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
