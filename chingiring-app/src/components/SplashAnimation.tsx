import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '../constants/theme';

interface Props {
  /** Called once the splash animation timeline finishes. */
  onComplete?: () => void;
  /**
   * Hold extra time on the final frame before calling onComplete.
   * Useful when the app is still hydrating / loading data behind the splash.
   */
  holdMs?: number;
}

// ─── Timeline (ms) ──────────────────────────────────────────────────────────
//
// Each animation has its own delay → they run in one Animated.parallel.
// This avoids RN-Web's flaky Animated.sequence behaviour (springs / nested
// parallels sometimes don't resolve, blocking later phases).
//
const T = {
  phase2Start: 400,   // first ripple begins
  rippleOffset: 220,   // stagger between rings
  rippleLifeMs: 1300,   // full lifecycle per ring (fade-in → hold → fade-out)
  phase3Start: 2000,   // gradient fade + logo shift + white wipe
  phase3Dur: 700,
  phase4Start: 2700,   // wordmark fades in
  phase4Dur: 500,
};
const TIMELINE_END = T.phase4Start + T.phase4Dur; // 3200 ms

const WHITE_WIPE_BASE_SIZE = 120;

/**
 * Animated splash sequence — matches Figma frames 711:9657 → 9662 → 9669 → 9675.
 *
 * Timeline (~2.65 s + holdMs):
 *   1. Logo scales/fades in on indigo→cyan gradient                  0   – 0.5 s
 *   2. Three concentric white ripples pulse outward                  0.5 – 1.5 s
 *   3. Gradient fades to white, logo translates left,
 *      decorative white circle expands from the centre                1.5 – 2.2 s
 *   4. "ChingiRingi" wordmark fades in to the right of the logo      2.2 – 2.65 s
 */
export const SplashAnimation: React.FC<Props> = ({ onComplete, holdMs = 1550 }) => {
  const { width, height } = useWindowDimensions();

  // ── Animated values ───────────────────────────────────────────────────────
  // Logo starts fully visible (Frame 1 shows it already on screen).
  // Skipping a scale-in tween avoids RN-Web's unreliable easing-back finalisation.
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;

  // Each ring driven by a single progress value (0 → 1) over its lifetime.
  // Opacity + scale derived via .interpolate() — avoids RN's "two timings on
  // one Animated.Value" issue that silently drops one of them.
  const ring1Progress = useRef(new Animated.Value(0)).current;
  const ring2Progress = useRef(new Animated.Value(0)).current;
  const ring3Progress = useRef(new Animated.Value(0)).current;

  const ringDerived = (
    progress: Animated.Value,
    peakOp: number,
    endScale: number,
  ) => ({
    opacity: progress.interpolate({
      inputRange: [0, 0.18, 0.78, 1],
      outputRange: [0, peakOp, peakOp, 0],
    }),
    scale: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, endScale],
    }),
  });

  const ring1 = ringDerived(ring1Progress, 0.75, 3.2);
  const ring2 = ringDerived(ring2Progress, 0.50, 4.8);
  const ring3 = ringDerived(ring3Progress, 0.28, 6.6);

  const whiteWipeScale = useRef(new Animated.Value(0.01)).current;
  const gradientOpacity = useRef(new Animated.Value(1)).current;

  // logoGroup contains [badge | gap | wordmark]. Flex centres the whole group,
  // which puts the badge to the LEFT of viewport-centre. To start with the badge
  // visually centred (Frame 1+2), we offset the group RIGHT by half of (gap+text)
  // and animate that offset to 0 in Phase 3 so the group ends up centred (Frame 4).
  const TEXT_PLUS_GAP = 220; // "ChingiRingi" @ 32px bold ≈ 204px + 16 gap
  const startGroupShift = TEXT_PLUS_GAP / 2;

  const logoTranslateX = useRef(new Animated.Value(startGroupShift)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateX = useRef(new Animated.Value(24)).current;

  useEffect(() => {

    // White wipe needs to cover the screen — diameter must exceed the diagonal.
    const diagonal = Math.sqrt(width * width + height * height);
    const wipeFinalScale = (diagonal * 2.4) / WHITE_WIPE_BASE_SIZE;

    // useNativeDriver:false everywhere — RN-Web has no native driver and the
    // fallback warning floods the console + can mis-resolve sequence completions.
    const ND = false;

    Animated.parallel([
      // (Phase 1 omitted — logo is visible at mount; matches Figma Frame 1.)

      // ── Phase 2: three staggered ripples (single progress driver each) ───
      Animated.timing(ring1Progress, { toValue: 1, duration: T.rippleLifeMs, delay: T.phase2Start + T.rippleOffset * 0, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.timing(ring2Progress, { toValue: 1, duration: T.rippleLifeMs, delay: T.phase2Start + T.rippleOffset * 1, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.timing(ring3Progress, { toValue: 1, duration: T.rippleLifeMs, delay: T.phase2Start + T.rippleOffset * 2, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),

      // ── Phase 3: gradient fade + logo shift + white wipe ───────────────────
      Animated.timing(whiteWipeScale, { toValue: wipeFinalScale, duration: T.phase3Dur + 50, delay: T.phase3Start, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.timing(gradientOpacity, { toValue: 0, duration: T.phase3Dur, delay: T.phase3Start + 150, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.timing(logoTranslateX, { toValue: 0, duration: T.phase3Dur, delay: T.phase3Start, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),

      // ── Phase 4: wordmark ─────────────────────────────────────────────────
      Animated.timing(textOpacity, { toValue: 1, duration: T.phase4Dur, delay: T.phase4Start, useNativeDriver: ND }),
      Animated.timing(textTranslateX, { toValue: 0, duration: T.phase4Dur, delay: T.phase4Start, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (holdMs > 0) {
        setTimeout(() => onComplete?.(), holdMs);
      } else {
        onComplete?.();
      }
    });
  }, []);

  return (
    <View style={st.root}>
      {/* White base — revealed once the gradient fades out */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fff' }]} />

      {/* Phase 1+2: indigo → cyan gradient (fades out in Phase 3) */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gradientOpacity }]}>
        <LinearGradient
          colors={['#362b86', '#35a8e7']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Decorative white circle that expands from the centre in Phase 3 */}
      <Animated.View
        style={[
          st.whiteWipe,
          {
            transform: [
              { translateX: -WHITE_WIPE_BASE_SIZE / 2 },
              { translateY: -WHITE_WIPE_BASE_SIZE / 2 },
              { scale: whiteWipeScale },
            ],
          },
        ]}
      />

      {/* Phase 2: concentric ripples — placed dead-centre, scaled outward */}
      <Animated.View style={[st.ring, { opacity: ring1.opacity, transform: [{ scale: ring1.scale }] }]} />
      <Animated.View style={[st.ring, { opacity: ring2.opacity, transform: [{ scale: ring2.scale }] }]} />
      <Animated.View style={[st.ring, { opacity: ring3.opacity, transform: [{ scale: ring3.scale }] }]} />

      {/* Logo + wordmark group — group is centred, translates left in Phase 3 */}
      <Animated.View
        style={[
          st.logoGroup,
          { transform: [{ translateX: logoTranslateX }] },
        ]}
      >
        <Animated.View
          style={[
            st.logoBadge,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <View style={st.logoInner}>
            <Image
              source={require('../../assets/chingi-logo.png')}
              style={st.logoImg}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            st.wordmark,
            { opacity: textOpacity, transform: [{ translateX: textTranslateX }] },
          ]}
        >
          ChingiRingi
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// ─── Styles ─────────────────────────────────────────────────────────────────

const RING_BASE_SIZE = 140;

const st = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  whiteWipe: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: WHITE_WIPE_BASE_SIZE,
    height: WHITE_WIPE_BASE_SIZE,
    borderRadius: WHITE_WIPE_BASE_SIZE / 2,
    backgroundColor: '#fff',
  },

  ring: {
    position: 'absolute',
    width: RING_BASE_SIZE,
    height: RING_BASE_SIZE,
    borderRadius: RING_BASE_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },

  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },

  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  logoImg: {
    width: 56,
    height: 56,
  },

  wordmark: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: '#101828',
    letterSpacing: -0.4,
  },
});

export default SplashAnimation;
