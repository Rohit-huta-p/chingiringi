/**
 * LiveDiscoveryScreen — Buyer tab 1 (Live Discovery)
 *
 * Two toggle pills: "Live" | "Stores"
 * - Live tab: FlatList of StreamCard components from GET /streams/active
 *   • Real-time updates via Socket.io (joined in this screen)
 *   • Followed stores sorted to the top
 *   • Empty state: "No one is live right now" + Browse Stores CTA
 * - Stores tab: renders existing OfflineStoresScreen inline
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Radio, Users, Tv2 } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import { Colors, Fonts } from '../../constants/theme';
import { useFollowStore } from '../../hooks/useFollow';
import apiClient from '../../api/client';

// ── Stream shape from GET /streams/active ─────────────────────────────────
export interface LiveStream {
  _id: string;
  storeId: string;
  storeName: string;
  storeLogoUrl?: string;
  title: string;
  viewerCount: number;
  status: 'live' | 'idle' | 'ended';
}

async function fetchActiveStreams(): Promise<LiveStream[]> {
  try {
    const res = await apiClient.get('/api/streams/active');
    const payload = res.data?.data?.streams ?? res.data?.streams ?? res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  } catch {
    return []; // graceful: backend may not be ready yet
  }
}

// ── StreamCard ─────────────────────────────────────────────────────────────
interface StreamCardProps {
  stream: LiveStream;
  isFollowed: boolean;
  onPress: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ stream, isFollowed, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
    {/* Thumbnail / avatar */}
    <View style={styles.cardThumb}>
      {stream.storeLogoUrl ? (
        <Image source={{ uri: stream.storeLogoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cardThumbFallback]}>
          <Text style={styles.cardThumbInitial}>
            {stream.storeName[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      {/* LIVE badge */}
      <View style={styles.liveBadge}>
        <Radio size={9} color="#fff" />
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    </View>

    {/* Info */}
    <View style={styles.cardBody}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardStore} numberOfLines={1}>{stream.storeName}</Text>
        {isFollowed && (
          <View style={styles.followedPill}>
            <Text style={styles.followedPillText}>Following</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{stream.title}</Text>
      <View style={styles.cardFooter}>
        <Users size={13} color={Colors.textSecondary} />
        <Text style={styles.cardViewers}>{stream.viewerCount.toLocaleString('en-IN')} watching</Text>
      </View>
    </View>
  </Pressable>
);

// ── EmptyLive ──────────────────────────────────────────────────────────────
const EmptyLive: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => (
  <View style={styles.empty}>
    <Tv2 size={52} color={Colors.border} />
    <Text style={styles.emptyTitle}>No one is live right now</Text>
    <Text style={styles.emptySub}>Check back soon — stores go live throughout the day.</Text>
    <Pressable onPress={onBrowse} style={styles.emptyBtn}>
      <Text style={styles.emptyBtnText}>Browse Stores</Text>
    </Pressable>
  </View>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const LiveDiscoveryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'live' | 'stores'>('live');
  const socketRef = useRef<Socket | null>(null);

  const { followedIds } = useFollowStore();

  // Fetch active streams (React Query)
  const { data: rawStreams = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000, // poll every 30 s as a fallback
    staleTime: 10_000,
  });

  // Sort: followed stores first, then by viewer count desc
  // Guard: React Query cache from a prior run might hold a non-array value
  const safeStreams: LiveStream[] = Array.isArray(rawStreams) ? rawStreams : [];
  const streams = [...safeStreams].sort((a, b) => {
    const af = followedIds.has(a.storeId) ? 1 : 0;
    const bf = followedIds.has(b.storeId) ? 1 : 0;
    if (bf !== af) return bf - af;
    return b.viewerCount - a.viewerCount;
  });

  // Socket.io real-time viewer count updates
  useEffect(() => {
    if (tab !== 'live') return;

    // Connect to the /stream Socket.io namespace (same namespace the backend
    // emits viewer_count_update and stream_ended on). Root namespace won't
    // receive these events.
    const baseURL: string = (apiClient.defaults.baseURL as string) ?? 'http://localhost:8000';
    const socket = io(`${baseURL}/stream`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('viewer_count_update', ({ streamId, count }: { streamId: string; count: number }) => {
      // Trigger a refetch rather than mutating query data inline — simple & safe
      refetch();
    });

    socket.on('stream_ended', () => refetch());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tab, refetch]);

  const handleStreamPress = useCallback((stream: LiveStream) => {
    navigation.navigate('ViewerScreen', {
      streamId:     stream._id,
      storeName:    stream.storeName,
      storeLogoUrl: stream.storeLogoUrl,
      streamTitle:  stream.title,
      storeId:      stream.storeId,
    });
  }, [navigation]);

  const switchToStores = useCallback(() => setTab('stores'), []);

  // ── Lazy-load the Stores tab component to avoid pulling in the whole map
  // module until the user actually taps that pill.
  const OfflineStoresScreen = tab === 'stores'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ? require('../Dashboard/OfflineStoresScreen').OfflineStoresScreen
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>

        {/* Toggle pills */}
        <View style={styles.pills}>
          <Pressable
            onPress={() => setTab('live')}
            style={[styles.pill, tab === 'live' && styles.pillActive]}
          >
            <Radio size={13} color={tab === 'live' ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.pillText, tab === 'live' && styles.pillTextActive]}>Live</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('stores')}
            style={[styles.pill, tab === 'stores' && styles.pillActive]}
          >
            <Text style={[styles.pillText, tab === 'stores' && styles.pillTextActive]}>Stores</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      {tab === 'live' ? (
        isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : streams.length === 0 ? (
          <EmptyLive onBrowse={switchToStores} />
        ) : (
          <FlatList
            data={streams}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <StreamCard
                stream={item}
                isFollowed={followedIds.has(item.storeId)}
                onPress={() => handleStreamPress(item)}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                colors={[Colors.primary]}
                tintColor={Colors.primary}
              />
            }
          />
        )
      ) : (
        // Stores tab — mount OfflineStoresScreen inline
        OfflineStoresScreen ? <OfflineStoresScreen /> : null
      )}
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginTop: 4,
  },

  pills: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
    gap: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  pillTextActive: { color: '#fff' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 12, gap: 12 },

  // StreamCard
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardThumb: {
    width: 90,
    height: 90,
    backgroundColor: Colors.backgroundGrey,
    position: 'relative',
  },
  cardThumbFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbInitial: { color: '#fff', fontSize: 28, fontFamily: Fonts.extraBold },
  liveBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 0.5 },

  cardBody: { flex: 1, padding: 12, gap: 4, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardStore: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary, flex: 1 },
  followedPill: {
    backgroundColor: Colors.primaryLight10,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  followedPillText: { color: Colors.primary, fontSize: 10, fontFamily: Fonts.bold },
  cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cardViewers: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },

  // EmptyLive
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
