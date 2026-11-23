import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { ChevronRight, Coins, Info } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { categoriesAPI, Category } from '../../api/deals';
import { productsAPI, Product } from '../../api/products';
import { bannersAPI, Banner } from '../../api/banners';
import { ProductCard } from '../../components/ProductCard';
import { BannerBlock } from '../../components/BannerBlock';
import { CategoryTiles } from '../../components/CategoryTiles';
import { ProductsHeader } from '../../components/ProductsHeader';
import { LiveNowHero } from '../../components/LiveNowHero';
import { CategoryPromoGrid } from '../../components/CategoryPromoGrid';
import { LiveStoresNowRail } from '../../components/LiveStoresNowRail';
import { getCategoryMeta, sortCategoryNames } from '../../constants/categories';
import { tint } from '../../utils/color';
import { seededShuffle, makeShuffleSeed } from '../../utils/seededShuffle';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Zero the first block's top margin so a top banner (or the first rail) sits
// flush under the curated sections above. Later blocks keep their own spacing.
function flushFirst(nodes: React.ReactNode[]): React.ReactNode[] {
  if (nodes.length === 0) return nodes;
  const [first, ...rest] = nodes;
  if (!React.isValidElement(first)) return nodes;
  const el = first as React.ReactElement<any>;
  return [React.cloneElement(el, { style: [el.props.style, { marginTop: 0 }] }), ...rest];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Rows the home FlatList renders below the header. `node` = a pre-built curated
// block (rail/banner); `gridRow` = a 3-up row in filter/listing mode.
type HomeItem =
  | { kind: 'node'; node: React.ReactNode; key: string }
  | { kind: 'gridRow'; products: Product[]; key: string }
  | { kind: 'empty'; key: string };

// ─── Main screen ────────────────────────────────────────────────────────────

export const MobileHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const refresh = usePullToRefresh();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Per-visit shuffle seed — fixed for the screen's lifetime so the 30s refetch
  // (and pull-to-refresh) never reorders products under the user; a fresh mount reshuffles.
  const [shuffleSeed] = useState(makeShuffleSeed);

  // Data fetching
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'home'],
    queryFn: () => productsAPI.getProducts({ limit: 100 }),
  });
  const { data: bannersRes } = useQuery({
    queryKey: ['banners'],
    queryFn: () => bannersAPI.getActiveBanners(),
  });
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });

  // Shimmer pulse — one Animated.Value drives all skeleton placeholders in unison.
  const shimmerAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!productsLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [productsLoading, shimmerAnim]);

  // Normalise responses. Products arrive newest-first (createdAt desc); shuffle
  // once per visit (seeded) so the feed isn't ordered by recency — every rail and
  // grid below derives from allProducts, so they all inherit the shuffled order.
  const allProducts: Product[] = useMemo(() => {
    const raw = productsRes?.data?.products ?? productsRes?.products ?? [];
    return seededShuffle(raw, shuffleSeed);
  }, [productsRes, shuffleSeed]);
  const banners: Banner[] =
    bannersRes?.data?.banners ?? [];
  const apiCategories: Category[] =
    categoriesRes?.data?.categories ?? categoriesRes?.categories ?? [];

  // Category chips: "All" + only categories that actually have a product.
  const categories = useMemo(() => {
    const withProducts = new Set(
      allProducts.map((p) => (p.category ?? '').trim().toLowerCase()).filter(Boolean),
    );
    return [
      'All',
      ...apiCategories
        .filter((c) => c.isActive !== false && withProducts.has(c.name.trim().toLowerCase()))
        .map((c) => c.name),
    ];
  }, [apiCategories, allProducts]);

  // The selected category's admin-set color still tints the content background
  // below the (now fixed-gradient, OfflineStores-style) header.
  const themeColor = apiCategories.find((c) => c.name === selectedCategory)?.color || '';

  // A category chip lists that category inline (with the header theming). Search
  // navigates to the paginated Results page (see the header search button);
  // sort/filter now live on that Results page, not the home.
  const listingProducts = useMemo(
    () =>
      selectedCategory === 'All'
        ? []
        : allProducts.filter(
          (x) => (x.category ?? '').toLowerCase() === selectedCategory.toLowerCase(),
        ),
    [allProducts, selectedCategory],
  );
  const isListing = selectedCategory !== 'All';

  // Open the paginated Results page, carrying the current category + optional search.
  const goResults = (search?: string) =>
    navigation.navigate('CategoryProducts', {
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      search: search || undefined,
    });

  const categoryNames = useMemo(
    () => sortCategoryNames(categories.filter((c) => c !== 'All')),
    [categories],
  );

  // Tiles for the shared CategoryTiles selector — icon + colour via the shared
  // resolver so the Products row matches the Live Stores row (icons on both).
  const categoryTileItems = useMemo(
    () =>
      categoryNames.map((name) => {
        const meta = getCategoryMeta(name);
        return { key: name, label: name, color: meta.color, Icon: meta.Icon };
      }),
    [categoryNames],
  );

  const handleProductPress = (p: Product) => {
    navigation.navigate('ProductDetail', { productId: p._id, product: p });
  };

  const RAIL_CARD_W = 150;
  const GRID_CARD_W = Math.floor((width - 16 * 2 - 12 * 2) / 3); // responsive 3-col, always fits

  // ── Skeleton placeholders (shimmer pulse on backend-dependent content) ────
  const sk = (w: number | string, h: number, r = 8) => (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: '#dde3ea', opacity: shimmerAnim }} />
  );

  const skeletonRail = (key: string, titleW = 100) => (
    <View key={key} style={st.sec}>
      <View style={st.secHead}>
        {sk(titleW, 16)}
        {sk(50, 12, 6)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rail}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ width: RAIL_CARD_W, borderRadius: 12 }}>
            {sk(RAIL_CARD_W, 110, 12)}
            <View style={{ padding: 8, gap: 6 }}>
              {sk('80%', 11, 4)}
              {sk('50%', 13, 4)}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const skeletonContent: HomeItem[] = [
    { kind: 'node', node: skeletonRail('sk-rail-1', 110), key: 'sk-rail-1' },
    { kind: 'node', node: skeletonRail('sk-rail-2', 80), key: 'sk-rail-2' },
  ];

  // One horizontal rail: title + "See all" + up to 10 cards. Shared by the
  // "All Products" rail and every per-category rail.
  const renderRail = (
    key: string,
    title: string,
    railProducts: Product[],
    seeAllCategory: string,
  ): React.ReactNode => (
    <View key={key} style={st.sec}>
      <View style={st.secHead}>
        <Text style={st.secTitle}>{title}</Text>
        <TouchableOpacity
          style={st.seeAll}
          onPress={() => navigation.navigate('CategoryProducts', { category: seeAllCategory })}
          activeOpacity={0.7}
        >
          <Text style={st.seeAllText}>See all</Text>
          <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rail}>
        {railProducts.slice(0, 10).map((p) => (
          <ProductCard key={p._id} product={p} width={RAIL_CARD_W} onPress={() => handleProductPress(p)} />
        ))}
      </ScrollView>
    </View>
  );

  // Curated home = an "All Products" rail first, then one rail per category,
  // with banners woven in by category: each banner renders right after the
  // category the admin picked (afterCategory). Empty = top of the page; a
  // banner whose category isn't shown falls to the bottom.
  const categoryRailBlocks = (): React.ReactNode[] => {
    const norm = (v?: string) => (v ?? '').trim().toLowerCase();
    const renderMobileBanner = (b: Banner) => (
      <View key={`banner-${b._id}`} style={st.bannerWrap}>
        <BannerBlock banner={b} navigation={navigation} isMobile />
      </View>
    );
    const shownCats = new Set(
      categoryNames.filter((cat) => allProducts.some((p) => norm(p.category) === norm(cat))).map(norm),
    );
    const topBanners = banners.filter((b) => !norm(b.afterCategory));
    const orphanBanners = banners.filter(
      (b) => norm(b.afterCategory) && !shownCats.has(norm(b.afterCategory)),
    );
    const bannersAfter = (cat: string) => banners.filter((b) => norm(b.afterCategory) === norm(cat));

    const blocks: React.ReactNode[] = [];
    topBanners.forEach((b) => blocks.push(renderMobileBanner(b)));
    if (allProducts.length) {
      blocks.push(renderRail('all-products', 'All Products', allProducts, 'All'));
    }
    categoryNames.forEach((cat) => {
      const catProducts = allProducts.filter(
        (p) => (p.category ?? '').trim().toLowerCase() === cat.trim().toLowerCase(),
      );
      if (catProducts.length === 0) return;
      blocks.push(renderRail(`cat-${cat}`, cat, catProducts, cat));
      bannersAfter(cat).forEach((b) => blocks.push(renderMobileBanner(b)));
    });
    orphanBanners.forEach((b) => blocks.push(renderMobileBanner(b)));
    return blocks;
  };

  // ── Header: rich Products header + category selector, then (in discovery
  //    mode only) the live hero and the 2×2 category shortcut tiles. ──
  const headerEl = (
    <View>
      <ProductsHeader
        searchQuery={searchQuery}
        onChangeSearch={setSearchQuery}
        onSubmitSearch={() => goResults(searchQuery.trim())}
      />
      <CategoryTiles
        active={selectedCategory}
        onSelect={setSelectedCategory}
        items={categoryTileItems}
        contentStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}
      />
      {!isListing ? (
        <>
          <LiveNowHero />
          <CategoryPromoGrid />
        </>
      ) : null}
    </View>
  );

  // Footer: in discovery mode, the circular "Stores Live Now" rail and the
  // info-only CR Coins strip; then the tab-bar clearance spacer.
  const footerEl = (
    <View>
      {!isListing ? <LiveStoresNowRail /> : null}
      {!isListing ? (
        <View style={st.crbar}>
          <Coins size={22} color="#F5B301" strokeWidth={2.2} />
          <View style={st.crDivider} />
          <Text style={st.crTxt}>Earn CR Coins on every activity</Text>
          <Info size={16} color="#9db7d6" strokeWidth={2.2} />
        </View>
      ) : null}
      <View style={{ height: 110 }} />
    </View>
  );

  // Rows below the header. Filter/search → 3-up grid rows; otherwise the curated
  // rails/banners. Each is one FlatList item so only visible rows mount (native
  // virtualization — this is the scroll-lag fix).
  const listData: HomeItem[] = productsLoading
    ? skeletonContent
    : isListing
      ? (listingProducts.length === 0
        ? [{ kind: 'empty', key: 'empty' }]
        : chunk(listingProducts, 3).map((row, i) => ({ kind: 'gridRow', products: row, key: `grid-${i}` })))
      : flushFirst(categoryRailBlocks()).map((node, i) => ({ kind: 'node', node, key: `block-${i}` }));

  const renderHomeItem = ({ item }: { item: HomeItem }) => {
    if (item.kind === 'empty') {
      return (
        <View style={st.empty}>
          <Text style={st.emptyTitle}>No products found</Text>
          <Text style={st.emptySub}>Try a different category, search, or filter</Text>
        </View>
      );
    }
    if (item.kind === 'gridRow') {
      return (
        <View style={st.gridRow}>
          {item.products.map((p) => (
            <ProductCard key={p._id} product={p} width={GRID_CARD_W} onPress={() => handleProductPress(p)} />
          ))}
        </View>
      );
    }
    return <>{item.node}</>;
  };

  return (
    <FlatList
      style={[st.container, themeColor ? { backgroundColor: tint(themeColor, 0.94) } : null]}
      data={listData}
      keyExtractor={(it) => it.key}
      renderItem={renderHomeItem}
      ListHeaderComponent={headerEl}
      ListFooterComponent={footerEl}
      refreshControl={<RefreshControl {...refresh} />}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={6}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
    />
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },

  // Placed banner wrapper — full-bleed (no side padding) so banners run
  // edge-to-edge; BannerBlock supplies the card itself.
  bannerWrap: { marginTop: 16 },

  // Section
  sec: { marginTop: 6 },
  secHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 18, marginBottom: 2,
  },
  secTitle: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  rail: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 12 },

  // Grid (listing mode)
  gridRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 12 },

  // CR Coins — info-only strip (no navigation)
  crbar: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginTop: 18, marginHorizontal: 16,
    backgroundColor: '#E9F4FF', borderWidth: 1, borderColor: '#D4E6FB',
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15,
  },
  crDivider: { width: 1, height: 22, backgroundColor: '#bcd6f3' },
  crTxt: { flex: 1, fontSize: 13.5, fontFamily: Fonts.bold, color: '#1E3A8A' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: '#cbd5e1', textAlign: 'center' },
});
