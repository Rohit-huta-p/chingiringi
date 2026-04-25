// Web implementation of <StoreMap />.
// - With EXPO_PUBLIC_MAPBOX_TOKEN: real interactive Mapbox map with custom
//   pastel style + React-rendered store pills.
// - Without token: falls back to <StoreMapPlaceholder /> so the screen
//   still looks correct for design review.
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
// react-map-gl v8 uses subpath imports
import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import type { Store } from '../data/offlineStores';
import { BENGALURU_CENTER } from '../data/offlineStores';
import { MAP_STYLE } from '../constants/mapStyle';
import { StoreMarkerPill } from './StoreMarkerPill';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  stores: Store[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const MAPBOX_TOKEN: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const HAS_TOKEN = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.');

export const StoreMap: React.FC<StoreMapProps> = ({ stores, selectedId, onSelect }) => {
  // Compute initial view: center on selected store (if any) or average of all
  const initialView = useMemo(() => {
    const s = stores.find((x) => x.id === selectedId) ?? stores[0];
    return {
      longitude: s?.lng ?? BENGALURU_CENTER.lng,
      latitude: s?.lat ?? BENGALURU_CENTER.lat,
      zoom: 12.4,
    };
  }, [stores, selectedId]);

  if (!HAS_TOKEN) {
    return <StoreMapPlaceholder stores={stores} selectedId={selectedId} onSelect={onSelect} />;
  }

  return (
    <View style={styles.wrap}>
      <MapboxMap
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialView}
        // @ts-expect-error — our hand-written style JSON is valid at runtime; mapbox-gl types are strict.
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
      >
        {/* User location dot — center of Bengaluru by default */}
        <Marker longitude={BENGALURU_CENTER.lng} latitude={BENGALURU_CENTER.lat} anchor="center">
          <View style={styles.userPinWrap} pointerEvents="none">
            <View style={styles.userPinHalo} />
            <View style={styles.userPin} />
          </View>
        </Marker>

        {/* Store pills */}
        {stores.map((s) => (
          <Marker
            key={s.id}
            longitude={s.lng}
            latitude={s.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(s.id);
            }}
          >
            <StoreMarkerPill store={s} isSelected={s.id === selectedId} onPress={() => onSelect(s.id)} />
          </Marker>
        ))}

        {/* Zoom +/- in bottom-right */}
        <NavigationControl position="bottom-right" showCompass={false} />
      </MapboxMap>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F4F8F6',
  },
  userPinWrap: {
    width: 36,
    height: 36,
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
  },
  userPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4784E2',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
