import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import type { Store } from '../api/stores';
import { StoreMarkerPill } from './StoreMarkerPill';
import { MAP_PALETTE } from '../constants/mapStyle';

type Props = {
  stores: Store[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Static styled map placeholder used when:
 *   - we are on a native platform (no mapbox-gl available), OR
 *   - the EXPO_PUBLIC_MAPBOX_TOKEN env var is missing.
 *
 * Renders a pastel grid that mimics the Figma design and positions the
 * pills using a simple linear projection of lat/lng into the container box.
 * Not pannable/zoomable — visual stand-in until the token is provided.
 */
export const StoreMapPlaceholder: React.FC<Props> = ({ stores, selectedId, onSelect }) => {
  // Project lat/lng into [0,1] x [0,1] for the container.
  const projected = useMemo(() => {
    if (stores.length === 0) return [];
    const lats = stores.map((s) => s.lat);
    const lngs = stores.map((s) => s.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padX = (maxLng - minLng) * 0.15 || 0.01;
    const padY = (maxLat - minLat) * 0.15 || 0.01;
    return stores.map((s) => ({
      ...s,
      // x grows east, y grows south (so lat is inverted)
      _x: ((s.lng - (minLng - padX)) / ((maxLng + padX) - (minLng - padX))) * 100,
      _y: 100 - ((s.lat - (minLat - padY)) / ((maxLat + padY) - (minLat - padY))) * 100,
    }));
  }, [stores]);

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

      {/* Store pills positioned by projected coords */}
      {projected.map((s) => (
        <View
          key={s._id}
          style={[styles.markerWrap, { left: `${s._x}%`, top: `${s._y}%` }]}
        >
          <StoreMarkerPill
            store={s}
            isSelected={s._id === selectedId}
            onPress={() => onSelect(s._id)}
          />
        </View>
      ))}

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
  markerWrap: {
    position: 'absolute',
    transform: [{ translateX: -45 }, { translateY: -16 }],
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
