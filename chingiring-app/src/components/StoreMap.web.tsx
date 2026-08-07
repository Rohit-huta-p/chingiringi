// Web implementation of <StoreMap />.
// - With EXPO_PUBLIC_MAPBOX_TOKEN: real interactive Mapbox map with custom
//   pastel style + React-rendered store pills.
// - Without token: falls back to <StoreMapPlaceholder /> so the screen
//   still looks correct for design review.
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
// react-map-gl v8 uses subpath imports
import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Moon, Sun, LocateFixed } from 'lucide-react-native';

import type { Store } from '../api/stores';
import { BENGALURU_CENTER } from '../data/offlineStores';
import { MAP_STYLE } from '../constants/mapStyle';
import { StoreMarkerPill } from './StoreMarkerPill';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  stores: Store[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Shopper's real GPS location; falls back to Bengaluru center when null. */
  userLocation?: { lat: number; lng: number } | null;
};

const MAPBOX_TOKEN: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const HAS_TOKEN = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.');
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

export const StoreMap: React.FC<StoreMapProps> = ({ stores, selectedId, onSelect, userLocation }) => {
  const me = userLocation ?? BENGALURU_CENTER;
  const mapRef = useRef<any>(null);

  // Initial center: the shopper's real location if we have it, else selected/first store.
  const initialView = useMemo(() => {
    const s = stores.find((x) => x._id === selectedId) ?? stores[0];
    const center = userLocation ?? (s ? { lat: s.lat, lng: s.lng } : BENGALURU_CENTER);
    return { longitude: center.lng, latitude: center.lat, zoom: 12.4 };
  }, [stores, selectedId, userLocation]);

  // Recenter on the shopper once GPS resolves (the map may mount before the fix).
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 12.8, duration: 800 });
    }
  }, [userLocation]);

  const [dark, setDark] = useState(false);
  // "Locate me" — fly to the shopper's GPS (falls back to Bengaluru center).
  const handleLocate = () => {
    mapRef.current?.flyTo({ center: [me.lng, me.lat], zoom: 13.5, duration: 900 });
  };

  if (!HAS_TOKEN) {
    return <StoreMapPlaceholder stores={stores} selectedId={selectedId} onSelect={onSelect} />;
  }

  return (
    <View style={styles.wrap}>
      <MapboxMap
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialView}
        mapStyle={(dark ? DARK_STYLE : MAP_STYLE) as any}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
      >
        {/* User location dot — real GPS when granted, else Bengaluru center */}
        <Marker longitude={me.lng} latitude={me.lat} anchor="center">
          <View style={styles.userPinWrap} pointerEvents="none">
            <View style={styles.userPinHalo} />
            <View style={styles.userPin} />
          </View>
        </Marker>

        {/* Store pills */}
        {stores.map((s) => (
          <Marker
            key={s._id}
            longitude={s.lng}
            latitude={s.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(s._id);
            }}
          >
            <StoreMarkerPill store={s} isSelected={s._id === selectedId} onPress={() => onSelect(s._id)} />
          </Marker>
        ))}

        {/* Zoom +/- in bottom-right */}
        <NavigationControl position="bottom-right" showCompass={false} />
      </MapboxMap>

      {/* Map controls — dark toggle + locate-me */}
      <View style={styles.controls}>
        <Pressable style={styles.ctrlBtn} onPress={() => setDark((d) => !d)} accessibilityLabel="Toggle dark map">
          {dark ? <Sun size={18} color="#0f172a" /> : <Moon size={18} color="#0f172a" />}
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={handleLocate} accessibilityLabel="Center on my location">
          <LocateFixed size={18} color="#4784E2" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F4F8F6',
  },
  controls: { position: 'absolute', top: 12, right: 12, gap: 8 },
  ctrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
