import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { getCategoryMeta } from '../constants/categories';

// Four category shortcut tiles under the live hero. `label` is the themed copy;
// `category` is the real catalogue category a tap opens (CategoryProducts).
// The first tile replaces the mockup's "Today's Deals" — set it to any category.
const TILES: { label: string; category: string }[] = [
  { label: 'Electronics', category: 'Electronics' },
  { label: 'Fashion Finds', category: 'Fashion' },
  { label: 'Home Essentials', category: 'Home' },
  { label: 'Beauty Picks', category: 'Beauty' },
];

export function CategoryPromoGrid() {
  const navigation = useNavigation<any>();
  return (
    <View style={st.grid}>
      {TILES.map(({ label, category }) => {
        const meta = getCategoryMeta(category);
        const Icon = meta.Icon;
        return (
          <TouchableOpacity
            key={label}
            style={st.tile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CategoryProducts', { category })}
          >
            <Text style={st.tt} numberOfLines={2}>{label}</Text>
            <View style={st.ic}>
              {Icon ? <Icon size={26} color={meta.color || '#2563EB'} strokeWidth={2} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 14, gap: 12,
  },
  tile: {
    width: '48%', minHeight: 92, borderRadius: 16, padding: 14,
    backgroundColor: '#E9F4FF', borderWidth: 1, borderColor: '#D4E6FB',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden',
  },
  tt: { fontSize: 15.5, fontFamily: Fonts.extraBold, color: '#1E3A8A', lineHeight: 19, flex: 1, paddingRight: 6 },
  ic: {
    width: 50, height: 50, borderRadius: 14, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1E3A8A', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 2,
  },
});
