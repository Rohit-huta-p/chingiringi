import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';

/**
 * A band of tiled product images, tilted and animated horizontally on a loop.
 * Each band slides in a single direction. To get two opposing bands (e.g. one
 * left, one right), render two `<DiagonalImageScroll>` instances stacked.
 *
 * Why animate translateX on a tilted container? It produces diagonal motion
 * without per-frame trig — looks like "sliding at the tilt angle".
 */

const PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=240&q=70',  // shoes
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=240&q=70',  // lamp
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=240&q=70',  // headphones
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=240&q=70',  // bottle
  'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=240&q=70',  // chair
  'https://images.unsplash.com/photo-1567016526105-22da7c13ebfc?w=240&q=70',  // sofa
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=240&q=70',  // toaster
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=240&q=70',  // sunglasses
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=240&q=70',  // watch
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=240&q=70',  // watch 2
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=240&q=70',  // watch 3
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=240&q=70',  // perfume
];

interface Props {
  /** Distance from the top of the screen for this band. Default 0. */
  top?: number;
  /** Height of the band region (vertical extent before it fades). Default 200. */
  height?: number;
  /** Tile size (square). Default 84. */
  tileSize?: number;
  /** Number of stacked tile rows inside the band. Default = auto-fit to height. */
  rows?: number;
  /** Seconds for one full loop. Lower = faster. Default 22. */
  loopSeconds?: number;
  /** Direction the band slides. Default 'left'. */
  direction?: 'left' | 'right';
  /** Tilt angle in degrees. Default -12 (matches Figma's gentle diagonal). */
  tiltDeg?: number;
  /** Offset into PRODUCT_IMAGES so each band shows different starting items. */
  imageSeed?: number;
  /** Tile opacity. Default 0.9. */
  tileOpacity?: number;
}

export const DiagonalImageScroll: React.FC<Props> = ({
  top = 0,
  height = 200,
  tileSize = 84,
  rows,
  loopSeconds = 22,
  direction = 'left',
  tiltDeg = -12,
  imageSeed = 0,
  tileOpacity = 0.9,
}) => {
  const { width: winW } = useWindowDimensions();

  // Stack enough rows to fill the band's diagonal (after rotation the band's
  // effective height grows by ~|sin(angle)| * width). Add 1 row buffer so the
  // top + bottom edges of the rotated stack still cover the band region.
  const rowGap = 8;
  const rowsCount = rows ?? Math.max(2, Math.ceil((height * 1.8) / (tileSize + rowGap)));

  // The tilted strip needs to be wider than the visible band's diagonal so
  // the corners of the rotated rectangle still cover the screen edges.
  const diag    = Math.sqrt(winW * winW + height * height);
  const rowW    = Math.ceil(diag * 1.8);
  const tilesPerRow = Math.ceil(rowW / (tileSize + 8)) + 1;

  const tx = useRef(new Animated.Value(direction === 'left' ? 0 : -rowW)).current;

  useEffect(() => {
    const from = direction === 'left' ? 0 : -rowW;
    const to   = direction === 'left' ? -rowW : 0;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tx, {
          toValue: to,
          duration: loopSeconds * 1000,
          easing: Easing.linear,
          useNativeDriver: false, // RN-Web has no native animated module
        }),
        // Instant reset so the wrap is invisible.
        Animated.timing(tx, {
          toValue: from,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [direction, rowW, loopSeconds]);

  // Doubled-content row → seamless wrap. Each row uses a different seed offset
  // so columns aren't visually aligned across rows (brick-pattern variety).
  const tilesFor = (rowIdx: number) => {
    const total = tilesPerRow * 2;
    const seed  = imageSeed + rowIdx * 3;
    return Array.from({ length: total }).map((_, i) => ({
      key: i,
      src: PRODUCT_IMAGES[(i + seed) % PRODUCT_IMAGES.length],
    }));
  };

  // Stack-height = rowsCount * (tile + gap) → use this to vertically centre
  // the rotated tile-stack inside the band region.
  const stackH  = rowsCount * tileSize + (rowsCount - 1) * rowGap;
  const stageH  = stackH + Math.abs(Math.sin((tiltDeg * Math.PI) / 180) * rowW); // grows with rotation
  const stageY  = (height - stageH) / 2; // centre vertically in the band

  return (
    <View
      style={[styles.container, { top, height, width: winW }]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.stage,
          {
            width: rowW,
            height: stageH,
            left: (winW - rowW) / 2,
            top: stageY,
            transform: [{ rotate: `${tiltDeg}deg` }],
          },
        ]}
      >
        {Array.from({ length: rowsCount }).map((_, rowIdx) => (
          <Animated.View
            key={rowIdx}
            style={[
              styles.row,
              {
                transform: [{ translateX: tx }],
                marginTop: rowIdx === 0 ? 0 : rowGap,
                // Brick-stagger: offset every other row by half a tile so the
                // grid doesn't look like neat columns.
                marginLeft: rowIdx % 2 === 1 ? -(tileSize / 2) : 0,
              },
            ]}
          >
            {tilesFor(rowIdx).map((t) => (
              <View
                key={t.key}
                style={[styles.tile, { width: tileSize, height: tileSize, opacity: tileOpacity }]}
              >
                <Image source={{ uri: t.src }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              </View>
            ))}
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    // No overflow:hidden — clipping at the band edge creates a triangular white
    // wedge at the seam between two stacked bands (rotation pulls the corners
    // out of frame). The parent <LinearGradient> fade masks any spill into the
    // form area below.
  },
  stage: {
    position: 'absolute',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    marginRight: 8,
  },
});

export default DiagonalImageScroll;
