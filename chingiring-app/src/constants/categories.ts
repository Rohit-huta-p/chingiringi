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
  House,
  Utensils,
  Music,
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

// Icon + colour for the admin-managed PRODUCT categories (a different taxonomy
// from the 17 store categories above). Keyed lowercase; each mirrors its closest
// store sibling so the Products tiles match the Live Stores tiles. Extend this as
// admin adds product categories; anything unmapped falls back to a neutral tile.
const CATEGORY_ALIASES: Record<string, CategoryMeta> = {
  fashion: { color: '#F97316', Icon: Shirt },
  shoes: { color: '#8B5CF6', Icon: Footprints },
  home: { color: '#10B981', Icon: House },
  kitchen: { color: '#D97706', Icon: Utensils },
  kids: { color: '#FB7185', Icon: Baby },
  music: { color: '#0891B2', Icon: Music },
  electronics: { color: '#3B82F6', Icon: Smartphone },
  eletronics: { color: '#3B82F6', Icon: Smartphone }, // tolerate the current DB typo
};

// Case-insensitive view of CATEGORY_META, so a store category matches regardless
// of how its free-text value happens to be cased.
const META_BY_LOWER: Record<string, CategoryMeta> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k.toLowerCase(), v]),
);

/**
 * Safe lookup used by every category tile/chip (store AND product). Tries the
 * canonical store meta (exact, then case-insensitive), then the product aliases,
 * then a neutral fallback — so both surfaces render the same icon style.
 */
export const getCategoryMeta = (cat?: string): CategoryMeta => {
  if (!cat) return CATEGORY_FALLBACK;
  const key = cat.trim().toLowerCase();
  return (
    (CATEGORY_META as Record<string, CategoryMeta>)[cat] ??
    META_BY_LOWER[key] ??
    CATEGORY_ALIASES[key] ??
    CATEGORY_FALLBACK
  );
};

export const getCategoryColor = (cat?: string): string => getCategoryMeta(cat).color;

/** Icon for the meta "All" tile (no category colour of its own). */
export const ALL_ICON: IconType = LayoutGrid;

/** Flat colour map, back-compatible with the old inline CATEGORY_COLOR. */
export const CATEGORY_COLOR = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([k, v]) => [k, v.color]),
) as Record<StoreCategory, string>;

// ─── Shared category ORDER ──────────────────────────────────────────────────
// One canonical ordering used by BOTH the Live Stores tiles and the Products
// tiles, so the two rows stay consistent even though they draw from different
// category lists. The store categories keep their curated order; the product
// categories are interleaved next to their closest store sibling. Removing the
// product names leaves exactly STORE_CATEGORIES, so the Live row is unchanged.
// Names not listed here (e.g. a newly-added admin category) sort to the end A→Z.
export const CANONICAL_CATEGORY_ORDER: string[] = [
  'Beauty',
  'Electronics',
  'eletronics',
  "Women's Fashion",
  'Fashion',
  'Sneakers & Shoes',
  'Shoes',
  'Home & Garden',
  'Home',
  'Kitchen',
  'Video Games',
  'Music',
  'Toys',
  'Sports',
  'Baby & Kids',
  'Kids',
  'Rocks & Crystals',
  'Outdoors',
  "Men's Fashion",
  'Arts & Handmade',
  'Jewellery & Watches',
  'Bags & Accessories',
  'Antiques & Vintage Decor',
  'Wholesale & Deals',
];

const CATEGORY_ORDER_INDEX: Record<string, number> = Object.fromEntries(
  CANONICAL_CATEGORY_ORDER.map((n, i) => [n.toLowerCase(), i]),
);

/** Sort category names by the shared canonical order; unknowns go last (A→Z). */
export function sortCategoryNames<T extends string>(names: readonly T[]): T[] {
  return [...names].sort((a, b) => {
    const ia = CATEGORY_ORDER_INDEX[a.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
    const ib = CATEGORY_ORDER_INDEX[b.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
    return ia !== ib ? ia - ib : a.localeCompare(b);
  });
}
