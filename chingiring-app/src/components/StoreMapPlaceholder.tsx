import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MAP_PALETTE } from '../constants/mapStyle';

/**
 * Static styled map placeholder, shown when we are on a native platform
 * (no mapbox-gl available) or the EXPO_PUBLIC_MAPBOX_TOKEN env var is missing.
 * Renders a pastel grid with a centered "you are here" dot — a visual stand-in
 * until the live map is available.
 */
export const StoreMapPlaceholder: React.FC = () => {
  return (
    <View style={styles.wrap}>
      {/* Soft pastel green background w/ subtle radial highlight */}
      <View style={styles.bg} />

      {/* "Streets" — horizontal + vertical white grid lines */}
      <View style={styles.gridLayer} pointerEvents="none">
        {[18, 38, 58, 78].map((y) => (
          <View key={`h-${y}`} style={[styles.gridLine, styles.gridH, { top: `${y}%` }]} />
        ))}
        {[20, 40, 60, 80].map((x) => (
          <View key={`v-${x}`} style={[styles.gridLine, styles.gridV, { left: `${x}%` }]} />
        ))}
      </View>

      {/* Park patches */}
      <View style={[styles.park, { top: '12%', left: '8%', width: '22%', height: '24%' }]} />
      <View style={[styles.park, { top: '60%', right: '12%', width: '20%', height: '24%' }]} />
      <View style={[styles.park, { bottom: '8%', left: '30%', width: '18%', height: '18%' }]} />

      {/* Center user pin */}
      <View style={[styles.userPinWrap, { left: '50%', top: '50%' }]} pointerEvents="none">
        <View style={styles.userPinHalo} />
        <View style={styles.userPin} />
      </View>

      {/* Token-missing badge — small, bottom-center, only shown when no token */}
      <View style={styles.placeholderBadge} pointerEvents="none">
        <Text style={styles.placeholderBadgeText}>Static map preview · add EXPO_PUBLIC_MAPBOX_TOKEN for live map</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: MAP_PALETTE.bg,
    overflow: 'hidden',
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MAP_PALETTE.park,
    opacity: 0.4,
  },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.85,
  },
  gridH: { left: 0, right: 0, height: 14 },
  gridV: { top: 0, bottom: 0, width: 14 },
  park: {
    position: 'absolute',
    backgroundColor: MAP_PALETTE.park,
    borderRadius: 14,
    opacity: 0.9,
  },
  userPinWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPinHalo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4784E2',
    opacity: 0.18,
    top: -18,
    left: -18,
  },
  userPin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4784E2',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    top: -9,
    left: -9,
  },
  placeholderBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  placeholderBadgeText: {
    fontSize: 11,
    color: '#64748B',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
