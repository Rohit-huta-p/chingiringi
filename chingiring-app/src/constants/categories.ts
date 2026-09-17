// Category taxonomy → colour + icon, the single source used by the store
// category tiles/chips. Colours mirror the hexes that were previously inlined
// in OfflineStoresScreen; icons come from lucide-react-native.
import type { ComponentType } from 'react';
import {
  Shirt,
  Smartphone,
  ShoppingBasket,
  Coffee,
  HeartPulse,
  Gem,
  Dumbbell,
  Sparkles,
  LayoutGrid,
} from 'lucide-react-native';
import type { StoreCategory } from '../data/offlineStores';

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const CATEGORY_META: Record<StoreCategory, { color: string; Icon: IconType }> = {
  Fashion: { color: '#F97316', Icon: Shirt },
  Electronics: { color: '#3B82F6', Icon: Smartphone },
  Grocery: { color: '#10B981', Icon: ShoppingBasket },
  'Food & Cafe': { color: '#F59E0B', Icon: Coffee },
  Health: { color: '#EF4444', Icon: HeartPulse },
  Jewellery: { color: '#A855F7', Icon: Gem },
  Sports: { color: '#0EA5E9', Icon: Dumbbell },
  Beauty: { color: '#EC4899', Icon: Sparkles },
};

/** Icon for the meta "All" tile (no category colour of its own). */
export const ALL_ICON: IconType = LayoutGrid;

/** Flat colour map, back-compatible with the old inline CATEGORY_COLOR. */
export const CATEGORY_COLOR = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color]),
) as Record<StoreCategory, string>;
