import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { productsAPI, Product } from '../../api/products';
import { categoriesAPI, Category } from '../../api/deals';
import { ProductControlsBar } from '../../components/ProductControlsBar';
import { ProductCard } from '../../components/ProductCard';
import {
  DEFAULT_CONTROLS,
  ProductControlsState,
  controlsToQuery,
} from '../../utils/productFilters';
import { MerchantSearchStrip } from '../../components/MerchantSearchStrip';

// ─── Results page ─────────────────────────────────────────────────────────────
// The single destination for search / sort / filter / a category "See all".
// Everything runs server-side (getProducts) with infinite-scroll pagination, so
// it scales past the home's 100-item snapshot. Reached with any of:
//   { category?, search?, controls? }  (all optional).

const PAGE_SIZE = 24;

export const CategoryProductsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width } = useWindowDimensions();

  const routeCategory: string = route.params?.category ?? route.params?.name ?? '';
  const routeSearch: string = route.params?.search ?? '';
  const routeControls: Partial<ProductControlsState> = route.params?.controls ?? {};

  const [controls, setControls] = useState<ProductControlsState>({
    ...DEFAULT_CONTROLS,
    ...routeControls,
    category:
      routeCategory && routeCategory !== 'All'
        ? routeCategory
        : routeControls.category ?? '',
  });
  const [searchInput, setSearchInput] = useState(routeSearch);
  const [search, setSearch] = useState(routeSearch); // submitted term (drives the query)

  // Debounce live search — fire 250ms after the user stops typing.
  // onSubmitEditing still calls setSearch immediately for keyboard-submit.
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearch('');
      return;
    }
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Category names for the filter facet.
  const { data: catsRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 5 * 60_000,
  });
  const categoryNames: string[] = (
    ((catsRes as any)?.data?.categories ?? (catsRes as any)?.categories ?? []) as Category[]
  )
    .filter((c) => c.isActive !== false)
    .map((c) => c.name);

  const query = controlsToQuery(controls, { search });

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['products', 'results', query],
      queryFn: ({ pageParam }) =>
        productsAPI.getProducts({ ...query, page: pageParam, limit: PAGE_SIZE }),
      initialPageParam: 1,
      getNextPageParam: (last: any) => {
        const pg = last?.data?.pagination;
        return pg && pg.page < pg.pages ? pg.page + 1 : undefined;
      },
    });

  const products: Product[] = (data?.pages ?? []).flatMap(
    (pg: any) => pg?.data?.products ?? [],
  );
  const total: number = (data?.pages?.[0] as any)?.data?.pagination?.total ?? 0;
  const nearMisses: Product[] = (data?.pages?.[0] as any)?.data?.nearMisses ?? [];

  const title =
    controls.category && controls.category !== 'All'
      ? controls.category
      : search
        ? `“${search}”`
        : 'All Products';

  const isNarrow = width < 768;
  const H_PAD = 16;
  const GAP = 12;
  const usableW = (isNarrow ? width : Math.min(width - 250, 1200)) - H_PAD * 2;
  const cols = isNarrow ? 3 : usableW > 900 ? 5 : usableW > 640 ? 4 : 3;
  const cardW = Math.floor((usableW - GAP * (cols - 1)) / cols);

  const handleProductPress = (p: Product) =>
    navigation.navigate('ProductDetail', { productId: p._id, product: p });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerSearch}>
          <Search size={16} color={Colors.textSecondary} />
          <TextInput
            style={s.headerSearchInput}
            placeholder="Search products"
            placeholderTextColor="#94a3b8"
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => setSearch(searchInput.trim())}
            returnKeyType="search"
          />
        </View>
        <ProductControlsBar
          state={controls}
          onChange={setControls}
          categories={categoryNames}
          compact
        />
      </View>

      {isLoading ? (
        <View style={s.centre}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isError ? (
        <View style={s.centre}>
          <Text style={s.emptyTitle}>Couldn’t load results</Text>
          <Text style={s.emptySub}>Check your connection and try again.</Text>
        </View>
      ) : products.length === 0 ? (
        <FlatList
          // key must encode BOTH cols and whether nearMisses are present.
          // React Native forbids changing numColumns without remounting.
          key={nearMisses.length > 0 ? `empty-grid-${cols}` : 'empty-no-grid'}
          data={nearMisses}
          keyExtractor={(p) => p._id}
          numColumns={nearMisses.length > 0 ? cols : 1}
          columnWrapperStyle={
            nearMisses.length > 0
              ? { gap: GAP, paddingHorizontal: H_PAD }
              : undefined
          }
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <View style={s.centre}>
              <Text style={s.emptyTitle}>No products found</Text>
              {search && nearMisses.length > 0 ? (
                <Text style={s.emptySub}>No exact match — closest in store:</Text>
              ) : (
                <Text style={s.emptySub}>Nothing matches your search or filters.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} width={cardW} onPress={() => handleProductPress(item)} />
          )}
          ListFooterComponent={
            search ? <MerchantSearchStrip searchQuery={search} /> : <View style={{ height: 40 }} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key={cols}
          data={products}
          keyExtractor={(p) => p._id}
          numColumns={cols}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: H_PAD }}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <Text style={s.count}>
              {title} · {total} {total === 1 ? 'result' : 'results'}
            </Text>
          }
          renderItem={({ item }) => (
            <ProductCard product={item} width={cardW} onPress={() => handleProductPress(item)} />
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            <>
              {isFetchingNextPage ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.primary} />
              ) : null}
              {search && !hasNextPage ? (
                <MerchantSearchStrip searchQuery={search} title="Also search on:" />
              ) : null}
              <View style={{ height: 40 }} />
            </>
          }
          showsVerticalScrollIndicator={false}
        />
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

  listContent: { paddingTop: 12, paddingBottom: 24, gap: 12 },
  count: {
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
});
