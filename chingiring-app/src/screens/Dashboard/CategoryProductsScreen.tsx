import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { productsAPI, Product } from '../../api/products';
import { ProductControlsBar } from '../../components/ProductControlsBar';
import { ProductCard } from '../../components/ProductCard';
import { applyProductControls, DEFAULT_CONTROLS } from '../../utils/productFilters';



// ─── Screen ───────────────────────────────────────────────────────────────────

export const CategoryProductsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [searchQuery, setSearchQuery] = useState('');

  // Param key matches the `{ category }` JS-navigation payload; `name` is a
  // fallback for a deep-linked `/category/:category` URL that parses to `name`
  // on some navigator shapes.
  const category: string = route.params?.category ?? route.params?.name ?? 'All';
  const isAll = category === 'All';
  const title = isAll ? 'All Products' : category;

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ['products', 'catalog'],
    queryFn: () => productsAPI.getProducts({ limit: 100 }),
  });

  const allProducts: Product[] =
    productsRes?.data?.products ?? productsRes?.products ?? [];

  // Same case-insensitive category match the Home screens use, so a category
  // page shows exactly what its Home section previews.
  const products = isAll
    ? allProducts
    : allProducts.filter(
        (p) => (p.category ?? '').trim().toLowerCase() === category.trim().toLowerCase(),
      );

  // Search on top of the category filter, matching /home (name + description),
  // then sort + range filters.
  const q = searchQuery.trim().toLowerCase();
  const bySearch = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q),
      )
    : products;
  const shown = applyProductControls(bySearch, controls);

  const isNarrow = width < 768;
  const H_PAD = 16;
  const GAP = 12;
  // On web the permanent sidebar (~250px) eats into the window width; cap the
  // catalogue so cards don't stretch on very wide screens.
  const usableW = (isNarrow ? width : Math.min(width - 250, 1200)) - H_PAD * 2;
  const cols = isNarrow ? 2 : usableW > 900 ? 5 : usableW > 640 ? 4 : 3;
  const cardW = Math.floor((usableW - GAP * (cols - 1)) / cols);

  const handleProductPress = (p: Product) => {
    navigation.navigate('ProductDetail', { productId: p._id, product: p });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {products.length > 0 && (
          <View style={s.headerSearch}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              style={s.headerSearchInput}
              placeholder="Search..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
        )}
        <ProductControlsBar state={controls} onChange={setControls} compact={isNarrow} />
      </View>

      {isLoading ? (
        <View style={s.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : products.length === 0 ? (
        <View style={s.centre}>
          <Text style={s.emptyTitle}>No products found</Text>
          <Text style={s.emptySub}>There are no products in this category yet.</Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={s.centre}>
          <Text style={s.emptyTitle}>No matches</Text>
          <Text style={s.emptySub}>Nothing matches your search or filters.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.count}>
            {shown.length} {shown.length === 1 ? 'item' : 'items'}
          </Text>
          <View style={[s.grid, { gap: GAP }]}>
            {shown.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                width={cardW}
                onPress={() => handleProductPress(p)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },

  headerSearch: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 38,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    paddingVertical: 0,
  },

  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  scrollContent: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  count: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    maxWidth: 1200,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    maxWidth: 1200,
    width: '100%',
  },


});
