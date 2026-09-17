/**
 * BroadcasterScreen — Live stream broadcaster (Mux Live over RTMPS).
 *
 * Navigation params (from GoLiveModal):
 *   streamId:  string  — MongoDB Stream._id
 *   rtmpUrl:   string  — Mux RTMPS ingest URL (rtmps://global-live.mux.com:443/app)
 *   streamKey: string  — Mux stream key
 *   title:     string  — stream title
 *
 * Publishing: the camera+mic are pushed to Mux via `@api.video/react-native-
 * livestream` (<ApiVideoLiveStreamView>.startStreaming(streamKey, rtmpUrl)).
 * That is a NATIVE module — it only exists in a prebuilt dev/prod build, so in
 * Expo Go and the web preview `ApiVideoLiveStreamView` is null and we render a
 * "needs the dev build" fallback instead of crashing. Viewers watch the HLS via
 * playbackId (ViewerScreen / expo-video).
 *
 * Live viewer count / hearts / chat ride the same Socket.io `/stream` namespace
 * ViewerScreen uses (hooks/useSocket). "End Stream" stops the publisher, calls
 * POST /api/streams/:id/end, then shows the post-stream summary.
 *
 * Known gap: `join_stream` (backend streamSocket.js) increments viewerCount for
 * every socket including the broadcaster's own — so "watching" / "Peak Viewers"
 * run ~1 high while live. Flagged separately.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import {
  X,
  FlipHorizontal,
  Mic,
  MicOff,
  Share2,
  Send,
  Heart,
  Clock,
  Eye,
  MessageCircle,
  ShoppingBag,
  Pin,
  ChevronUp,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { endStream, markStreamLive, abortStream, getStream, updateStreamProducts, type StreamProductLite } from '../../api/streams';
import { FeatureProductsSheet } from './FeatureProductsSheet';
import { useSocket, LiveChatMsg, PinnedMsg } from '../../hooks/useSocket';
// Platform-resolved: the native RTMP publisher on iOS/Android, `null` on web
// (LiveStreamView.web.tsx) so the native-only module never enters the web bundle.
import { LiveStreamView } from './LiveStreamView';

// Guards Expo Go, where the native view isn't linked and would throw on render
// (on web LiveStreamView is null, so we never mount it there).
class LiveStreamBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — the fallback is shown instead */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const NativeUnavailable: React.FC = () => (
  <View style={[StyleSheet.absoluteFill, styles.nativeFallback]}>
    <Text style={styles.fallbackTitle}>Live broadcasting needs the dev build</Text>
    <Text style={styles.fallbackSub}>
      The RTMP publisher is a native module — it isn't available in Expo Go or the web
      preview. Build a dev client and open this screen there to actually go live.
    </Text>
  </View>
);

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function shareBase(): string {
  return process.env.EXPO_PUBLIC_SHARE_BASE ?? 'https://chingiringi-backend.onrender.com';
}

// ── Floating hearts ──────────────────────────────────────────────────────
// Hearts pop in near the heart button (bottom-right), rise, and fade — 1s.

interface HeartItem {
  id: string;
  xOffset: number;
}

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

// ── Chat feed row ────────────────────────────────────────────────────────

const ChatRow: React.FC<{ item: LiveChatMsg; onPin?: (m: LiveChatMsg) => void }> = ({ item, onPin }) => {
  const name = item.user?.name ?? 'Guest';
  const initial = name[0]?.toUpperCase() ?? '?';
  return (
    <Pressable
      style={styles.chatRow}
      onLongPress={onPin ? () => onPin(item) : undefined}
      delayLongPress={280}
      accessibilityLabel={onPin ? 'Long-press to pin this message' : undefined}
    >
      {item.user?.avatarUrl ? (
        <Image source={{ uri: item.user.avatarUrl }} style={styles.chatAvatar} />
      ) : (
        <View style={[styles.chatAvatar, styles.chatAvatarFallback]}>
          <Text style={styles.chatAvatarTxt}>{initial}</Text>
        </View>
      )}
      <View style={[styles.chatBubble, item.isAuthor && styles.chatBubbleAuthor]}>
        {item.isAuthor && (
          <View style={styles.authorBadge}>
            <Text style={styles.authorBadgeTxt}>Author</Text>
          </View>
        )}
        <Text style={styles.chatText} numberOfLines={2}>
          {item.text}
        </Text>
      </View>
    </Pressable>
  );
};

// ── End Stream confirmation ─────────────────────────────────────────────

const EndStreamModal: React.FC<{
  visible: boolean;
  ending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ visible, ending, onCancel, onConfirm }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={confirmStyles.overlay}>
      <View style={confirmStyles.card}>
        <Text style={confirmStyles.title}>End Stream?</Text>
        <Text style={confirmStyles.subtitle}>Your viewers will be disconnected</Text>
        <View style={confirmStyles.buttonRow}>
          <Pressable
            style={[confirmStyles.cancelBtn, ending && { opacity: 0.5 }]}
            onPress={onCancel}
            disabled={ending}
          >
            <Text style={confirmStyles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[confirmStyles.endBtn, ending && { opacity: 0.7 }]}
            onPress={onConfirm}
            disabled={ending}
          >
            {ending ? <ActivityIndicator color="#fff" /> : <Text style={confirmStyles.endText}>End Stream</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

// ── Post-stream summary ─────────────────────────────────────────────────

const StatRow: React.FC<{ Icon: typeof Clock; label: string; value: string; last?: boolean }> = ({
  Icon,
  label,
  value,
  last,
}) => (
  <View style={[endedStyles.statRow, !last && endedStyles.statRowDivider]}>
    <Icon size={20} color={Colors.orange} />
    <Text style={endedStyles.statLabel}>{label}</Text>
    <Text style={endedStyles.statValue}>{value}</Text>
  </View>
);

const StreamSummaryOverlay: React.FC<{
  duration: string;
  peakViewers: number;
  heartsCount: number;
  messagesCount: number;
  onShareReplay: () => void;
  onDone: () => void;
}> = ({ duration, peakViewers, heartsCount, messagesCount, onShareReplay, onDone }) => (
  <View style={endedStyles.overlay}>
    <View style={endedStyles.card}>
      <Text style={endedStyles.title}>Stream Ended</Text>

      <StatRow Icon={Clock} label="Duration" value={duration} />
      <StatRow Icon={Eye} label="Peak Viewers" value={peakViewers.toLocaleString('en-IN')} />
      <StatRow Icon={Heart} label="Hearts" value={heartsCount.toLocaleString('en-IN')} />
      <StatRow Icon={MessageCircle} label="Messages" value={messagesCount.toLocaleString('en-IN')} last />

      <View style={endedStyles.buttonRow}>
        <Pressable style={endedStyles.shareBtn} onPress={onShareReplay}>
          <Text style={endedStyles.shareBtnText}>Share Replay</Text>
        </Pressable>
        <Pressable style={endedStyles.doneBtn} onPress={onDone}>
          <Text style={endedStyles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </View>
  </View>
);

// ── Main screen ────────────────────────────────────────────────────────────

export const BroadcasterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { streamId, title, rtmpUrl, streamKey } = route.params ?? {};

  const liveRef = useRef<any>(null);
  const startedRef = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // RTMP publish connection state → drives the connecting / failed overlay.
  const [connState, setConnState] = useState<'connecting' | 'live' | 'failed'>('connecting');
  // True once RTMP actually connected — decides whether ending saves a past
  // stream (endStream) or discards a never-live attempt (abortStream).
  const wasLiveRef = useRef(false);
  // Exact reason a connection attempt failed (shown on the failure overlay so we
  // can see the real cause without native logs).
  const [connErr, setConnErr] = useState<string>('');
  const endedRef = useRef(false); // true once we've ended/aborted (avoid double-end on unmount)

  // End-stream flow
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [ending, setEnding] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  // Live stats (also drive the post-stream summary)
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [heartsCount, setHeartsCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMsg[]>([]);
  const [messagesCount, setMessagesCount] = useState(0);
  const [hearts, setHearts] = useState<HeartItem[]>([]);
  const [chatText, setChatText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  // Featured products the seller can spotlight on the live shelf (the stream's
  // featured set). `spotlightId` is the one currently marked "Showing" — local
  // UI state for now; broadcasting the spotlight to viewers needs a backend
  // `currentProductId` field + a socket event (not yet wired).
  const [products, setProducts] = useState<StreamProductLite[]>([]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<PinnedMsg | null>(null);
  // "Feature products" picker (bc-04) — opened from the shelf's "See all".
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const spotlightProduct = spotlightId ? (products.find((p) => p._id === spotlightId) ?? null) : null;
  // The stream's store id (from getStream) — the picker's catalog source.
  const [storeId, setStoreId] = useState<string | null>(null);

  // Apply a new featured set from the picker: update the shelf immediately
  // (optimistic), then persist to the stream so viewers' shelves update too.
  const applyFeatured = useCallback((next: StreamProductLite[]) => {
    setProducts(next);
    if (streamId) {
      updateStreamProducts(streamId, next.map((p) => p._id)).then(
        (server) => { if (server.length) setProducts(server); },
        () => { /* best-effort — the local shelf is already updated */ },
      );
    }
  }, [streamId]);
  useEffect(() => {
    if (!streamId) return;
    let alive = true;
    getStream(streamId)
      .then((d) => {
        if (!alive || !d) return;
        if (d.products?.length) setProducts(d.products);
        setPinned((d.pinnedMessage as PinnedMsg) ?? null);
        setSpotlightId((d.currentProductId as string) ?? null);
        const sid = typeof d.storeId === 'object' ? d.storeId?._id : d.storeId;
        if (sid) setStoreId(sid);
      })
      .catch(() => { });
    return () => { alive = false; };
  }, [streamId]);

  // ── Keyboard avoidance (iOS) ─────────────────────────────────────────────
  // The chat overlay is position:absolute (bottom:0); on iOS the keyboard
  // slides over it and hides the input. Lift the overlay to sit just above the
  // keyboard. Android's windowSoftInputMode=adjustResize resizes the window, so
  // we listen on iOS only (listening on both would double-shift).
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) =>
      setKbHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Duration timer — only runs once the stream is actually LIVE (not while
  // "Connecting…" or after a failure).
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (connState !== 'live') return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connState]);

  // Request camera + microphone permission on mount. BOTH are required — the
  // RTMP publisher captures audio too, and calling startStreaming without
  // RECORD_AUDIO granted crashes the native module (the app shuts down), so we
  // must request and gate on mic just like camera.
  useEffect(() => {
    if (!permission?.granted) requestPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [permission, requestPermission, micPermission, requestMicPermission]);

  // ── Start pushing camera+mic to Mux over RTMPS ─────────────────────────────
  const beginBroadcast = useCallback(async () => {
    if (startedRef.current) return;
    if (!liveRef.current || !rtmpUrl || !streamKey) {
      setConnErr(`missing: ${!liveRef.current ? 'view ' : ''}${!rtmpUrl ? 'url ' : ''}${!streamKey ? 'key' : ''}`);
      setConnState('failed');
      return;
    }
    startedRef.current = true;
    // rtmpdroid doesn't support RTMPS; both Mux ports are reachable, so use PLAIN
    // RTMP on :5222.
    const ingestUrl = rtmpUrl
      .replace(/^rtmps:\/\//i, 'rtmp://')
      .replace('global-live.mux.com:443', 'global-live.mux.com:5222');
    try {
      // startStreaming returns a Promise that REJECTS if the native publisher
      // can't start (bad key, camera/codec/permission, or a broken native
      // binding). Awaiting surfaces that instead of it being a silent timeout.
      await liveRef.current.startStreaming(streamKey, ingestUrl);
    } catch (e: any) {
      startedRef.current = false;
      setConnErr('start rejected: ' + (e?.message ?? String(e)).slice(0, 120));
      setConnState('failed');
    }
  }, [rtmpUrl, streamKey]);

  // RTMP actually connected → mark the stream live server-side (idle → live),
  // which is what puts it in the live feed and starts the duration timer.
  const handleConnected = useCallback(() => {
    wasLiveRef.current = true;
    setConnState('live');
    if (streamId) markStreamLive(streamId).catch(() => { });
  }, [streamId]);

  // Auto-start once the native view is mounted and camera is granted (give the
  // native surface a beat to lay out before we kick the RTMP session).
  useEffect(() => {
    if (!LiveStreamView || !permission?.granted || !micPermission?.granted) return;
    const t = setTimeout(beginBroadcast, 400);
    return () => clearTimeout(t);
  }, [permission?.granted, micPermission?.granted, beginBroadcast]);

  // Don't hang on "Connecting…" forever — if neither success nor failure fires
  // within 20s, surface it as failed so the seller can retry / see the issue.
  useEffect(() => {
    if (connState !== 'connecting') return;
    const t = setTimeout(() => setConnState((s) => {
      if (s === 'connecting') { setConnErr('timed out — no response in 20s (ingest never reached Mux)'); return 'failed'; }
      return s;
    }), 20000);
    return () => clearTimeout(t);
  }, [connState]);

  const retryBroadcast = useCallback(() => {
    // Stop the old publisher first — otherwise startStreaming rejects with
    // "Stream is already running".
    try { liveRef.current?.stopStreaming?.(); } catch { /* already down */ }
    startedRef.current = false;
    setConnErr('');
    setConnState('connecting');
    setTimeout(() => beginBroadcast(), 400);
  }, [beginBroadcast]);

  // If the seller leaves the broadcaster (back button / app close) while a live
  // stream is still running and hasn't been ended, end it so it doesn't linger
  // as a phantom live in the buyer feed.
  useEffect(() => {
    return () => {
      try { liveRef.current?.stopStreaming?.(); } catch { /* already down */ }
      if (streamId && wasLiveRef.current && !endedRef.current) {
        endStream(streamId).catch(() => { });
      }
    };
  }, [streamId]);

  // Track peak viewers as the live count moves
  useEffect(() => {
    setPeakViewers((p) => Math.max(p, viewerCount));
  }, [viewerCount]);

  // ── Hearts pool ─────────────────────────────────────────────────────────
  const addHearts = useCallback((count: number) => {
    setHearts((prev) => {
      const next = [...prev, ...spawnHearts(count)];
      return next.length > MAX_HEARTS ? next.slice(-MAX_HEARTS) : next;
    });
  }, []);
  const removeHeart = useCallback((id: string) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // ── Socket.io — same /stream namespace ViewerScreen uses ───────────────
  const { sendHeart, sendChat, pinMessage, unpinMessage, setSpotlight } = useSocket({
    streamId: streamId ?? null,
    countAsViewer: false, // the broadcaster shouldn't count itself as a watcher
    onViewerCount: setViewerCount,
    onHeartBurst: (count) => {
      addHearts(count);
      setHeartsCount((c) => c + count); // server-confirmed total, not the optimistic tap
    },
    onNewChat: (msg) => {
      setMessages((prev) => [...prev.slice(-49), msg]);
      setMessagesCount((c) => c + 1);
    },
    onPinned: setPinned,
    onSpotlight: setSpotlightId, // keep local highlight in sync with the server echo
  });

  const handleHeartPress = useCallback(() => {
    sendHeart();
    addHearts(1); // optimistic — the matching heart_burst echo is what counts toward the stat
  }, [sendHeart, addHearts]);

  const submitChat = useCallback(() => {
    const t = chatText.trim();
    if (!t) return;
    sendChat(t);
    setChatText('');
  }, [chatText, sendChat]);

  // ── End stream ──────────────────────────────────────────────────────────
  const handleConfirmEnd = useCallback(async () => {
    endedRef.current = true;
    setEnding(true);
    try {
      try { liveRef.current?.stopStreaming?.(); } catch { /* publisher may already be down */ }
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamId) {
        // Went live → save it as a past stream. Never connected → discard it so
        // it doesn't linger as a phantom / failed "past stream".
        if (wasLiveRef.current) await endStream(streamId);
        else await abortStream(streamId);
      }
    } catch {
      // Ignore — stream may have already ended or lost connection
    } finally {
      setEnding(false);
      setConfirmVisible(false);
      if (wasLiveRef.current) {
        setStreamEnded(true); // show the post-stream summary for a real stream
      } else {
        // Failed / never-live attempt — no summary, just leave.
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
      }
    }
  }, [streamId, navigation]);

  const handleDone = useCallback(() => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
  }, [navigation]);

  const handleShareLive = useCallback(async () => {
    try {
      await Share.share({
        message: `I'm live right now on Chingiringi: "${title ?? 'Live Stream'}"! Come watch. ${shareBase()}`,
      });
    } catch {
      // user cancelled the share sheet
    }
  }, [title]);

  const handleShareReplay = useCallback(async () => {
    try {
      await Share.share({
        message: `I just wrapped up a live stream on Chingiringi: "${title ?? 'Live Stream'}" — check out my store! ${shareBase()}`,
      });
    } catch {
      // user cancelled the share sheet
    }
  }, [title]);

  // ── Permission gate ──────────────────────────────────────────────────────
  if (!permission?.granted || !micPermission?.granted) {
    const needBoth = !permission?.granted && !micPermission?.granted;
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>
          {needBoth
            ? 'Camera and microphone access are needed to go live.'
            : !permission?.granted
              ? 'Camera access is needed to go live.'
              : 'Microphone access is needed to go live.'}
        </Text>
        <Pressable
          style={styles.permBtn}
          onPress={() => { requestPermission(); requestMicPermission(); }}
        >
          <Text style={styles.permBtnText}>Allow camera &amp; mic</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Live camera → RTMP publisher (native dev build only) ── */}
      {LiveStreamView ? (
        <LiveStreamBoundary fallback={<NativeUnavailable />}>
          <LiveStreamView
            ref={liveRef}
            style={StyleSheet.absoluteFill}
            camera={facing}
            isMuted={muted}
            enablePinchedZoom
            // Conservative encode so the RTMP push sustains on a weak/unstable
            // uplink (the default ~720p high-bitrate drops after a few seconds).
            // Width MUST be 16-aligned — Android H.264 encoders reject non-multiples
            // of 16 with "Failed to create codec" (854 crashed; 848 = 53×16 is safe).
            video={{ bitrate: 1_000_000, fps: 30, resolution: { width: 848, height: 480 } }}
            audio={{ bitrate: 64_000, sampleRate: 44_100, isStereo: false }}
            onConnectionSuccess={handleConnected}
            onConnectionFailed={(code: any) => { setConnErr('code: ' + String(code ?? 'unknown')); setConnState('failed'); }}
            onDisconnect={() => setConnState('connecting')}
            onPermissionsDenied={() => { setConnErr('camera/mic permission denied'); setConnState('failed'); }}
          />
        </LiveStreamBoundary>
      ) : (
        <NativeUnavailable />
      )}

      {!streamEnded && (
        <>
          {/* ── Bottom gradient for legibility ── */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.35, 1]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* ── Top bar ── */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.topLeft}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>● LIVE</Text>
              </View>
              <Text style={styles.watchingText} numberOfLines={1}>
                {viewerCount.toLocaleString('en-IN')} watching
              </Text>
              <Text style={styles.duration}>{formatDuration(seconds)}</Text>
            </View>

            <Pressable
              onPress={() => setConfirmVisible(true)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="End stream"
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          {/* ── Right sidebar ── */}
          <View style={styles.sideControls}>
            <Pressable
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              style={styles.controlBtn}
              accessibilityLabel="Flip camera"
            >
              <FlipHorizontal size={22} color="#fff" />
            </Pressable>

            {/* Mute mic
                WIRING NEEDED (KI-8): currently toggles local UI state only.
                After Daily.co integration (see DAILY_INTEGRATION.md):
                  callObject.setLocalAudio(!muted);
                Must be called inside the onPress alongside setMuted() once
                callObject is available from a module-level ref or context. */}
            <Pressable
              onPress={() => setMuted((m) => !m)}
              style={styles.controlBtn}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff size={22} color="#EF4444" /> : <Mic size={22} color="#fff" />}
            </Pressable>

            <Pressable onPress={handleShareLive} style={styles.controlBtn} accessibilityLabel="Share stream">
              <Share2 size={22} color="#fff" />
            </Pressable>
          </View>

          {/* ── Bottom overlay: featured products + chat feed + input row ── */}
          <View style={[styles.bottomOverlay, { paddingBottom: kbHeight > 0 ? kbHeight + 16 : insets.bottom + 68 }]}>
            {pinned && (
              <View style={styles.pinnedBar}>
                <Pin size={13} color="#FFC74A" strokeWidth={2.4} fill="#FFC74A" />
                {pinned.isAuthor && <Text style={styles.pinnedAuthor}>Author</Text>}
                <Text style={styles.pinnedText} numberOfLines={1}>{pinned.text}</Text>
                <Pressable onPress={unpinMessage} hitSlop={8} accessibilityLabel="Unpin message">
                  <X size={15} color="rgba(255,255,255,0.85)" />
                </Pressable>
              </View>
            )}
            {/* Compact product pill — the one being "shown"; tap to open all (Phase 3) */}
            {products.length > 0 && (
              <View style={styles.pillRow}>
                <Pressable
                  style={[styles.shelfPill, spotlightProduct && styles.shelfPillActive]}
                  onPress={() => setShowcaseOpen(true)}
                  accessibilityLabel="Show products"
                >
                  {spotlightProduct ? (
                    <>
                      {spotlightProduct.imageUrl ? (
                        <Image source={{ uri: spotlightProduct.imageUrl }} style={styles.pillImg} />
                      ) : (
                        <View style={[styles.pillImg, styles.prodImgFallback]} />
                      )}
                      <View style={{ minWidth: 0, flexShrink: 1 }}>
                        <View style={styles.pillNowRow}>
                          <View style={styles.pillDot} />
                          <Text style={styles.pillNow}>SHOWING</Text>
                        </View>
                        <Text style={styles.pillName} numberOfLines={1}>{spotlightProduct.name}</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={15} color="#fff" strokeWidth={2} />
                      <Text style={styles.pillCount}>Products · {products.length}</Text>
                    </>
                  )}
                  <ChevronUp size={18} color={spotlightProduct ? '#FFC74A' : '#fff'} strokeWidth={2.2} />
                </Pressable>
              </View>
            )}

            <FlatList
              data={messages.slice(-5).reverse()}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <ChatRow item={item} onPin={pinMessage} />}
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

          {/* ── Floating hearts ── */}
          <FloatingHeartsLayer hearts={hearts} onDone={removeHeart} />

          {/* ── End Stream confirmation ── */}
          <EndStreamModal
            visible={confirmVisible}
            ending={ending}
            onCancel={() => setConfirmVisible(false)}
            onConfirm={handleConfirmEnd}
          />

          {/* ── "Feature products" picker (bc-04) ── */}
          <FeatureProductsSheet
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            storeId={storeId}
            featured={products}
            onApply={applyFeatured}
          />

          {/* ── "Show a product" sheet — pick which featured product to spotlight ── */}
          <Modal visible={showcaseOpen} transparent animationType="slide" onRequestClose={() => setShowcaseOpen(false)}>
            <View style={styles.scBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowcaseOpen(false)} />
              <View style={[styles.scCard, { paddingBottom: insets.bottom + 10 }]}>
                <View style={styles.scHandle} />
                <View style={styles.scHead}>
                  <Text style={styles.scTitle}>Show a product</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { setShowcaseOpen(false); setTimeout(() => setPickerOpen(true), 260); }} style={styles.scEditBtn} accessibilityLabel="Edit featured products">
                    <Text style={styles.scEditTxt}>Feature products</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowcaseOpen(false)} style={styles.scCloseBtn} accessibilityLabel="Close">
                    <X size={18} color={Colors.text} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {products.map((p) => {
                    const showing = spotlightId === p._id;
                    return (
                      <View key={p._id} style={styles.scRow}>
                        {p.imageUrl ? (
                          <Image source={{ uri: p.imageUrl }} style={styles.scRowImg} />
                        ) : (
                          <View style={[styles.scRowImg, styles.scRowImgFallback]} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.scRowName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.scRowPrice}>₹{p.price.toLocaleString('en-IN')}</Text>
                        </View>
                        <Pressable
                          onPress={() => { const next = showing ? null : p._id; setSpotlightId(next); setSpotlight(next); }}
                          style={showing ? styles.scShowOn : styles.scShowOff}
                          accessibilityLabel={showing ? `Stop showing ${p.name}` : `Show ${p.name}`}
                        >
                          {showing ? (
                            <>
                              <Eye size={13} color="#3d2600" strokeWidth={2.4} />
                              <Text style={styles.scShowOnTxt}>Showing</Text>
                            </>
                          ) : (
                            <Text style={styles.scShowOffTxt}>Show</Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* ── Post-stream summary (on top of the frozen camera frame) ── */}
      {streamEnded && (
        <StreamSummaryOverlay
          duration={formatDuration(seconds)}
          peakViewers={peakViewers}
          heartsCount={heartsCount}
          messagesCount={messagesCount}
          onShareReplay={handleShareReplay}
          onDone={handleDone}
        />
      )}

      {/* ── RTMP connection overlay (connecting / failed) ── */}
      {LiveStreamView && !streamEnded && connState !== 'live' && (
        <View style={styles.connOverlay} pointerEvents={connState === 'failed' ? 'auto' : 'none'}>
          {connState === 'connecting' ? (
            <>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.connText}>Connecting to the live server…</Text>
            </>
          ) : (
            <>
              <Text style={styles.connText}>Couldn't reach the live server.</Text>
              {!!connErr && <Text style={styles.connErrText}>{connErr}</Text>}
              <View style={styles.connBtnRow}>
                <Pressable style={styles.retryBtn} onPress={retryBroadcast}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
                <Pressable style={styles.endInlineBtn} onPress={() => setConfirmVisible(true)}>
                  <Text style={styles.endInlineText}>End</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  center: {
    flex: 1, backgroundColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },

  bottomGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 380,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  liveBadge: {
    backgroundColor: '#EF4444', borderRadius: 12,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  liveBadgeText: { color: '#fff', fontSize: 13, fontFamily: Fonts.bold },
  watchingText: { color: '#fff', fontSize: 13, fontFamily: Fonts.regular, marginLeft: 8 },
  duration: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold, marginLeft: 8 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  // ── Right sidebar ──
  sideControls: {
    position: 'absolute', right: 16, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  // ── Bottom overlay ──
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12,
  },
  chatList: { maxHeight: 160 },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  chatAvatar: { width: 28, height: 28, borderRadius: 14 },
  chatAvatarFallback: {
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarTxt: { color: '#fff', fontSize: 11, fontFamily: Fonts.bold },
  chatBubble: {
    flexShrink: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  chatText: { color: '#fff', fontSize: 13, fontFamily: Fonts.regular },
  chatBubbleAuthor: { backgroundColor: 'rgba(255,199,74,0.18)', borderWidth: 1, borderColor: 'rgba(255,199,74,0.55)' },
  authorBadge: { alignSelf: 'flex-start', backgroundColor: '#FFC74A', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2 },
  authorBadgeTxt: { color: '#3d2600', fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  pinnedBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderLeftWidth: 3, borderLeftColor: '#FFC74A', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  pinnedAuthor: { color: '#FFC74A', fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  pinnedText: { flex: 1, color: '#fff', fontSize: 12.5, fontFamily: Fonts.medium },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22,
    height: 44, color: '#fff', paddingHorizontal: 16, paddingVertical: 8,
    fontSize: 14, fontFamily: Fonts.regular,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  heartBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  // ── Featured products shelf ──
  shelf: { marginBottom: 4 },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  shelfTitle: { fontSize: 12, fontFamily: Fonts.bold, color: '#fff', marginLeft: 2 },
  shelfCount: { fontSize: 11, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.55)' },
  shelfSeeAll: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.orange },
  shelfRow: { gap: 8, paddingBottom: 2, paddingRight: 4 },
  prodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: 214,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12, padding: 7,
  },
  prodCardActive: {
    backgroundColor: 'rgba(251,191,36,0.20)', borderWidth: 1.5, borderColor: '#FBBF24',
    shadowColor: '#FBBF24', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  prodImg: { width: 46, height: 46, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)' },
  prodImgFallback: {},
  prodName: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
  prodPrice: { fontSize: 13, fontFamily: Fonts.extraBold, color: '#fff', marginTop: 1 },
  showBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  showBtnText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
  showBtnActive: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FBBF24', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9,
  },
  showBtnActiveText: { fontSize: 10.5, fontFamily: Fonts.extraBold, color: '#3d2600' },
  // ── Compact product pill (Phase 3) ──
  pillRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  shelfPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8, maxWidth: 250, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  shelfPillActive: { backgroundColor: 'rgba(255,199,74,0.18)', borderColor: 'rgba(255,199,74,0.6)' },
  pillImg: { width: 32, height: 32, borderRadius: 8 },
  pillNowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFC74A' },
  pillNow: { color: '#FFC74A', fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.4 },
  pillName: { color: '#fff', fontSize: 12, fontFamily: Fonts.semiBold, maxWidth: 140 },
  pillCount: { color: '#fff', fontSize: 12.5, fontFamily: Fonts.bold, marginLeft: 2 },
  // ── "Show a product" sheet ──
  scBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  scCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 14, paddingTop: 8 },
  scHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.backgroundGrey, marginBottom: 10 },
  scHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scTitle: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.navy },
  scEditBtn: { backgroundColor: Colors.backgroundGrey, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  scEditTxt: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary },
  scCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundGrey, alignItems: 'center', justifyContent: 'center' },
  scRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.backgroundGrey },
  scRowImg: { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.backgroundGrey },
  scRowImgFallback: { backgroundColor: Colors.backgroundGrey },
  scRowName: { fontSize: 13.5, fontFamily: Fonts.semiBold, color: Colors.text },
  scRowPrice: { fontSize: 13.5, fontFamily: Fonts.extraBold, color: Colors.primary, marginTop: 2 },
  scShowOff: { backgroundColor: Colors.navy, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  scShowOffTxt: { fontSize: 12.5, fontFamily: Fonts.bold, color: '#fff' },
  scShowOn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFC74A', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  scShowOnTxt: { fontSize: 12, fontFamily: Fonts.extraBold, color: '#3d2600' },

  // ── Floating hearts ──
  heartsLayer: { ...StyleSheet.absoluteFillObject },
  floatingHeart: { position: 'absolute', bottom: 116 },

  // ── Permission gate ──
  permText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semiBold, textAlign: 'center' },
  permBtn: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  permBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },

  // Native-module fallback (Expo Go / web)
  nativeFallback: {
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 36,
  },
  fallbackTitle: { color: '#fff', fontSize: 17, fontFamily: Fonts.bold, textAlign: 'center' },
  fallbackSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 19 },

  // RTMP connection overlay
  connOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  connText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semiBold, textAlign: 'center', paddingHorizontal: 32 },
  connErrText: { color: '#FCA5A5', fontSize: 12.5, fontFamily: Fonts.regular, textAlign: 'center', paddingHorizontal: 32, marginTop: 6 },
  connBtnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  retryBtn: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 26,
  },
  retryText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  endInlineBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 26,
  },
  endInlineText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});

// ── End Stream confirmation styles ──────────────────────────────────────────
const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginHorizontal: 32,
    width: '100%', maxWidth: 340,
  },
  title: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.navy },
  subtitle: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    marginTop: 8, marginBottom: 24,
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.navy },
  endBtn: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  endText: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#fff' },
});

// ── Post-stream summary styles ──────────────────────────────────────────────
const endedStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28, marginHorizontal: 32,
    width: '100%', maxWidth: 380,
  },
  title: { fontSize: 24, fontFamily: Fonts.extraBold, color: Colors.navy, marginBottom: 20 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
  },
  statRowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.backgroundGrey },
  statLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary },
  statValue: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.navy },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  shareBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.orange },
  doneBtn: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },
});

export default BroadcasterScreen;
