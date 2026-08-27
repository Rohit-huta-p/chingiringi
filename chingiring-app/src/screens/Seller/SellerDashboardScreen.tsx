/**
 * SellerDashboardScreen — Dashboard tab for sellers.
 *
 * Fetches the seller's store (GET /api/stores/mine) and store stats
 * (GET /api/stores/:id/stats) and renders:
 *   - Navy greeting header (time-of-day + first name)
 *   - Verification banner (links to StoreVerification if unverified)
 *   - 2×2 metric tiles: Followers · Streams · Views (7d) · Products
 *   - "Ready to go live?" CTA card (navigates to the GoLive tab)
 *   - Recent Streams (no per-store stream history API yet — shown as an
 *     honest empty state rather than fabricated rows; wire in once
 *     GET /api/streams?storeId= exists)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  UsersRound,
  Video,
  Package,
  Eye,
  Camera,
  ChevronRight,
  Radio,
  ShoppingBag,
  MessageCircle,
  Play,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
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

// ── Metric tile ───────────────────────────────────────────────────────────

const MetricTile: React.FC<{ icon: React.ReactNode; label: string; value: number | string }> = ({
  icon, label, value,
}) => (
  <View style={styles.tile}>
    <View style={styles.tileIcon}>{icon}</View>
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

// ── Verification banner (single visual treatment; copy adapts to status) ──

const VerifBanner: React.FC<{ status: SellerStore['verificationStatus']; rejectionReason?: string; onPress: () => void }> = ({
  status, rejectionReason, onPress,
}) => {
  if (status === 'verified') return null;

  const text =
    status === 'pending'
      ? "⚠️ Verification pending — we'll notify you within 1–2 business days"
      : status === 'rejected'
        ? `⚠️ Verification rejected${rejectionReason ? `: ${rejectionReason}` : ''} — tap to resubmit`
        : "⚠️ Your store isn't verified yet — go live capability is locked";

  return (
    <Pressable onPress={onPress} style={styles.banner}>
      <Text style={styles.bannerText} numberOfLines={2}>{text}</Text>
      <Text style={styles.bannerLink}>Verify now →</Text>
    </Pressable>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────

export const SellerDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setViewAsBuyer = useAuthStore((s) => s.setViewAsBuyer);

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

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

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
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
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
      {/* ── Greeting header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={styles.greeting}>{greeting()}, {firstName}! 👋</Text>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          <Pressable
            style={styles.msgIconBtn}
            onPress={() => navigation.navigate('Messages')}
            accessibilityRole="button"
            accessibilityLabel="Messages"
          >
            <MessageCircle size={20} color="#fff" strokeWidth={2} />
            {/* TODO(Phase 4): unanswered badge from messaging API */}
          </Pressable>
          <Pressable
            style={styles.shopBuyerPill}
            onPress={() => setViewAsBuyer(true)}
            accessibilityRole="button"
            accessibilityLabel="Shop as a buyer"
          >
            <ShoppingBag size={15} color="#fff" strokeWidth={2} />
            <Text style={styles.shopBuyerText}>Shop as buyer</Text>
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

        {/* ── Metric tiles ── */}
        <View style={styles.tiles}>
          <MetricTile
            icon={<UsersRound size={32} color={Colors.orange} />}
            label="Followers"
            value={(stats.followerCount ?? 0).toLocaleString('en-IN')}
          />
          <MetricTile
            icon={<Video size={32} color={Colors.orange} />}
            label="Streams"
            value={stats.totalStreams}
          />
          <MetricTile
            icon={<Eye size={32} color={Colors.orange} />}
            label="Views (7d)"
            value={(stats.viewsLast7Days ?? 0).toLocaleString('en-IN')}
          />
          <MetricTile
            icon={<Package size={32} color={Colors.orange} />}
            label="Products"
            value={stats.totalProducts}
          />
        </View>

        {/* ── Go Live CTA ── */}
        <View style={styles.goLiveCard}>
          <View style={styles.goLiveIconWrap}>
            <Camera size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.goLiveTitle}>Ready to go live?</Text>
            <Text style={styles.goLiveSub}>Start a stream and connect with buyers</Text>
          </View>
          <Pressable
            style={styles.goLiveBtn}
            onPress={() => navigation.navigate('GoLive')}
            accessibilityRole="button"
            accessibilityLabel="Start Stream"
          >
            <Text style={styles.goLiveBtnText}>Start Stream →</Text>
          </Pressable>
        </View>

        {/* ── Recent streams ── */}
        <Text style={styles.sectionTitle}>Recent Streams</Text>
        {recentStreams.length > 0 ? (
          <View style={styles.streamList}>
            {recentStreams.map((s) => (
              <View key={s._id} style={styles.streamRow}>
                <View style={styles.streamThumb}>
                  <Play size={16} color="#fff" fill="#fff" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.streamRowTitle} numberOfLines={1}>{s.title || 'Untitled stream'}</Text>
                  <Text style={styles.streamRowMeta}>{formatStreamMeta(s)}</Text>
                </View>
                <ChevronRight size={18} color="#cbd5e1" />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.streamsEmpty}>
            <Radio size={28} color={Colors.border} />
            <Text style={styles.streamsEmptyText}>
              Your streams will show up here once you go live.
            </Text>
          </View>
        )}

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

  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  greeting: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#fff' },
  dateText: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerGreeting: { flex: 1, minWidth: 0 },
  shopBuyerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13,
  },
  msgIconBtn: {
    width: 40, height: 40, borderRadius: 20, marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  shopBuyerText: { fontSize: 12.5, fontFamily: Fonts.bold, color: '#fff' },

  body: { padding: 16, gap: 16 },

  banner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 18 },
  bannerLink: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 18, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  tileIcon: { marginBottom: 4 },
  tileValue: { fontSize: 28, fontFamily: Fonts.extraBold, color: Colors.navy },
  tileLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },

  goLiveCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.orange, borderRadius: 14, padding: 20,
  },
  goLiveIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  goLiveTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#fff' },
  goLiveSub: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  goLiveBtn: {
    borderWidth: 1.5, borderColor: '#fff', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  goLiveBtnText: { color: '#fff', fontSize: 12, fontFamily: Fonts.semiBold },

  sectionTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 4 },
  streamsEmpty: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: 20,
    alignItems: 'center', gap: 8,
  },
  streamsEmptyText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
  streamList: { gap: 10 },
  streamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  streamThumb: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  streamRowTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  streamRowMeta: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  noStore: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noStoreTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  noStoreSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  setupBtn: {
    marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
