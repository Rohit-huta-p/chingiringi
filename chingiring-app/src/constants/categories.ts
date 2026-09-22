// Category taxonomy → colour + icon, the single source used by the store
// category tiles/chips. Colours are per-category accents; icons come from
// lucide-react-native. Sellers can enter custom (free-text) categories, so all
// lookups by a store's `category` must go through getCategoryMeta()/
// getCategoryColor(), which fall back to a neutral tile for unknown values.
import type { ComponentType } from 'react';
import {
  Sparkles,
  Smartphone,
  Shirt,
  Footprints,
  Sprout,
  Gamepad2,
  ToyBrick,
  Dumbbell,
  Baby,
  Gem,
  Tent,
  Palette,
  Watch,
  ShoppingBag,
  Armchair,
  Tag,
  Store,
  LayoutGrid,
} from 'lucide-react-native';
import { type StoreCategory } from '../data/offlineStores';

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type CategoryMeta = { color: string; Icon: IconType };

export const CATEGORY_META: Record<StoreCategory, CategoryMeta> = {
  Beauty: { color: '#EC4899', Icon: Sparkles },
  Electronics: { color: '#3B82F6', Icon: Smartphone },
  "Women's Fashion": { color: '#F97316', Icon: Shirt },
  'Sneakers & Shoes': { color: '#8B5CF6', Icon: Footprints },
  'Home & Garden': { color: '#10B981', Icon: Sprout },
  'Video Games': { color: '#6366F1', Icon: Gamepad2 },
  Toys: { color: '#F59E0B', Icon: ToyBrick },
  Sports: { color: '#0EA5E9', Icon: Dumbbell },
  'Baby & Kids': { color: '#FB7185', Icon: Baby },
  'Rocks & Crystals': { color: '#14B8A6', Icon: Gem },
  Outdoors: { color: '#22C55E', Icon: Tent },
  "Men's Fashion": { color: '#0D9488', Icon: Shirt },
  'Arts & Handmade': { color: '#D946EF', Icon: Palette },
  'Jewellery & Watches': { color: '#A855F7', Icon: Watch },
  'Bags & Accessories': { color: '#EF4444', Icon: ShoppingBag },
  'Antiques & Vintage Decor': { color: '#B45309', Icon: Armchair },
  'Wholesale & Deals': { color: '#059669', Icon: Tag },
};

/** Neutral meta for a custom / unknown category (free-text values sellers type). */
export const CATEGORY_FALLBACK: CategoryMeta = { color: '#6B7280', Icon: Store };

/** Safe lookup — canonical categories get their meta, anything else the fallback. */
export const getCategoryMeta = (cat?: string): CategoryMeta =>
  (cat ? (CATEGORY_META as Record<string, CategoryMeta>)[cat] : undefined) ?? CATEGORY_FALLBACK;

export const getCategoryColor = (cat?: string): string => getCategoryMeta(cat).color;

/** Icon for the meta "All" tile (no category colour of its own). */
export const ALL_ICON: IconType = LayoutGrid;

/** Flat colour map, back-compatible with the old inline CATEGORY_COLOR. */
export const CATEGORY_COLOR = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color]),
) as Record<StoreCategory, string>;
