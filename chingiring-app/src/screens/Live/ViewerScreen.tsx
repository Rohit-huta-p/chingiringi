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
 *     import Daily from '@daily-co/react-native-daily-js';
 *     // in component body, after viewerToken is fetched:
 *     await Daily.createCallObject();
 *     await Daily.join({ url: roomUrl, token: viewerToken });
 *     // render: <DailyMediaView sessionId={broadcasterSessionId} videoScaleMode="fill" style={StyleSheet.absoluteFill} />
 *
 * • Socket.io   — useSocket hook, /stream namespace, auto-join on mount.
 * • Floating ❤️ — Reanimated 4 per-heart animation; hearts spawn on
 *                  heart_burst events and local heart-button taps.
 * • Live chat   — LiveChatSheet (custom, socket-driven — NOT the CommentsSheet
 *                  which is API-backed and targets pre-recorded video comments).
 * • Stream end  — Full-screen overlay with "Back to Discover" CTA.
 *
 * Navigation params (from LiveDiscoveryScreen)
 * ─────────────────────────────────────────────
 *   streamId:      string   — MongoDB stream _id
 *   storeName:     string   — display name in the header
 *   storeLogoUrl?: string   — store avatar (optional)
 *   streamTitle?:  string   — stream title shown in bottom overlay
 *   storeId?:      string   — reserved for follow checks
 */

import React, {
  useCallback,
  useEffect,
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import {
  ChevronLeft,
  MessageCircle,
  Heart,
  Send,
  X,
  Radio,
  Users,
  WifiOff,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useSocket, LiveChatMsg } from '../../hooks/useSocket';
import { getViewerToken } from '../../api/streams';
import { useAuthStore } from '../../store';

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
  xOffset: number; // px right-of-origin scatter
  size: number;    // emoji font size
}

// ─── FloatingHeart ─────────────────────────────────────────────────────────
// Single animated heart that flies up and fades out.

const HEART_RISE_MS = 2_200;
const HEART_FADE_DELAY_MS = 1_900;
const HEART_FADE_MS = 300;

const FloatingHeart: React.FC<{ item: HeartItem; onDone: (id: string) => void }> = ({
  item,
  onDone,
}) => {
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.3);

  useEffect(() => {
    // Pop in
    scale.value   = withSpring(1, { damping: 10, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 150 });
    // Rise
    translateY.value = withTiming(-270, {
      duration: HEART_RISE_MS,
      easing: Easing.out(Easing.cubic),
    });

    // Fade out near the top
    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: HEART_FADE_MS });
    }, HEART_FADE_DELAY_MS);

    // Notify parent to remove from list
    const doneTimer = setTimeout(
      () => onDone(item.id),
      HEART_FADE_DELAY_MS + HEART_FADE_MS + 50,
    );

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.floatingHeart,
        { right: 24 + item.xOffset },
        animStyle,
      ]}
    >
      <Text style={{ fontSize: item.size }}>❤️</Text>
    </Animated.View>
  );
};

// ─── FloatingHeartsLayer ───────────────────────────────────────────────────
// Maintains the pool of in-flight hearts; capped at 20 to avoid overload.

const MAX_HEARTS = 20;

function spawnHearts(count: number): HeartItem[] {
  // Clamp burst to a visible max (backend 500 ms window means count can be high)
  const n = Math.min(count, 5);
  return Array.from({ length: n }, (_, i) => ({
    id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
    xOffset: Math.floor(Math.random() * 60) - 10, // -10 → 50 px right-of-origin
    size: 22 + Math.floor(Math.random() * 12),     // 22–34 px
  }));
}

const FloatingHeartsLayer: React.FC<{
  hearts: HeartItem[];
  onDone: (id: string) => void;
}> = ({ hearts, onDone }) => (
  // pointerEvents="none" so touches pass through to the heart button below
  <View pointerEvents="none" style={styles.heartsLayer}>
    {hearts.map((h) => (
      <FloatingHeart key={h.id} item={h} onDone={onDone} />
    ))}
  </View>
);

// ─── LiveChatSheet ─────────────────────────────────────────────────────────
// Real-time socket-driven chat panel. Separate from CommentsSheet (which is
// REST-API-backed for pre-recorded video comments).

const LiveChatSheet: React.FC<{
  visible: boolean;
  messages: LiveChatMsg[];
  onSend: (text: string) => void;
  onClose: () => void;
}> = ({ visible, messages, onSend, onClose }) => {
  const [text, setText] = useState('');
  const me = useAuthStore((s) => s.user);
  const listRef = useRef<FlatList<LiveChatMsg>>(null);

  // Scroll to latest message when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      // Slight delay so the new item is laid out before scrolling
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages.length]);

  const submit = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }, [text, onSend]);

  const renderItem = useCallback(
    ({ item }: { item: LiveChatMsg }) => {
      const name = item.user?.name ?? 'Guest';
      const isMe = me?.name === name; // rough check; replace with userId match if available
      const initial = name[0]?.toUpperCase() ?? '?';
      return (
        <View style={chatStyles.row}>
          {item.user?.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={chatStyles.avatar} />
          ) : (
            <View style={[chatStyles.avatar, chatStyles.avatarFallback]}>
              <Text style={chatStyles.avatarTxt}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={chatStyles.name}>{isMe ? 'You' : name}</Text>
            <Text style={chatStyles.msg}>{item.text}</Text>
          </View>
        </View>
      );
    },
    [me],
  );

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={chatStyles.kav}
      pointerEvents="box-none"
    >
      <Pressable style={chatStyles.backdrop} onPress={onClose} />
      <View style={chatStyles.sheet}>
        {/* Grabber */}
        <View style={chatStyles.grabber} />

        {/* Header */}
        <View style={chatStyles.header}>
          <Text style={chatStyles.title}>Live chat</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={chatStyles.listPad}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={chatStyles.empty}>
              <MessageCircle size={30} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
              <Text style={chatStyles.emptyTxt}>No messages yet — say hi! 👋</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={chatStyles.inputBar}>
          <TextInput
            style={chatStyles.input}
            value={text}
            onChangeText={setText}
            placeholder="Say something…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline={false}
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={submit}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={submit}
            disabled={!text.trim()}
            hitSlop={6}
            style={[chatStyles.sendBtn, !text.trim() && chatStyles.sendBtnOff]}
          >
            <Send size={17} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── StreamEndedOverlay ────────────────────────────────────────────────────

const StreamEndedOverlay: React.FC<{ storeName: string; onBack: () => void }> = ({
  storeName,
  onBack,
}) => (
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
          <Image
            source={{ uri: storeLogoUrl }}
            style={styles.videoLogoLarge}
            blurRadius={2}
          />
        ) : (
          <View style={styles.videoLogoFallback}>
            <Text style={styles.videoLogoInitial}>
              {storeName[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.videoPlaceholderLabel}>Video loading…</Text>
        <Text style={styles.videoPlaceholderSub}>
          Daily.co native install pending
        </Text>
      </>
    )}
  </View>
);

// ─── ViewerScreen ──────────────────────────────────────────────────────────

export const ViewerScreen: React.FC = () => {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const insets      = useSafeAreaInsets();

  const {
    streamId,
    storeName = 'Live Stream',
    storeLogoUrl,
    streamTitle,
  }: RouteParams = route.params ?? {};

  // ── State ───────────────────────────────────────────────────────────────
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [hearts, setHearts]           = useState<HeartItem[]>([]);
  const [messages, setMessages]       = useState<LiveChatMsg[]>([]);
  const [chatOpen, setChatOpen]       = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  // viewerToken and roomUrl will drive Daily.co once the package is installed
  const viewerTokenRef = useRef<{ viewerToken: string; roomUrl: string } | null>(null);

  // ── Fetch viewer token ──────────────────────────────────────────────────
  useEffect(() => {
    if (!streamId) return;
    getViewerToken(streamId)
      .then((data) => { viewerTokenRef.current = data; })
      .catch(() => { /* backend may not be ready — video placeholder shown */ })
      .finally(() => setTokenLoading(false));
  }, [streamId]);

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
    onNewChat: (msg) => setMessages((prev) => [...prev.slice(-99), msg]),
    onStreamEnded: () => setStreamEnded(true),
  });

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleHeartPress = useCallback(() => {
    sendHeart();
    addHearts(1); // Optimistic local heart
  }, [sendHeart, addHearts]);

  const handleSendChat = useCallback(
    (text: string) => { sendChat(text); },
    [sendChat],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

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
      {/*
       * DAILY.CO INTEGRATION POINT
       * Once @daily-co/react-native-daily-js is installed and a native rebuild
       * is run, replace <VideoPendingPlaceholder> with:
       *
       *   import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';
       *
       *   // in useEffect after viewerToken is available:
       *   const callObj = Daily.createCallObject();
       *   await callObj.join({ url: viewerTokenRef.current.roomUrl,
       *                        token: viewerTokenRef.current.viewerToken });
       *
       *   // render:
       *   <DailyMediaView
       *     sessionId={broadcasterParticipantSessionId}
       *     videoScaleMode="fill"
       *     style={StyleSheet.absoluteFill}
       *   />
       */}
      <VideoPendingPlaceholder
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        loading={tokenLoading}
      />

      {/* ── Bottom gradient for legibility ───────────────────────── */}
      <View style={styles.bottomGradient} pointerEvents="none" />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* Back */}
        <Pressable onPress={handleBack} hitSlop={10} style={styles.iconBtn}>
          <ChevronLeft size={22} color="#fff" />
        </Pressable>

        {/* Store info + LIVE badge */}
        <View style={styles.storeInfo}>
          {storeLogoUrl ? (
            <Image source={{ uri: storeLogoUrl }} style={styles.storeAvatar} />
          ) : (
            <View style={[styles.storeAvatar, styles.storeAvatarFallback]}>
              <Text style={styles.storeAvatarInitial}>
                {storeName[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
          <View style={styles.liveBadge}>
            <Radio size={8} color="#fff" />
            <Text style={styles.liveBadgeTxt}>LIVE</Text>
          </View>
        </View>

        {/* Viewer count */}
        <View style={styles.viewerChip}>
          <Users size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.viewerTxt}>
            {viewerCount.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* ── Bottom overlay ──────────────────────────────────────── */}
      <View
        style={[
          styles.bottomControls,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        {/* Stream title */}
        {streamTitle ? (
          <Text style={styles.streamTitle} numberOfLines={2}>
            {streamTitle}
          </Text>
        ) : null}

        {/* Action row */}
        <View style={styles.actionRow}>
          {/* Chat button */}
          <Pressable
            onPress={() => setChatOpen(true)}
            style={styles.actionBtn}
            hitSlop={8}
          >
            <MessageCircle size={26} color="#fff" />
            {messages.length > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeTxt}>
                  {messages.length > 99 ? '99+' : messages.length}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Heart button */}
          <Pressable
            onPress={handleHeartPress}
            style={[styles.actionBtn, styles.heartBtn]}
            hitSlop={8}
          >
            <Heart size={26} color="#fff" fill="#fff" />
          </Pressable>
        </View>
      </View>

      {/* ── Floating hearts (Reanimated, pointerEvents=none) ─────── */}
      <FloatingHeartsLayer hearts={hearts} onDone={removeHeart} />

      {/* ── Live chat sheet ──────────────────────────────────────── */}
      <LiveChatSheet
        visible={chatOpen}
        messages={messages}
        onSend={handleSendChat}
        onClose={() => setChatOpen(false)}
      />

      {/* ── Stream ended overlay ─────────────────────────────────── */}
      {streamEnded && (
        <StreamEndedOverlay storeName={storeName} onBack={handleBack} />
      )}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Video placeholder ──
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  videoLogoLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.6,
  },
  videoLogoFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  videoLogoInitial: {
    color: '#fff',
    fontSize: 38,
    fontFamily: Fonts.extraBold,
  },
  videoPlaceholderLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  videoPlaceholderSub: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontFamily: Fonts.regular,
  },

  // ── Gradient overlay ──
  bottomGradient: {
    ...StyleSheet.absoluteFillObject,
    // Simulated gradient using layers — expo-linear-gradient is an optional dep;
    // using a simple semi-transparent bar from the bottom instead.
    top: undefined,
    height: 260,
    bottom: 0,
    backgroundColor: 'transparent',
    // A thin shadow-like effect is enough; full gradient via LinearGradient is
    // a low-priority enhancement.
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  storeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  storeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  storeAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeAvatarInitial: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  storeName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.bold,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  liveBadgeTxt: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  viewerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  viewerTxt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },

  // ── Bottom controls ──
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  streamTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    backgroundColor: '#EF4444',
  },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chatBadgeTxt: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Fonts.bold,
  },

  // ── Floating hearts layer ──
  heartsLayer: {
    ...StyleSheet.absoluteFillObject,
    // Hearts are positioned absolutely within this layer using `right` + `bottom`
    // so they spawn near the heart button and float upward.
  },
  floatingHeart: {
    position: 'absolute',
    bottom: 130, // approx above the heart button
  },
});

// ─── Chat sheet styles ─────────────────────────────────────────────────────

const chatStyles = StyleSheet.create({
  kav: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    height: '65%',
    backgroundColor: '#12121C',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  listPad: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 7,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  name: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    marginBottom: 2,
  },
  msg: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyTxt: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontFamily: Fonts.regular,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0D0D16',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
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
