import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, Coins, Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { productsAPI, Product } from '../../api/products';
import { ProductControlsBar } from '../../components/ProductControlsBar';
import { applyProductControls, DEFAULT_CONTROLS } from '../../utils/productFilters';

// ─── Helpers ────────────────────────────────────────────────────────────────

function priceFmt(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  const lowStock = product.stock > 0 && product.stock <= 10;
  return (
    <TouchableOpacity style={[s.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardImageBox}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, s.cardImageFallback]}>
            <Text style={s.cardImageLetter}>{product.name?.[0] ?? '?'}</Text>
          </View>
        )}
        {lowStock && (
          <View style={s.stockBadge}>
            <Text style={s.stockBadgeText}>{product.stock} left</Text>
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{product.name}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{product.description}</Text>
        <Text style={s.cardPrice}>{priceFmt(product.price)}</Text>
        <View style={s.coinsPill}>
          <Coins size={11} color={Colors.primary} />
          <Text style={s.coinsPillText}>{product.coinsPrice.toLocaleString('en-IN')} coins</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
      ) : (
        <>
          <View style={s.searchWrap}>
            <View style={s.searchBox}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={s.searchInput}
                placeholder="Search products, brands..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
            </View>
          </View>
          {shown.length === 0 ? (
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
        </>
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
    flex: 1,
    marginHorizontal: 12,
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  searchInput: {
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

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.background,
  },
  cardImageFallback: { justifyContent: 'center', alignItems: 'center' },
  cardImageLetter: { fontSize: 32, fontFamily: Fonts.extraBold, color: Colors.primaryLight },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockBadgeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  cardDesc: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, minHeight: 28 },
  cardPrice: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.text, marginTop: 2 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coinsPillText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.primary },
});
