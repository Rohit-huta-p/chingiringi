// Horizontal row of category tiles (79×86) — the buyer store/live browse
// filter. Replaces the old pill chips on the Live-First feed and drives the
// "Live now — See all" grid. The selected tile is filled brand blue.
import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts } from '../constants/theme';
import { STORE_CATEGORIES, type StoreCategory } from '../data/offlineStores';
import { CATEGORY_META, ALL_ICON } from '../constants/categories';

export type CategorySelection = StoreCategory | 'All';

const ALL_ACCENT = Colors.textSecondary; // the meta "All" tile has no category colour

const Tile: React.FC<{
  label: string;
  selected: boolean;
  accent: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
}> = ({ label, selected, accent, Icon, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[styles.tile, selected && styles.tileSelected]}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    {selected ? (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.primary }]} />
    ) : (
      <LinearGradient colors={['#ffffff', `${accent}29`]} style={StyleSheet.absoluteFill} />
    )}
    <Text
      style={[styles.label, { color: selected ? '#fff' : Colors.text }]}
      numberOfLines={2}
    >
      {label}
    </Text>
    <View style={styles.iconWrap}>
      <Icon size={30} color={selected ? '#fff' : accent} strokeWidth={2} />
    </View>
  </Pressable>
);

export const CategoryTiles: React.FC<{
  active: CategorySelection;
  onSelect: (c: CategorySelection) => void;
  contentStyle?: any;
}> = ({ active, onSelect, contentStyle }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={[styles.row, contentStyle]}
  >
    <Tile
      label="All"
      selected={active === 'All'}
      accent={ALL_ACCENT}
      Icon={ALL_ICON}
      onPress={() => onSelect('All')}
    />
    {STORE_CATEGORIES.map((c) => (
      <Tile
        key={c}
        label={c}
        selected={active === c}
        accent={CATEGORY_META[c].color}
        Icon={CATEGORY_META[c].Icon}
        onPress={() => onSelect(c)}
      />
    ))}
  </ScrollView>
);

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
});

export default CategoryTiles;
