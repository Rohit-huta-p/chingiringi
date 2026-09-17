// Horizontal row of category tiles (79×86) — the shared buyer category
// selector. Used by the Live Stores feed / See-all (fixed store categories with
// lucide icons) and the Products home (dynamic API categories with admin images
// or emoji). The selected tile is filled brand blue.
import React from 'react';
import { ScrollView, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../constants/theme';
import { STORE_CATEGORIES } from '../data/offlineStores';
import { CATEGORY_META, ALL_ICON } from '../constants/categories';

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

export const CategoryTiles: React.FC<{
  active: CategorySelection;
  onSelect: (c: CategorySelection) => void;
  /** Tiles to show after "All". Defaults to the fixed store categories. */
  items?: CategoryTileItem[];
  allLabel?: string;
  contentStyle?: any;
}> = ({ active, onSelect, items, allLabel = 'All', contentStyle }) => {
  const tiles: CategoryTileItem[] =
    items ??
    STORE_CATEGORIES.map((c) => ({ key: c, label: c, color: CATEGORY_META[c].color, Icon: CATEGORY_META[c].Icon }));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, contentStyle]}
    >
      <Tile
        label={allLabel}
        selected={active === 'All'}
        accent={ALL_ACCENT}
        Icon={ALL_ICON}
        onPress={() => onSelect('All')}
      />
      {tiles.map((t) => (
        <Tile
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
});

export default CategoryTiles;
