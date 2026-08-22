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
 *   - "End Stream" calls POST /api/streams/:id/end and navigates back.
 *
 * Daily.co integration TODO (after `npx expo prebuild --clean`):
 *   1. Import Daily from '@daily-co/react-native-daily-js'
 *   2. On mount: await Daily.createCallObject(); await Daily.join({ url: roomUrl, token: broadcasterToken })
 *   3. Replace <CameraView> block with <DailyMediaView sessionId={localSessionId} style={StyleSheet.absoluteFill} />
 *   4. On "End Stream": call Daily.leave() + Daily.destroy() before endStream()
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Radio, X, FlipHorizontal, Mic, MicOff } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { endStream } from '../../api/streams';

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

// ── Main screen ────────────────────────────────────────────────────────────

export const BroadcasterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { streamId, title } = route.params ?? {};

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [muted, setMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  const handleEndStream = useCallback(async () => {
    Alert.alert(
      'End stream?',
      'Your viewers will see a "stream ended" message.',
      [
        { text: 'Keep streaming', style: 'cancel' },
        {
          text: 'End stream',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              if (timerRef.current) clearInterval(timerRef.current);
              if (streamId) await endStream(streamId);
            } catch {
              // Ignore — stream may have already ended or lost connection
            }
            // Navigate back to GoLive tab, clearing the stream screens from stack
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
            );
          },
        },
      ],
    );
  }, [streamId, navigation]);

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
        style={StyleSheet.absoluteFill}
        facing={facing}
        // When Daily.co is integrated: replace this CameraView with DailyMediaView
      />

      {/* ── Dark vignette overlay ── */}
      <View style={styles.overlay} />

      {/* ── Top HUD ── */}
      <View style={[styles.topHud, { paddingTop: insets.top + 12 }]}>
        {/* LIVE badge + duration */}
        <View style={styles.liveBadge}>
          <Radio size={10} color="#fff" />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(seconds)}</Text>

        {/* Stream title */}
        <Text style={styles.streamTitle} numberOfLines={1}>{title ?? 'Live Stream'}</Text>
      </View>

      {/* ── Side controls ── */}
      <View style={[styles.sideControls, { bottom: insets.bottom + 120 }]}>
        {/* Flip camera */}
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
          style={[styles.controlBtn, muted && styles.controlBtnMuted]}
          accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff size={22} color="#EF4444" /> : <Mic size={22} color="#fff" />}
        </Pressable>
      </View>

      {/* ── Bottom: End Stream ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.note}>
          Daily.co video will appear here after{'\n'}native rebuild (npx expo prebuild --clean)
        </Text>
        <Pressable
          onPress={handleEndStream}
          disabled={ending}
          style={[styles.endBtn, ending && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel="End Stream"
        >
          {ending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <X size={18} color="#fff" />
              <Text style={styles.endBtnText}>End Stream</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    pointerEvents: 'none',
  },

  topHud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, gap: 6,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  liveBadgeText: { color: '#fff', fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  duration: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold, opacity: 0.9 },
  streamTitle: {
    color: '#fff', fontSize: 15, fontFamily: Fonts.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  sideControls: {
    position: 'absolute', right: 14, gap: 14,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  controlBtnMuted: { backgroundColor: 'rgba(239,68,68,0.25)' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12, gap: 10, alignItems: 'center',
  },
  note: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center',
    fontFamily: Fonts.regular, lineHeight: 16,
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EF4444', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  endBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },

  permText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semiBold, textAlign: 'center' },
  permBtn: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  permBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});

export default BroadcasterScreen;
