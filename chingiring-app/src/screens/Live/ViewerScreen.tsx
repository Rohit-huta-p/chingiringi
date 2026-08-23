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
import { X, Send, Heart, WifiOff } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useSocket, LiveChatMsg } from '../../hooks/useSocket';
import { getViewerToken, getStream, type StreamDetail, type StreamProductLite } from '../../api/streams';

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

const ProductChip: React.FC<{ item: StreamProductLite; onPress: () => void }> = ({ item, onPress }) => (
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
  </Pressable>
);

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
  // viewerToken and roomUrl will drive Daily.co once the package is installed
  const viewerTokenRef = useRef<{ viewerToken: string; roomUrl: string } | null>(null);

  // ── Fetch viewer token (Daily.co, not wired yet) ────────────────────────
  useEffect(() => {
    if (!streamId) return;
    getViewerToken(streamId)
      .then((data) => { viewerTokenRef.current = data; })
      .catch(() => { /* backend may not be ready — video placeholder shown */ })
      .finally(() => setTokenLoading(false));
  }, [streamId]);

  // ── Fetch stream detail (store + featured products) ────────────────────
  useEffect(() => {
    if (!streamId) return;
    getStream(streamId).then(setStreamDetail); // best-effort — getStream() never throws
  }, [streamId]);

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
      {/* ── Video layer (Daily.co slot) ──────────────────────────── */}
      <VideoPendingPlaceholder storeName={storeName} storeLogoUrl={storeLogoUrl} loading={tokenLoading} />

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
              <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
              <Text style={styles.viewerText} numberOfLines={1}> · 👁 {viewerCount.toLocaleString('en-IN')}</Text>
            </Pressable>

            <Pressable onPress={handleBack} style={styles.iconBtn} accessibilityLabel="Close">
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          {/* ── Bottom: featured products + chat feed + input row ── */}
          <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {products.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.productsBarWrap}
                contentContainerStyle={styles.productsBar}
              >
                {products.map((p) => (
                  <ProductChip key={p._id} item={p} onPress={() => handleProductPress(p)} />
                ))}
              </ScrollView>
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
  storeName: { color: '#fff', fontSize: 14, fontFamily: Fonts.semiBold, marginLeft: 8, flexShrink: 1 },
  viewerText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: Fonts.regular, flexShrink: 0 },
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
  productsBarWrap: { height: 72, flexGrow: 0 },
  productsBar: { gap: 10, alignItems: 'center', paddingVertical: 12 },
  productChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, maxWidth: 176,
  },
  productImg: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  productImgFallback: { backgroundColor: 'rgba(255,255,255,0.25)' },
  productInfo: { flexShrink: 1, gap: 2 },
  productName: { color: '#fff', fontSize: 12, fontFamily: Fonts.regular, lineHeight: 15 },
  productPrice: { color: Colors.primary, fontSize: 12, fontFamily: Fonts.bold },

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

export default ViewerScreen;
