import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Search, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { categoriesAPI, Category } from '../../api/deals';
import { productsAPI, Product } from '../../api/products';
import { bannersAPI, Banner } from '../../api/banners';
import { ProductCard } from '../../components/ProductCard';
import { BannerBlock } from '../../components/BannerBlock';
import { CategoryTiles } from '../../components/CategoryTiles';
import { tint } from '../../utils/color';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Emoji stand-ins for the category chips (real category images can replace these
// once products/categories carry an imageUrl). Keyed case-insensitively.
const CATEGORY_EMOJI: Record<string, string> = {
  all: '🛍️', fashion: '👗', electronics: '📱', home: '🏠', grocery: '🛒',
  beauty: '💄', pharmacy: '💊', travel: '✈️', food: '🍔', snacks: '🍿',
  dairy: '🥛', fruits: '🥬', household: '🧻', kitchen: '🍳', office: '🗂️',
  fresh: '🥬', sweets: '🍫', drinks: '🥤', toys: '🧸',
};
function emojiFor(cat: string): string {
  return CATEGORY_EMOJI[cat.trim().toLowerCase()] ?? '🛒';
}

// Zero the first block's top margin so a top banner (or the first rail) sits
// flush under the header — no gap between the category header and the banner.
// Later blocks keep their own spacing.
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

// Banners render through the shared <BannerBlock> (hero | dual), placed by
// afterCategory (woven into categoryRailBlocks). The old local PromoBanner +
// banners[0] / every-2-rows placement was removed in the slot→position redesign.

// ─── Main screen ────────────────────────────────────────────────────────────

export const MobileHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const refresh = usePullToRefresh();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Normalise responses
  const allProducts: Product[] =
    productsRes?.data?.products ?? productsRes?.products ?? [];
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

  // Real category tile images (admin-uploaded), keyed by name. Empty → emoji.
  const categoryImageByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of apiCategories) if (c.imageUrl) m[c.name] = c.imageUrl;
    return m;
  }, [apiCategories]);

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
    () => categories.filter((c) => c !== 'All'),
    [categories],
  );

  // Tiles for the shared CategoryTiles selector — each product category with its
  // admin colour + image (emoji fallback).
  const categoryTileItems = useMemo(
    () =>
      categoryNames.map((name) => ({
        key: name,
        label: name,
        color: apiCategories.find((c) => c.name === name)?.color || undefined,
        imageUrl: categoryImageByName[name],
        emoji: emojiFor(name),
      })),
    [categoryNames, apiCategories, categoryImageByName],
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
    { kind: 'node', node: <View style={[st.bannerWrap, { marginTop: 0 }]}>{sk('100%', 130, 14)}</View>, key: 'sk-banner' },
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

  // (skeleton loading replaces the old full-screen spinner — header renders
  //  immediately; only backend-dependent chips + content show placeholders)

  // ── Header (kept as an element, not a function, so the search field keeps
  //    focus and the chips stay in sync as state changes). ──
  const headerEl = (
    <View>
      <MobileAuthHeader hideBack title="Products" align="left">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={st.searchBar}>
            <Search size={18} color={Colors.primary} />
            <TextInput
              style={st.searchInput}
              placeholder='Search products'
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => goResults(searchQuery.trim())}
            />
            <TouchableOpacity
              style={st.searchBtn}
              onPress={() => goResults(searchQuery.trim())}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Search size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </MobileAuthHeader>

      {/* Product category tiles — 79×86 gradient tiles (shared with Live Stores) */}
      <CategoryTiles
        active={selectedCategory}
        onSelect={setSelectedCategory}
        items={categoryTileItems}
        contentStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}
      />
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
      ListFooterComponent={<View style={{ height: 110 }} />}
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

  // Header
  header: {
    paddingTop: 10,
    paddingBottom: 6,

  },
  hrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  greetWrap: { alignItems: 'flex-start' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  greet: { fontSize: 12.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.9)' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  locText: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff', maxWidth: 220 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 13, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text, height: 44 },
  searchBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  chipsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingRight: 10 },
  chipsContent: { paddingHorizontal: 14, alignItems: 'center', gap: 18 },
  chip: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  chipIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E6EBF2',
    justifyContent: 'center', alignItems: 'center', marginBottom: 5,
  },
  chipIconOn: { backgroundColor: '#E9F4FF', borderColor: Colors.primary },
  chipEmoji: { fontSize: 22 },
  chipImg: { width: '100%', height: '100%', borderRadius: 14 },
  chipLabel: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.textSecondary, maxWidth: 64, textAlign: 'center' },
  chipLabelOn: { color: Colors.primary, fontFamily: Fonts.bold },
  chipUnderline: { height: 2.5, width: 26, borderRadius: 2, backgroundColor: Colors.primary, marginTop: 5 },

  // Placed banner wrapper — full-bleed (no side padding) so banners run
  // edge-to-edge; BannerBlock supplies the card itself.
  bannerWrap: { marginTop: 16 },

  // Promo banner
  banner: {
    height: 150, marginHorizontal: 16, marginTop: 16, borderRadius: 18,
    overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 18,
  },
  bannerBlobRight: {
    position: 'absolute', bottom: -40, right: -30,
    width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bannerContent: { maxWidth: '72%' },
  bannerTitle: { color: '#fff', fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontFamily: Fonts.medium, marginTop: 6 },
  bannerCta: {
    alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9,
  },
  bannerCtaText: { color: Colors.primary, fontSize: 12.5, fontFamily: Fonts.extraBold },

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  gridRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 12 },



  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: '#cbd5e1', textAlign: 'center' },
});
