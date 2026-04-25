// Native fallback: no Mapbox GL on iOS/Android (mapbox-gl is web-only).
// When you build a native release, swap in `@rnmapbox/maps` here.
import React from 'react';
import type { Store } from '../data/offlineStores';
import { StoreMapPlaceholder } from './StoreMapPlaceholder';

export type StoreMapProps = {
  stores: Store[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export const StoreMap: React.FC<StoreMapProps> = (props) => {
  return <StoreMapPlaceholder {...props} />;
};
