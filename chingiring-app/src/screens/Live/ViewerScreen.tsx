/**
 * ViewerScreen — Live stream viewer (Sprint 5, Agent D2)
 *
 * Architecture
 * ────────────
 * • Video layer  — full-screen Daily.co DailyMediaView slot.
 *   @daily-co/react-native-daily-js is NOT yet installed (it requires a native
 *   rebuild). The slot renders a branded placeholder until the package lands.
 *   When it is installed, swap the <VideoPendingPlaceholder> block below for:
 *
 *     import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';
 *     // in component body, after viewerToken is fetched:
 *     await Daily.createCallObject();
 *     await Daily.join({ url: roomUrl, token: viewerToken });
 *     // render: <DailyMediaView sessionId={broadcasterSessionId} videoScaleMode="fill" style={StyleSheet.absoluteFill} />
 *
 * • Socket.io   — useSocket hook, /stream namespace, auto-join on mount.
 * • Floating ❤️ — Reanimated per-heart animation; hearts spawn on
 *                  heart_burst events and local heart-button taps.
 * • Live chat   — always-visible bottom feed (last 5, inverted) + input row,
 *                  same layout as BroadcasterScreen — not a slide-up sheet.
 * • Featured products — horizontal chip bar sourced from GET /api/streams/:id
 *                  (getStream); tapping a chip opens ProductDetail. Hidden
 *                  when the stream has no featured products.
 * • Stream end  — full-screen "stream has ended" overlay with a way back.
 *
 * Navigation params (from LiveDiscoveryScreen)
 * ─────────────────────────────────────────────
 *   streamId:      string   — MongoDB stream _id
 *   storeName:     string   — display name in the header
 *   storeLogoUrl?: string   — store avatar (optional)
 *   streamTitle?:  string   — stream title shown in bottom overlay
 *   storeId?:      string   — used to open the store profile
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, Heart, WifiOff, Search, MessageCircle, ChevronRight, UserPlus, Check } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useSocket, LiveChatMsg } from '../../hooks/useSocket';
import { getStream, type StreamDetail, type StreamProductLite } from '../../api/streams';
import { useFollow } from '../../hooks/useFollow';
import { useAuthGate } from '../../context/AuthGateContext';
import { getOrCreateConversation } from '../../api/chat';
import VideoLayer from '../../components/VideoLayer';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RouteParams {
  streamId: string;
  storeName: string;
  storeLogoUrl?: string;
  streamTitle?: string;
  storeId?: string;
}

interface HeartItem {
  id: string;
  xOffset: number;
}

// ─── Floating hearts ───────────────────────────────────────────────────────
// Hearts pop in near the heart button (bottom-right), rise, and fade — 1s.
// Same timing/shape as BroadcasterScreen's version (kept local per this
// codebase's convention of colocating small screen-specific subcomponents).

const HEART_DURATION_MS = 1000;
const MAX_HEARTS = 20;

function spawnHearts(count: number): HeartItem[] {
  const n = Math.min(count, 5); // visible cap per burst
  return Array.from({ length: n }, (_, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
    xOffset: Math.floor(Math.random() * 60) - 10,
  }));
}

const FloatingHeart: React.FC<{ item: HeartItem; onDone: (id: string) => void }> = ({ item, onDone }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 220 });
    translateY.value = withTiming(-170, { duration: HEART_DURATION_MS, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: HEART_DURATION_MS, easing: Easing.in(Easing.quad) });
    const t = setTimeout(() => onDone(item.id), HEART_DURATION_MS + 60);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingHeart, { right: 20 + item.xOffset }, animStyle]}>
      <Text style={{ fontSize: 26 }}>❤️</Text>
    </Animated.View>
  );
};

const FloatingHeartsLayer: React.FC<{ hearts: HeartItem[]; onDone: (id: string) => void }> = ({ hearts, onDone }) => (
  <View pointerEvents="none" style={styles.heartsLayer}>
    {hearts.map((h) => (
      <FloatingHeart key={h.id} item={h} onDone={onDone} />
    ))}
  </View>
);

// ─── Chat feed row ─────────────────────────────────────────────────────────

const ChatRow: React.FC<{ item: LiveChatMsg }> = ({ item }) => {
  const name = item.user?.name ?? 'Guest';
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.chatRow}>
      {item.user?.avatarUrl ? (
        <Image source={{ uri: item.user.avatarUrl }} style={styles.chatAvatar} />
      ) : (
        <View style={[styles.chatAvatar, styles.chatAvatarFallback]}>
          <Text style={styles.chatAvatarTxt}>{initial}</Text>
        </View>
      )}
      <View style={styles.chatBubble}>
        <Text style={styles.chatText} numberOfLines={2}>
          {name}: {item.text}
        </Text>
      </View>
    </View>
  );
};

// ─── Featured products bar ─────────────────────────────────────────────────

const ProductChip: React.FC<{ item: StreamProductLite; onPress: () => void; onChat: () => void }> = ({ item, onPress, onChat }) => (
  <Pressable style={styles.productChip} onPress={onPress}>
    {item.imageUrl ? (
      <Image source={{ uri: item.imageUrl }} style={styles.productImg} />
    ) : (
      <View style={[styles.productImg, styles.productImgFallback]} />
    )}
    <View style={styles.productInfo}>
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.productPrice}>₹{item.price}</Text>
    </View>
    {/* Small chat button — ask the seller about this product (nested Pressable
        captures its own tap, so it doesn't trigger the chip's ProductDetail). */}
    <Pressable onPress={onChat} hitSlop={6} style={styles.chipChatBtn} accessibilityLabel={`Chat about ${item.name}`}>
      <MessageCircle size={15} color="#fff" strokeWidth={2} />
    </Pressable>
  </Pressable>
);

// ─── Featured products "See all" sheet ─────────────────────────────────────
// A light bottom sheet over the dark viewer: search + (real) category chips +
// a chat-about-this-product action per row. No stock — the product model has
// none. Tap a row → ProductDetail; tap the chat icon → 1:1 seller chat.

const FeaturedSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  storeName: string;
  products: StreamProductLite[];
  onChat: (p: StreamProductLite) => void;
  onDetail: (p: StreamProductLite) => void;
  bottomInset: number;
}> = ({ visible, onClose, storeName, products, onChat, onDetail, bottomInset }) => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  const cats = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return ['All', ...Array.from(set)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === 'All' || p.category === cat) &&
        (!needle || p.name.toLowerCase().includes(needle)),
    );
  }, [products, q, cat]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheet.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[sheet.card, { paddingBottom: bottomInset + 8 }]}>
          <View style={sheet.handle} />
          <View style={sheet.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={sheet.title}>Featured in this stream</Text>
              <Text style={sheet.sub} numberOfLines={1}>{storeName} · tap chat to ask about a product</Text>
            </View>
            <Pressable onPress={onClose} style={sheet.closeBtn} accessibilityLabel="Close">
              <X size={18} color={Colors.text} />
            </Pressable>
          </View>

          <View style={sheet.searchPill}>
            <Search size={17} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={sheet.searchInput}
              placeholder="Search products…"
              placeholderTextColor="#94a3b8"
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
            />
          </View>

          {cats.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sheet.chipRow}>
              {cats.map((c) => (
                <Pressable key={c} onPress={() => setCat(c)} style={[sheet.catChip, cat === c && sheet.catChipActive]}>
                  <Text style={[sheet.catChipText, cat === c && sheet.catChipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <FlatList
            data={visibleProducts}
            keyExtractor={(p) => p._id}
            style={sheet.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const hasMrp = !!item.mrp && item.mrp > item.price;
              return (
                <View style={sheet.row}>
                  <Pressable style={sheet.rowMain} onPress={() => onDetail(item)}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={sheet.rowImg} />
                    ) : (
                      <View style={[sheet.rowImg, sheet.rowImgFallback]} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={sheet.rowName} numberOfLines={2}>{item.name}</Text>
                      <View style={sheet.priceRow}>
                        <Text style={sheet.price}>₹{item.price.toLocaleString('en-IN')}</Text>
                        {hasMrp ? <Text style={sheet.mrp}>₹{item.mrp!.toLocaleString('en-IN')}</Text> : null}
                      </View>
                    </View>
                  </Pressable>
                  <Pressable style={sheet.chatBtn} onPress={() => onChat(item)} accessibilityLabel={`Chat about ${item.name}`}>
                    <MessageCircle size={18} color={Colors.primary} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={sheet.empty}>No products match your search.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── StreamEndedOverlay ────────────────────────────────────────────────────

const StreamEndedOverlay: React.FC<{ storeName: string; onBack: () => void }> = ({ storeName, onBack }) => (
  <View style={endedStyles.overlay}>
    <WifiOff size={52} color="rgba(255,255,255,0.4)" />
    <Text style={endedStyles.title}>Stream has ended</Text>
    <Text style={endedStyles.sub}>{storeName} wrapped up their live session.</Text>
    <Pressable onPress={onBack} style={endedStyles.btn}>
      <Text style={endedStyles.btnTxt}>Back to Discover</Text>
    </Pressable>
  </View>
);

// ─── VideoPendingPlaceholder ───────────────────────────────────────────────
// Shown until @daily-co/react-native-daily-js is installed and a native
// rebuild is run. Replace this block with DailyMediaView (see file header).

const VideoPendingPlaceholder: React.FC<{
  storeName: string;
  storeLogoUrl?: string;
  loading: boolean;
}> = ({ storeName, storeLogoUrl, loading }) => (
  <View style={styles.videoPlaceholder}>
    {loading ? (
      <ActivityIndicator color="rgba(255,255,255,0.5)" size="large" />
    ) : (
      <>
        {storeLogoUrl ? (
          <Image source={{ uri: storeLogoUrl }} style={styles.videoLogoLarge} blurRadius={2} />
        ) : (
          <View style={styles.videoLogoFallback}>
            <Text style={styles.videoLogoInitial}>{storeName[0]?.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.videoPlaceholderLabel}>Video loading…</Text>
        <Text style={styles.videoPlaceholderSub}>Daily.co native install pending</Text>
      </>
    )}
  </View>
);

// ─── ViewerScreen ──────────────────────────────────────────────────────────

export const ViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const {
    streamId,
    storeName = 'Live Stream',
    storeLogoUrl,
    streamTitle,
    storeId: routeStoreId,
  }: RouteParams = route.params ?? {};

  // ── State ───────────────────────────────────────────────────────────────
  const [viewerCount, setViewerCount] = useState(0);
  const [hearts, setHearts] = useState<HeartItem[]>([]);
  const [messages, setMessages] = useState<LiveChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [streamEnded, setStreamEnded] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [streamDetail, setStreamDetail] = useState<StreamDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { follow, unfollow, isFollowing } = useFollow();
  const { requireAuth } = useAuthGate();

  // ── Fetch stream detail (store, products, Mux playback id) ──────────────
  useEffect(() => {
    if (!streamId) return;
    getStream(streamId)
      .then(setStreamDetail) // best-effort — getStream() never throws
      .finally(() => setTokenLoading(false));
  }, [streamId]);

  // Live HLS URL from the Mux playback id — viewers play it via VideoLayer.
  const hlsUrl = useMemo(
    () => (streamDetail?.muxPlaybackId ? `https://stream.mux.com/${streamDetail.muxPlaybackId}.m3u8` : null),
    [streamDetail?.muxPlaybackId],
  );
  const canPlay = !!hlsUrl && streamDetail?.status === 'live' && !streamEnded;

  // Resolve a clean string store id regardless of whether the route param
  // arrived as a plain id or (from some callers) a populated store object.
  const resolvedStoreId = useMemo(() => {
    if (typeof streamDetail?.storeId === 'object' && streamDetail.storeId?._id) {
      return streamDetail.storeId._id;
    }
    if (typeof routeStoreId === 'string') return routeStoreId;
    return (routeStoreId as any)?._id;
  }, [streamDetail, routeStoreId]);

  const products = streamDetail?.products ?? [];
  const following = resolvedStoreId ? isFollowing(resolvedStoreId) : false;
  const isLive = streamDetail?.status === 'live' && !streamEnded;

  // ── Heart helpers ───────────────────────────────────────────────────────
  const addHearts = useCallback((count: number) => {
    setHearts((prev) => {
      const next = [...prev, ...spawnHearts(count)];
      return next.length > MAX_HEARTS ? next.slice(-MAX_HEARTS) : next;
    });
  }, []);
  const removeHeart = useCallback((id: string) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // ── Socket.io ───────────────────────────────────────────────────────────
  const { sendHeart, sendChat } = useSocket({
    streamId: streamId ?? null,
    onViewerCount: setViewerCount,
    onHeartBurst: addHearts,
    onNewChat: (msg) => setMessages((prev) => [...prev.slice(-49), msg]),
    onStreamEnded: () => setStreamEnded(true),
  });

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleHeartPress = useCallback(() => {
    sendHeart();
    addHearts(1); // optimistic local heart
  }, [sendHeart, addHearts]);

  const submitChat = useCallback(() => {
    const t = chatText.trim();
    if (!t) return;
    sendChat(t);
    setChatText('');
  }, [chatText, sendChat]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleStorePress = useCallback(() => {
    if (!resolvedStoreId) return;
    navigation.navigate('SellerProfile', { storeId: resolvedStoreId });
  }, [navigation, resolvedStoreId]);

  const handleProductPress = useCallback(
    (product: StreamProductLite) => {
      navigation.navigate('ProductDetail', { productId: product._id });
    },
    [navigation],
  );

  // Follow / unfollow the store (auth-gated for guests).
  const handleFollow = useCallback(() => {
    if (!resolvedStoreId) return;
    requireAuth(
      async () => {
        try {
          if (following) await unfollow(resolvedStoreId);
          else await follow(resolvedStoreId);
        } catch {
          /* optimistic store already updated — ignore network hiccup */
        }
      },
      { title: 'Sign in to follow stores', subtitle: 'See live streams and deals first when you follow a store.', icon: 'star' },
    );
  }, [resolvedStoreId, following, follow, unfollow, requireAuth]);

  // Open (or reuse) a 1:1 chat with the seller, pinned to a specific product.
  const openProductChat = useCallback(
    (product: StreamProductLite) => {
      if (!resolvedStoreId) return;
      setSheetOpen(false);
      requireAuth(
        async () => {
          try {
            const conv = await getOrCreateConversation(resolvedStoreId);
            if (conv) {
              navigation.navigate('Chat', {
                conversationId: conv._id,
                title: conv.otherParty.name,
                otherParty: conv.otherParty,
                product: { productId: product._id, name: product.name, imageUrl: product.imageUrl, price: product.price },
              });
            }
          } catch (e: any) {
            Alert.alert('Couldn’t open chat', e?.response?.data?.message || 'Please try again in a moment.');
          }
        },
        { title: 'Sign in to message', subtitle: 'Chat with sellers about their products and live streams.', icon: 'default' },
      );
    },
    [resolvedStoreId, requireAuth, navigation],
  );

  const openProductDetail = useCallback(
    (product: StreamProductLite) => {
      setSheetOpen(false);
      navigation.navigate('ProductDetail', { productId: product._id });
    },
    [navigation],
  );

  // ── Guard — missing streamId ────────────────────────────────────────────
  if (!streamId) {
    return (
      <View style={styles.root}>
        <Text style={{ color: '#fff', margin: 32 }}>No stream selected.</Text>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Video layer (Mux HLS) ──────────────────────────────────── */}
      {canPlay ? (
        <View style={StyleSheet.absoluteFill}>
          <VideoLayer source={hlsUrl} isActive muted={false} />
        </View>
      ) : (
        <VideoPendingPlaceholder storeName={storeName} storeLogoUrl={storeLogoUrl} loading={tokenLoading} />
      )}

      {!streamEnded && (
        <>
          {/* ── Bottom gradient for legibility ── */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* ── Top bar ── */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable style={styles.storeInfo} onPress={handleStorePress} hitSlop={6}>
              {storeLogoUrl ? (
                <Image source={{ uri: storeLogoUrl }} style={styles.storeAvatar} />
              ) : (
                <View style={[styles.storeAvatar, styles.storeAvatarFallback]}>
                  <Text style={styles.storeAvatarInitial}>{storeName[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.storeTextWrap}>
                <View style={styles.storeNameRow}>
                  <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
                  {isLive && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.viewerText} numberOfLines={1}>{viewerCount.toLocaleString('en-IN')} watching</Text>
              </View>
            </Pressable>

            {resolvedStoreId ? (
              <Pressable
                onPress={handleFollow}
                style={[styles.followBtn, following && styles.followBtnActive]}
                accessibilityLabel={following ? 'Following' : 'Follow'}
              >
                {following ? <Check size={13} color="#fff" strokeWidth={2.6} /> : <UserPlus size={13} color="#fff" strokeWidth={2.4} />}
                <Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={handleBack} style={styles.iconBtn} accessibilityLabel="Close">
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          {/* ── Bottom: featured products + chat feed + input row ── */}
          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 28 }]}>
            {products.length > 0 && (
              <>
                <Pressable style={styles.featuredHead} onPress={() => setSheetOpen(true)} accessibilityLabel="See all featured products">
                  <Text style={styles.featuredHeadText}>Featured in this stream</Text>
                  <View style={styles.seeAll}>
                    <Text style={styles.seeAllText}>See all</Text>
                    <ChevronRight size={14} color="rgba(255,255,255,0.9)" />
                  </View>
                </Pressable>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.productsBarWrap}
                  contentContainerStyle={styles.productsBar}
                >
                  {products.map((p) => (
                    <ProductChip key={p._id} item={p} onPress={() => handleProductPress(p)} onChat={() => openProductChat(p)} />
                  ))}
                </ScrollView>
              </>
            )}

            {streamTitle ? (
              <Text style={styles.streamTitle} numberOfLines={1}>{streamTitle}</Text>
            ) : null}

            <FlatList
              data={messages.slice(-5).reverse()}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <ChatRow item={item} />}
              inverted
              style={styles.chatList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatText}
                onChangeText={setChatText}
                placeholder="Say something…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                returnKeyType="send"
                onSubmitEditing={submitChat}
                blurOnSubmit={false}
                maxLength={200}
              />
              <Pressable
                onPress={submitChat}
                disabled={!chatText.trim()}
                style={[styles.sendBtn, !chatText.trim() && { opacity: 0.5 }]}
                accessibilityLabel="Send message"
              >
                <Send size={18} color="#fff" />
              </Pressable>
              <Pressable onPress={handleHeartPress} style={styles.heartBtn} accessibilityLabel="Send heart">
                <Heart size={18} color="#fff" fill="#fff" />
              </Pressable>
            </View>
          </View>

          {/* ── Floating hearts (Reanimated, pointerEvents=none) ── */}
          <FloatingHeartsLayer hearts={hearts} onDone={removeHeart} />
        </>
      )}

      {/* ── Stream ended overlay ─────────────────────────────────── */}
      {streamEnded && <StreamEndedOverlay storeName={storeName} onBack={handleBack} />}

      {/* ── Featured products "See all" sheet ── */}
      <FeaturedSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        storeName={storeName}
        products={products}
        onChat={openProductChat}
        onDetail={openProductDetail}
        bottomInset={insets.bottom}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },

  // ── Video placeholder ──
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  videoLogoLarge: { width: 96, height: 96, borderRadius: 48, opacity: 0.6 },
  videoLogoFallback: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', opacity: 0.6,
  },
  videoLogoInitial: { color: '#fff', fontSize: 38, fontFamily: Fonts.extraBold },
  videoPlaceholderLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontFamily: Fonts.semiBold },
  videoPlaceholderSub: { color: 'rgba(255,255,255,0.2)', fontSize: 11, fontFamily: Fonts.regular },

  // ── Gradient overlay ──
  bottomGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 260,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 10,
  },
  storeInfo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  storeAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, flexShrink: 0 },
  storeAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  storeAvatarInitial: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  storeTextWrap: { marginLeft: 8, flexShrink: 1, minWidth: 0 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { color: '#fff', fontSize: 14, fontFamily: Fonts.semiBold, flexShrink: 1 },
  viewerText: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontFamily: Fonts.regular, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0,
    backgroundColor: '#EF4444', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0,
    backgroundColor: Colors.primary, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 13,
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  followText: { color: '#fff', fontSize: 12.5, fontFamily: Fonts.bold },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Bottom overlay ──
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12,
  },
  streamTitle: {
    color: '#fff', fontSize: 13, fontFamily: Fonts.medium, marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  // ── Featured products bar ──
  featuredHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2, marginBottom: 2,
  },
  featuredHeadText: {
    color: '#fff', fontSize: 12.5, fontFamily: Fonts.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  seeAllText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: Fonts.semiBold },
  productsBarWrap: { height: 72, flexGrow: 0 },
  productsBar: { gap: 10, alignItems: 'center', paddingVertical: 12 },
  productChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, maxWidth: 190,
  },
  productImg: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  productImgFallback: { backgroundColor: 'rgba(255,255,255,0.25)' },
  productInfo: { flexShrink: 1, gap: 2 },
  productName: { color: '#fff', fontSize: 12, fontFamily: Fonts.regular, lineHeight: 15 },
  productPrice: { color: Colors.primary, fontSize: 12, fontFamily: Fonts.bold },
  chipChatBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Chat feed ──
  chatList: { maxHeight: 160 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  chatAvatar: { width: 28, height: 28, borderRadius: 14 },
  chatAvatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  chatAvatarTxt: { color: '#fff', fontSize: 11, fontFamily: Fonts.bold },
  chatBubble: {
    flexShrink: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  chatText: { color: '#fff', fontSize: 13, fontFamily: Fonts.regular },

  // ── Input row ──
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    height: 40, color: '#fff', paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, fontFamily: Fonts.regular,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  heartBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  // ── Floating hearts layer ──
  heartsLayer: { ...StyleSheet.absoluteFillObject },
  floatingHeart: { position: 'absolute', bottom: 130 },
});

// ─── Stream ended overlay styles ────────────────────────────────────────────

const endedStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    textAlign: 'center',
    marginTop: 8,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnTxt: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});

// ─── Featured "See all" sheet styles ────────────────────────────────────────

const sheet = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 8, maxHeight: '82%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  title: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.navy },
  sub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundGrey, alignItems: 'center', justifyContent: 'center' },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 9, height: 44, borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: Colors.backgroundGrey, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontFamily: Fonts.regular, color: Colors.text, padding: 0 },
  chipRow: { gap: 8, paddingBottom: 12, paddingRight: 8 },
  catChip: { borderRadius: 18, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: Colors.backgroundGrey },
  catChipActive: { backgroundColor: Colors.navy },
  catChipText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  catChipTextActive: { color: '#fff' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  rowImg: { width: 58, height: 58, borderRadius: 12, backgroundColor: Colors.backgroundGrey },
  rowImgFallback: {},
  rowName: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 3 },
  price: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.navy },
  mrp: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', textDecorationLine: 'line-through' },
  chatBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight10,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { textAlign: 'center', color: Colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular, paddingVertical: 30 },
});

export default ViewerScreen;
