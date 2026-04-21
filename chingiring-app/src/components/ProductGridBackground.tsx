import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

const CARD_COLORS = [
  '#c7d9f0', '#d4c5e8', '#c9e4de',
  '#e8d5c4', '#dce3f0', '#c7d9f0',
  '#e8d5c4', '#c9e4de', '#d4c5e8',
  '#dce3f0', '#c7d9f0', '#e8d5c4',
  '#d4c5e8', '#c9e4de', '#dce3f0',
];

export const ProductGridBackground = () => {
  const { width } = useWindowDimensions();
  const gap = 10;
  const padding = 12;
  const cols = 3;
  const cardWidth = (width - padding * 2 - gap * (cols - 1)) / cols;
  const cardHeight = cardWidth * 1.15;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.grid, { paddingHorizontal: padding }]}>
        {CARD_COLORS.map((color, i) => (
          <View
            key={i}
            style={[
              styles.card,
              {
                width: cardWidth,
                height: cardHeight,
                backgroundColor: color,
                marginRight: (i + 1) % cols === 0 ? 0 : gap,
                marginBottom: gap,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
  },
  card: {
    borderRadius: 12,
  },
});
