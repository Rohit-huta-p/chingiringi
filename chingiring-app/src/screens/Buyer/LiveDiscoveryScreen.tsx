/**
 * LiveDiscoveryScreen — Buyer tab "LiveDiscovery" (Live Discovery)
 *
 * Mockup: https://claude.ai/code/artifact/884f4de8-20c1-407e-9042-d7f1b8a0ca69
 *         + Follow States: https://claude.ai/code/artifact/1c500789-0ef3-465e-92fb-cf93a18cc2a2
 *         + Empty States:  https://claude.ai/code/artifact/7b76149b-db0c-46d5-ac40-970000927423
 *
 * Gradient header (title + search) then Live/Stores toggle pills. "Live" is
 * a real BuyerTabNavigator tab and "Stores" is its sibling tab — tapping the
 * "Stores" pill navigates to that tab rather than swapping content locally,
 * so the bottom tab bar and the on-screen pill never fall out of sync.
 *
 * - 2-col (native/tablet) / responsive-col (wide web) grid of StreamCards
 *   from GET /streams/active, real-time viewer counts via Socket.io.
 * - Followed stores sorted to the top; each card carries a compact
 *   FollowButton wired to the same useFollow() hook StoreDetailScreen uses.
 * - Empty state: "No one is live right now" + Browse Stores CTA.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ToastAndroid,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Radio, Users, Search } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import { Colors, Fonts } from '../../constants/theme';
import { useFollow } from '../../hooks/useFollow';
import { useAuthGate } from '../../context/AuthGateContext';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { FollowButton } from '../../components/FollowButton';
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

// Exported so OfflineStoresScreen can cross-reference which stores are live
// right now for its "Live Now" section — same queryKey below means React
// Query shares/dedupes the request when both screens are mounted.
export async function fetchActiveStreams(): Promise<LiveStream[]> {
  try {
    const res = await apiClient.get('/api/streams/active');
    // Backend wraps every response as { status, data: {...} } — confirmed
    // live shape is { data: { streams: [...] } }. Falls back to shallower
    // shapes for safety, then hard-guarantees an array either way so a
    // shape drift never crashes the [...spread] callers again.
    const payload = res.data?.data?.streams ?? res.data?.streams ?? res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  } catch {
    return []; // graceful: backend may not be ready yet
  }
}

// ── Deterministic thumbnail gradient (no store photo) — same hashing
// approach as OfflineStoresScreen's avatarColor(), just two-stop. ──────────
const THUMB_GRADIENTS: [string, string][] = [
  ['#c2410c', '#f97316'],
  ['#1d4ed8', '#3b82f6'],
  ['#b45309', '#f59e0b'],
  ['#7e22ce', '#a855f7'],
  ['#047857', '#10b981'],
];
function thumbGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return THUMB_GRADIENTS[h % THUMB_GRADIENTS.length];
}

// ── StreamCard ─────────────────────────────────────────────────────────────
interface StreamCardProps {
  stream: LiveStream;
  following: boolean;
  followBusy: boolean;
  onPress: () => void;
  onFollowPress: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ stream, following, followBusy, onPress, onFollowPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
    {/* Thumbnail */}
    <View style={styles.cardThumb}>
      {stream.storeLogoUrl ? (
        <Image source={{ uri: stream.storeLogoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={thumbGradient(stream.storeId || stream.storeName)}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <Text style={styles.cardThumbInitial}>{stream.storeName[0]?.toUpperCase()}</Text>
        </LinearGradient>
      )}
      {/* bottom scrim for badge legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)']}
        style={[styles.cardThumbScrim, { pointerEvents: 'none' }]}
      />
      <View style={styles.liveBadge}>
        <Radio size={9} color="#fff" />
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
      <View style={styles.viewersBadge}>
        <Users size={10} color="#fff" />
        <Text style={styles.viewersBadgeText}>{stream.viewerCount.toLocaleString('en-IN')}</Text>
      </View>
    </View>

    {/* Info */}
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle} numberOfLines={2}>{stream.title}</Text>
      <Text style={styles.cardStore} numberOfLines={1}>{stream.storeName}</Text>
      <FollowButton
        following={following}
        loading={followBusy}
        onPress={onFollowPress}
        size="compact"
        style={styles.cardFollowBtn}
      />
    </View>
  </Pressable>
);

// ── EmptyLive ──────────────────────────────────────────────────────────────
const EmptyLive: React.FC<{ onBrowse: () => void; onNotifications: () => void }> = ({ onBrowse, onNotifications }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIconWrap}>
      <Radio size={44} color={Colors.textSecondary} />
    </View>
    <Text style={styles.emptyTitle}>No one is live right now</Text>
    <Text style={styles.emptySub}>
      Check back in the morning or evening — that's when most sellers go live. We'll notify you when a followed store starts streaming.
    </Text>
    <Pressable onPress={onBrowse} style={styles.emptyBtn}>
      <Text style={styles.emptyBtnText}>Browse Stores</Text>
    </Pressable>
    <Pressable onPress={onNotifications} hitSlop={8}>
      <Text style={styles.emptyLink}>Manage notification settings</Text>
    </Pressable>
  </View>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const LiveDiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const socketRef = useRef<Socket | null>(null);
  const [search, setSearch] = useState('');
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);

  const { followedIds, isFollowing, follow, unfollow } = useFollow();
  const { requireAuth } = useAuthGate();

  // 2 columns on phone (matches mockup), scaling up on wider/desktop web.
  const numColumns = width >= 1100 ? 4 : width >= 768 ? 3 : 2;

  // Fetch active streams (React Query)
  const { data: rawStreams = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000, // poll every 30 s as a fallback
    staleTime: 10_000,
  });

  // Sort: followed stores first, then by viewer count desc; then apply search.
  const streams = useMemo(() => {
    const sorted = [...rawStreams].sort((a, b) => {
      const af = followedIds.has(a.storeId) ? 1 : 0;
      const bf = followedIds.has(b.storeId) ? 1 : 0;
      if (bf !== af) return bf - af;
      return b.viewerCount - a.viewerCount;
    });
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) => s.storeName.toLowerCase().includes(q) || s.title.toLowerCase().includes(q),
    );
  }, [rawStreams, followedIds, search]);

  // Socket.io real-time viewer count updates — connects to the /stream
  // namespace the backend emits viewer_count_update / stream_ended on.
  useEffect(() => {
    const baseURL: string = (apiClient.defaults.baseURL as string) ?? 'http://localhost:8000';
    const socket = io(`${baseURL}/stream`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('viewer_count_update', () => refetch());
    socket.on('stream_ended', () => refetch());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refetch]);

  const showToast = useCallback((msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('', msg, [{ text: 'OK' }], { cancelable: true });
    }
  }, []);

  const handleStreamPress = useCallback((stream: LiveStream) => {
    navigation.navigate('ViewerScreen', {
      streamId:     stream._id,
      storeName:    stream.storeName,
      storeLogoUrl: stream.storeLogoUrl,
      streamTitle:  stream.title,
      storeId:      stream.storeId,
    });
  }, [navigation]);

  const handleFollowToggle = useCallback((storeId: string, storeName: string) => {
    requireAuth(async () => {
      setFollowBusyId(storeId);
      try {
        if (isFollowing(storeId)) {
          await unfollow(storeId);
        } else {
          await follow(storeId);
          showToast(`Following ${storeName} — you'll see them first in your feed`);
        }
      } catch {
        showToast('Something went wrong. Please try again.');
      } finally {
        setFollowBusyId(null);
      }
    }, { title: 'Sign in to follow stores', subtitle: 'See live streams and deals first when you follow a store.', icon: 'star' });
  }, [requireAuth, isFollowing, follow, unfollow, showToast]);

  const goToStores = useCallback(() => navigation.navigate('Stores'), [navigation]);
  const goToNotificationSettings = useCallback(() => navigation.navigate('Settings'), [navigation]);

  return (
    <View style={styles.root}>
      {/* ── Header: gradient band with title + search ── */}
      <MobileAuthHeader hideBack title="Discover" align="left">
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.primary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search live streams…"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>
      </MobileAuthHeader>

      {/* ── Live / Stores toggle pills ── */}
      <View style={styles.controlsRow}>
        <View style={styles.pills}>
          <Pressable style={[styles.pill, styles.pillLiveActive]}>
            <View style={styles.liveDot} />
            <Text style={[styles.pillText, styles.pillTextLiveActive]}>Live</Text>
          </Pressable>
          <Pressable onPress={goToStores} style={styles.pill}>
            <Text style={styles.pillText}>Stores</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : streams.length === 0 ? (
        <EmptyLive onBrowse={goToStores} onNotifications={goToNotificationSettings} />
      ) : (
        <FlatList
          key={numColumns}
          data={streams}
          keyExtractor={(item) => item._id}
          numColumns={numColumns}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <StreamCard
              stream={item}
              following={isFollowing(item.storeId)}
              followBusy={followBusyId === item.storeId}
              onPress={() => handleStreamPress(item)}
              onFollowPress={() => handleFollowToggle(item.storeId, item.storeName)}
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
      )}
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Search bar inside the gradient header — mirrors OfflineStoresScreen's.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    height: 44,
    outlineStyle: 'none' as any,
  },

  // Toggle pills row (sits on the screen bg, below the gradient header).
  controlsRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  pills: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    alignSelf: 'flex-start',
    gap: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  pillLiveActive: { backgroundColor: 'rgba(239,68,68,0.12)' },
  pillText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  pillTextLiveActive: { color: Colors.danger },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 12, paddingTop: 4, gap: 10 },
  row: { gap: 10 },

  // StreamCard
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardThumb: {
    aspectRatio: 3 / 4,
    backgroundColor: Colors.backgroundGrey,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  cardThumbInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 34, fontFamily: Fonts.extraBold },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.danger,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  liveBadgeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.3 },
  viewersBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  viewersBadgeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.semiBold },

  cardBody: { padding: 10, gap: 3 },
  cardTitle: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text, lineHeight: 17 },
  cardStore: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },
  cardFollowBtn: { alignSelf: 'flex-start', marginTop: 6 },

  // EmptyLive
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 26,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  emptyLink: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary, marginTop: 12, textDecorationLine: 'underline' },
});
