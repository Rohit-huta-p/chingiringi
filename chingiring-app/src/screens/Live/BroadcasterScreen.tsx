/**
 * BroadcasterScreen — Live stream broadcaster (Sprint 6 integration stub).
 *
 * Navigation params (from GoLiveModal):
 *   streamId:         string  — MongoDB Stream._id
 *   broadcasterToken: string  — Daily.co broadcaster token
 *   roomUrl:          string  — Daily.co room URL
 *   title:            string  — stream title
 *
 * Current state (Daily.co not yet installed):
 *   - Shows expo-camera preview as placeholder for DailyMediaView.
 *   - Duration timer runs from stream start.
 *   - Live viewer count / hearts / chat ride the same Socket.io `/stream`
 *     namespace ViewerScreen uses (hooks/useSocket) — the broadcaster joins
 *     its own room like any other participant.
 *   - "End Stream" calls POST /api/streams/:id/end, then shows the
 *     post-stream summary (stats collected client-side during the session)
 *     instead of navigating away immediately.
 *
 * Daily.co integration TODO (after `npx expo prebuild --clean`):
 *   1. Import Daily from '@daily-co/react-native-daily-js'
 *   2. On mount: await Daily.createCallObject(); await Daily.join({ url: roomUrl, token: broadcasterToken })
 *   3. Replace <CameraView> block with <DailyMediaView sessionId={localSessionId} style={StyleSheet.absoluteFill} />
 *   4. On "End Stream": call Daily.leave() + Daily.destroy() before endStream()
 *
 * Known gap: `join_stream` (backend streamSocket.js) increments viewerCount
 * for every socket that joins, including the broadcaster's own connection —
 * so "watching" / "Peak Viewers" run ~1 high while live. Not fixed here
 * (orthogonal to this UI pass); flagged separately.
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
  Image,
  ActivityIndicator,
  Share,
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
import { CameraView, useCameraPermissions } from 'expo-camera';
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
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { endStream } from '../../api/streams';
import { useSocket, LiveChatMsg } from '../../hooks/useSocket';

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

  const { streamId, title } = route.params ?? {};

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  // Duration timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

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
  const { sendHeart, sendChat } = useSocket({
    streamId: streamId ?? null,
    onViewerCount: setViewerCount,
    onHeartBurst: (count) => {
      addHearts(count);
      setHeartsCount((c) => c + count); // server-confirmed total, not the optimistic tap
    },
    onNewChat: (msg) => {
      setMessages((prev) => [...prev.slice(-49), msg]);
      setMessagesCount((c) => c + 1);
    },
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
    setEnding(true);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamId) await endStream(streamId);
    } catch {
      // Ignore — stream may have already ended or lost connection
    } finally {
      setEnding(false);
      setConfirmVisible(false);
      setStreamEnded(true);
    }
  }, [streamId]);

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
  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is needed to go live.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Camera preview (placeholder for DailyMediaView) ── */}
      <CameraView
        style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]}
        facing={facing}
        // When Daily.co is integrated: replace this CameraView with DailyMediaView
      />

      {!streamEnded && (
        <>
          {/* ── Bottom gradient for legibility ── */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
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

          {/* ── Bottom overlay: chat feed + input row ── */}
          <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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

          {/* ── Floating hearts ── */}
          <FloatingHeartsLayer hearts={hearts} onDone={removeHeart} />

          {/* ── End Stream confirmation ── */}
          <EndStreamModal
            visible={confirmVisible}
            ending={ending}
            onCancel={() => setConfirmVisible(false)}
            onConfirm={handleConfirmEnd}
          />
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
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 200,
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
    width: 36, height: 36, borderRadius: 18,
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

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
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
