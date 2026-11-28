// Horizontal row of category tiles (79×86) — the shared buyer category
// selector. Used by the Live Stores feed / See-all (fixed store categories with
// lucide icons) and the Products home (dynamic API categories with admin images
// or emoji). The selected tile is filled brand blue.
import React from 'react';
import { ScrollView, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../constants/theme';
import { STORE_CATEGORIES } from '../data/offlineStores';
import { getCategoryMeta, ALL_ICON, sortCategoryNames } from '../constants/categories';

export type CategorySelection = string;

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** One selectable category tile. Provide an `Icon`, an `imageUrl`, or an `emoji`. */
export type CategoryTileItem = {
  key: string;
  label: string;
  color?: string;
  Icon?: IconType;
  imageUrl?: string;
  emoji?: string;
};

const ALL_ACCENT = Colors.textSecondary; // the meta "All" tile has no category colour

// Fallback tint palette for items with no explicit colour (e.g. product
// categories that carry no admin colour) — stable per category name.
const FALLBACK_COLORS = ['#F97316', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#0EA5E9', '#EC4899'];
function derivedColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

const Tile: React.FC<{
  label: string;
  selected: boolean;
  accent: string;
  Icon?: IconType;
  imageUrl?: string;
  emoji?: string;
  onPress: () => void;
}> = ({ label, selected, accent, Icon, imageUrl, emoji, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.tile, selected && styles.tileSelected]}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    {selected ? (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.primary }]} />
    ) : (
      <LinearGradient colors={['#ffffff', `${accent}80`]} style={StyleSheet.absoluteFill} />
    )}
    <Text style={[styles.label, { color: selected ? '#fff' : Colors.text }]} numberOfLines={2}>
      {label}
    </Text>
    <View style={styles.iconWrap}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.tileImg} resizeMode="cover" />
      ) : Icon ? (
        <Icon size={30} color={selected ? '#fff' : accent} strokeWidth={2} />
      ) : (
        <Text style={styles.emoji}>{emoji ?? '🛒'}</Text>
      )}
    </View>
  </Pressable>
);

// Compact tile — icon box over a small label (Products tab, mockup style).
// Selected = filled brand-blue box with a white icon.
const CompactTile: React.FC<{
  label: string;
  selected: boolean;
  accent: string;
  Icon?: IconType;
  imageUrl?: string;
  emoji?: string;
  onPress: () => void;
}> = ({ label, selected, Icon, imageUrl, emoji, onPress }) => (
  <Pressable
    onPress={onPress}
    style={styles.cTile}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <View style={[styles.cIcon, selected && styles.cIconSel]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.cImg} resizeMode="cover" />
      ) : Icon ? (
        // Uniform brand-blue icons (mockup style); white when the tile is selected.
        <Icon size={25} color={selected ? '#fff' : Colors.primary} strokeWidth={2} />
      ) : (
        <Text style={styles.cEmoji}>{emoji ?? '🛒'}</Text>
      )}
    </View>
    <Text style={[styles.cLabel, selected && styles.cLabelSel]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

export const CategoryTiles: React.FC<{
  active: CategorySelection;
  onSelect: (c: CategorySelection) => void;
  /** Tiles to show after "All". Defaults to the fixed store categories. */
  items?: CategoryTileItem[];
  allLabel?: string;
  contentStyle?: any;
  /** Compact icon-over-label strip (Products tab — mockup style). Default is the
   *  79×86 label-over-icon tiles used by the Live Stores feed / See-all. */
  compact?: boolean;
}> = ({ active, onSelect, items, allLabel = 'All', contentStyle, compact }) => {
  const tiles: CategoryTileItem[] =
    items ??
    sortCategoryNames(STORE_CATEGORIES).map((c) => {
      const meta = getCategoryMeta(c);
      return { key: c, label: c, color: meta.color, Icon: meta.Icon };
    });
  const TileComp = compact ? CompactTile : Tile;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[compact ? styles.rowCompact : styles.row, contentStyle]}
    >
      <TileComp
        label={allLabel}
        selected={active === 'All'}
        accent={ALL_ACCENT}
        Icon={ALL_ICON}
        onPress={() => onSelect('All')}
      />
      {tiles.map((t) => (
        <TileComp
          key={t.key}
          label={t.label}
          selected={active === t.key}
          accent={t.color || derivedColor(t.key)}
          Icon={t.Icon}
          imageUrl={t.imageUrl}
          emoji={t.emoji}
          onPress={() => onSelect(t.key)}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 2 },
  tile: {
    width: 79,
    height: 86,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eef1f5',
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tileSelected: { borderWidth: 2, borderColor: Colors.primary },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  iconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileImg: { width: 40, height: 40, borderRadius: 10 },
  emoji: { fontSize: 30 },

  // ── Compact variant (Products tab) — icon box over label, mockup style ──
  rowCompact: { gap: 16, paddingVertical: 2 },
  cTile: { width: 56, alignItems: 'center', gap: 6 },
  cIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E6EBF2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cIconSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cImg: { width: '100%', height: '100%' },
  cEmoji: { fontSize: 26 },
  cLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary, textAlign: 'center', maxWidth: 62 },
  cLabelSel: { fontFamily: Fonts.bold, color: Colors.primary },
});

export default CategoryTiles;
