/**
 * SellerDashboardScreen — Dashboard tab for sellers.
 *
 * Fetches the seller's store (GET /api/stores/mine) and store stats
 * (GET /api/stores/:id/stats) and renders:
 *   - Greeting + store name
 *   - Metric tiles: Followers · Streams · Products · Views (7d)
 *   - Verification status banner (links to StoreVerification if unverified)
 *   - Quick action: "Go Live" (navigates to GoLive tab)
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
  LayoutDashboard,
  Users,
  Video,
  Package,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Radio,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import apiClient from '../../api/client';

// ── API helpers ───────────────────────────────────────────────────────────

interface SellerStore {
  _id: string;
  name: string;
  category: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  ownerId?: string;
}

interface StoreStats {
  followerCount: number;
  totalStreams: number;
  viewsLast7Days: number;
  totalProducts: number;
}

async function fetchMyStore(): Promise<SellerStore | null> {
  try {
    const res = await apiClient.get('/api/stores/mine');
    return res.data?.store ?? res.data?.data ?? null;
  } catch {
    return null;
  }
}

async function fetchStoreStats(storeId: string): Promise<StoreStats> {
  try {
    const res = await apiClient.get(`/api/stores/${storeId}/stats`);
    return res.data ?? { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 };
  } catch {
    return { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 };
  }
}

// ── Metric tile ───────────────────────────────────────────────────────────

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: string;
}

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, accent = Colors.orange }) => (
  <View style={[styles.tile, { borderColor: accent + '33' }]}>
    <View style={[styles.tileIcon, { backgroundColor: accent + '18' }]}>{icon}</View>
    <Text style={[styles.tileValue, { color: accent }]}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

// ── Verification banner ───────────────────────────────────────────────────

interface VerifBannerProps {
  status: SellerStore['verificationStatus'];
  onPress: () => void;
}

const VerifBanner: React.FC<VerifBannerProps> = ({ status, onPress }) => {
  if (status === 'verified') return null;

  const configs = {
    pending:    { bg: '#FFFBEB', border: '#F59E0B', text: 'Verification under review — usually 1–2 business days.', icon: <ShieldAlert size={16} color="#D97706" /> },
    rejected:   { bg: '#FEF2F2', border: '#EF4444', text: 'Verification rejected. Tap to resubmit your documents.', icon: <ShieldAlert size={16} color="#DC2626" /> },
    unverified: { bg: '#EFF6FF', border: '#3B82F6', text: 'Verify your store to unlock live streaming.', icon: <ShieldAlert size={16} color="#2563EB" /> },
  };
  const cfg = configs[status ?? 'unverified'];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.banner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
    >
      {cfg.icon}
      <Text style={styles.bannerText} numberOfLines={2}>{cfg.text}</Text>
      <ChevronRight size={16} color={cfg.border} />
    </Pressable>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────

export const SellerDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const {
    data: store,
    isLoading: storeLoading,
    refetch: refetchStore,
    isRefetching,
  } = useQuery({
    queryKey: ['seller', 'myStore'],
    queryFn: fetchMyStore,
    staleTime: 60_000,
  });

  const { data: stats = { followerCount: 0, totalStreams: 0, viewsLast7Days: 0, totalProducts: 0 } } = useQuery({
    queryKey: ['seller', 'stats', store?._id],
    queryFn: () => fetchStoreStats(store!._id),
    enabled: !!store?._id,
    staleTime: 60_000,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (storeLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 20, padding: 16 }}
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
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <LayoutDashboard size={22} color={Colors.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.storeName} numberOfLines={1}>
            {store?.name ?? user?.name ?? 'Seller'}
          </Text>
        </View>
      </View>

      {/* ── Verification banner ── */}
      {store && (
        <VerifBanner
          status={store.verificationStatus}
          onPress={() => navigation.navigate('StoreVerification', { store })}
        />
      )}

      {/* ── Metric tiles ── */}
      <Text style={styles.sectionLabel}>YOUR STORE</Text>
      <View style={styles.tiles}>
        <MetricTile
          icon={<Users size={18} color={Colors.orange} />}
          label="Followers"
          value={stats.followerCount.toLocaleString('en-IN')}
          accent={Colors.orange}
        />
        <MetricTile
          icon={<Video size={18} color="#8B5CF6" />}
          label="Streams"
          value={stats.totalStreams}
          accent="#8B5CF6"
        />
        <MetricTile
          icon={<Package size={18} color="#10B981" />}
          label="Products"
          value={stats.totalProducts}
          accent="#10B981"
        />
        <MetricTile
          icon={<Eye size={18} color="#3B82F6" />}
          label="Views 7d"
          value={stats.viewsLast7Days.toLocaleString('en-IN')}
          accent="#3B82F6"
        />
      </View>

      {/* ── Go Live CTA ── */}
      <Pressable
        style={styles.goLiveCta}
        onPress={() => navigation.navigate('GoLive')}
        accessibilityRole="button"
        accessibilityLabel="Go Live"
      >
        <View style={styles.goLiveCtaIcon}>
          <Radio size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.goLiveCtaTitle}>Go Live</Text>
          <Text style={styles.goLiveCtaSub}>Start a live stream and sell to your followers</Text>
        </View>
        <ChevronRight size={18} color="#fff" />
      </Pressable>

      {/* ── No store state ── */}
      {!store && !storeLoading && (
        <View style={styles.noStore}>
          <ShieldCheck size={40} color={Colors.border} />
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
    </ScrollView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
  },
  greeting: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  storeName: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.text },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text, lineHeight: 18 },

  sectionLabel: {
    fontSize: 10, fontFamily: Fonts.extraBold, color: Colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: -8,
  },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flex: 1, minWidth: '45%', borderRadius: 14, borderWidth: 1,
    backgroundColor: Colors.surface, padding: 14, gap: 6, alignItems: 'flex-start',
  },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 22, fontFamily: Fonts.extraBold },
  tileLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },

  goLiveCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.orange, borderRadius: 16, padding: 16,
  },
  goLiveCtaIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  goLiveCtaTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
  goLiveCtaSub: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  noStore: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  noStoreTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  noStoreSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  setupBtn: {
    marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
