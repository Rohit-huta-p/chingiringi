// Native fallback: no Mapbox GL on iOS/Android (mapbox-gl is web-only).
// When you build a native release, swap in `@rnmapbox/maps` here.
import React from 'react';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  userLocation?: { lat: number; lng: number } | null;
  // Web draws these as pins; the native placeholder ignores them for now.
  stores?: Array<{ _id: string; name: string; shortName?: string; lat?: number | null; lng?: number | null }>;
};

export const StoreMap: React.FC<StoreMapProps> = () => {
  return <StoreMapPlaceholder />;
};
