// Web implementation of <StoreMap />.
// - With EXPO_PUBLIC_MAPBOX_TOKEN: a live Mapbox map centered on the shopper.
// - Without token: falls back to <StoreMapPlaceholder /> so the screen still renders.
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
// react-map-gl v8 uses subpath imports
import MapboxMap, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Moon, Sun, LocateFixed } from 'lucide-react-native';

import { BENGALURU_CENTER } from '../data/offlineStores';
import { MAP_STYLE } from '../constants/mapStyle';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  /** Shopper's real GPS location; falls back to Bengaluru center when null. */
  userLocation?: { lat: number; lng: number } | null;
};

const MAPBOX_TOKEN: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const HAS_TOKEN = !!MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.');
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

export const StoreMap: React.FC<StoreMapProps> = ({ userLocation }) => {
  const me = userLocation ?? BENGALURU_CENTER;
  const mapRef = useRef<any>(null);
  const [dark, setDark] = useState(false);

  const initialView = { longitude: me.lng, latitude: me.lat, zoom: 12.4 };

  // Recenter on the shopper once GPS resolves (the map may mount before the fix).
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 12.8, duration: 800 });
    }
  }, [userLocation]);

  // "Locate me" — fly to the shopper's GPS (falls back to Bengaluru center).
  const handleLocate = () => {
    mapRef.current?.flyTo({ center: [me.lng, me.lat], zoom: 13.5, duration: 900 });
  };

  if (!HAS_TOKEN) {
    return <StoreMapPlaceholder />;
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
