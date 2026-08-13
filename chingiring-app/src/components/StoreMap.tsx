// Native fallback: no Mapbox GL on iOS/Android (mapbox-gl is web-only).
// When you build a native release, swap in `@rnmapbox/maps` here.
import React from 'react';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  userLocation?: { lat: number; lng: number } | null;
};

export const StoreMap: React.FC<StoreMapProps> = () => {
  return <StoreMapPlaceholder />;
};
