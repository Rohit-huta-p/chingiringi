import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { Fonts } from '../constants/theme';

/**
 * One tilted, gently-drifting field of glassy "category" pills — the desktop
 * sign-in background from Figma (node 119:3506). Render TWO of these, one per
 * side: the left field tilts inward (~-30°) and the right mirrors it (~+30°),
 * leaving a clearer corridor down the middle for the card. Same seamless-loop
 * idea as DiagonalImageScroll, pills instead of image tiles.
 *
 * Web-first (AuthLayout uses it on desktop). Decorative — pointerEvents off.
 */

const PILLS = [
  { emoji: '💰', label: 'Cashback' },
  { emoji: '🎁', label: 'Rewards' },
  { emoji: '🔥', label: 'Deals' },
  { emoji: '⚡', label: 'Offers' },
  { emoji: '🛍️', label: 'Shopping' },
  { emoji: '🏆', label: 'Premium' },
  { emoji: '💎', label: 'VIP' },
  { emoji: '🎯', label: 'Bonus' },
  { emoji: '🌟', label: 'Coins' },
  { emoji: '🚀', label: 'Boost' },
];

const PILL_GAP = 22;
const ROW_H = 42;
const ROW_GAP = 22;

const Pill = ({ emoji, label }: { emoji: string; label: string }) => (
  <View style={styles.pill}>
    <Text style={styles.pillEmoji}>{emoji}</Text>
    <Text style={styles.pillLabel}>{label}</Text>
  </View>
);

// Rotate the pill order per row so columns don't line up between rows.
const rotate = (n: number) => PILLS.slice(n % PILLS.length).concat(PILLS.slice(0, n % PILLS.length));

interface Props {
  side: 'left' | 'right';
  /** Tilt in degrees. Defaults: left -30°, right +30° (mirrored, per Figma). */
  tiltDeg?: number;
  /** One full drift cycle for the base row. Default 70s (slow, calm). */
  loopSeconds?: number;
  /** Whole-field opacity. Default 0.92. */
  opacity?: number;
}

export const DiagonalPillScroll: React.FC<Props> = ({ side, tiltDeg, loopSeconds = 70, opacity = 0.92 }) => {
  const { width: winW, height: winH } = useWindowDimensions();

  // Measure one full set of pills once (order-independent width — holds for
  // every row). Until measured, the drifting rows stay hidden (no seam guessing).
  const [setW, setSetW] = useState(0);

  const tilt = tiltDeg ?? (side === 'left' ? -30 : 30);
  // A square field the size of the viewport diagonal covers the whole screen at
  // ANY rotation. Fill it fully with rows (no cap) so nothing rotates off-screen.
  const D = Math.ceil(Math.sqrt(winW * winW + winH * winH) * 1.15);
  const stageW = D;
  const stageH = D;
  const rowsCount = Math.ceil(D / (ROW_H + ROW_GAP)) + 1;
  const repeats = setW ? Math.ceil(D / setW) + 2 : 0;

  // Each side owns ~60% of the width and clips to it (overflow hidden), so the
  // two mirrored fields overlap only under the card in the middle.
  const sectionW = Math.ceil(winW * 0.6);
  const sectionLeft = side === 'left' ? 0 : winW - sectionW;

  return (
    <View style={[styles.section, { left: sectionLeft, width: sectionW, opacity }]} pointerEvents="none">
      <View style={styles.measurer} onLayout={(e) => { if (!setW) setSetW(e.nativeEvent.layout.width); }}>
        {PILLS.map((p, i) => <Pill key={i} {...p} />)}
      </View>

      {setW > 0 && (
        <View
          style={[
            styles.stage,
            {
              width: stageW,
              height: stageH,
              left: (sectionW - stageW) / 2,
              top: (winH - stageH) / 2,
              transform: [{ rotate: `${tilt}deg` }],
            },
          ]}
        >
          {Array.from({ length: rowsCount }).map((_, r) => (
            <PillRow
              key={r}
              setW={setW}
              repeats={repeats}
              seed={r * 3 + (side === 'right' ? 5 : 0)}
              direction={r % 2 === 0 ? 'left' : 'right'}
              durationMs={(loopSeconds + (r % 3) * 8) * 1000}
              brick={r % 2 === 1 ? -60 : 0}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const PillRow = ({
  setW, repeats, seed, direction, durationMs, brick,
}: { setW: number; repeats: number; seed: number; direction: 'left' | 'right'; durationMs: number; brick: number }) => {
  const tx = useRef(new Animated.Value(direction === 'left' ? 0 : -setW)).current;
  const pills = rotate(seed);

  useEffect(() => {
    const from = direction === 'left' ? 0 : -setW;
    const to = direction === 'left' ? -setW : 0;
    tx.setValue(from);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tx, { toValue: to, duration: durationMs, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(tx, { toValue: from, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [setW, direction, durationMs]);

  return (
    <Animated.View style={[styles.row, { marginLeft: brick, transform: [{ translateX: tx }] }]}>
      {Array.from({ length: repeats }).map((_, rep) =>
        pills.map((p, i) => <Pill key={`${rep}-${i}`} {...p} />)
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  section: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  measurer: { position: 'absolute', flexDirection: 'row', opacity: 0, top: -9999 },
  stage: { position: 'absolute' },
  row: { flexDirection: 'row', height: ROW_H, marginBottom: ROW_GAP },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: PILL_GAP,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  pillEmoji: { fontSize: 15, marginRight: 6 },
  pillLabel: { fontSize: 14, fontFamily: Fonts.medium, color: '#314158' },
});

export default DiagonalPillScroll;
