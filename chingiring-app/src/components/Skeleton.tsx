/**
 * Skeleton — a shimmering placeholder block for loading states.
 *
 * Matches the app's existing inline shimmer idiom (see MobileHomeScreen): a
 * `#dde3ea` block whose opacity pulses 1 ↔ 0.35. Call `useShimmer()` ONCE per
 * loading view and pass the returned value to every <Skeleton> so they pulse in
 * unison (and share a single native-driven animation).
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** A shared opacity value that pulses while the owning view is mounted. */
export function useShimmer(): Animated.Value {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

export const Skeleton: React.FC<{
  /** Width — number (px) or percentage string. Default '100%'. */
  w?: DimensionValue;
  /** Height in px. Default 12. */
  h?: number;
  /** Border radius. Default 8. */
  r?: number;
  /** Shared shimmer value from useShimmer(). */
  shimmer: Animated.Value;
  /** Extra style (e.g. a different tint over a colored header, or flex). */
  style?: StyleProp<ViewStyle>;
}> = ({ w = '100%', h = 12, r = 8, shimmer, style }) => (
  <Animated.View
    style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#dde3ea', opacity: shimmer }, style]}
  />
);

export default Skeleton;
