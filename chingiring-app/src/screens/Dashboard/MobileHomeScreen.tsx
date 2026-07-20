import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Coins, ChevronRight, ChevronDown } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { categoriesAPI, Category } from '../../api/deals';
import { productsAPI, Product } from '../../api/products';
import { bannersAPI, Banner, resolveBannerGradient } from '../../api/banners';
import { walletAPI } from '../../api/wallet';
import { ProductControlsBar } from '../../components/ProductControlsBar';
import {
  applyProductControls,
  DEFAULT_CONTROLS,
  isControlsActive,
} from '../../utils/productFilters';

// ─── Helpers ────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function priceFmt(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

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

// ─── Promo banner (renders admin banners) ───────────────────────────────────

function PromoBanner({ banner }: { banner?: Banner }) {
  const imageUrl = banner?.imageUrl;
  const title    = banner?.title    ?? 'Shop and earn coins';
  const subtitle = banner?.subtitle ?? '';
  const ctaLabel = banner?.ctaLabel;
  const colors   = banner
    ? resolveBannerGradient(banner)
    : (['#4784E2', '#2E6BD0'] as [string, string]);

  return (
    <TouchableOpacity style={st.banner} activeOpacity={0.92}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={st.bannerBlobRight} />
          <View style={st.bannerContent}>
            <Text style={st.bannerTitle}>{title}</Text>
            {subtitle ? <Text style={st.bannerSub}>{subtitle}</Text> : null}
            {ctaLabel ? (
              <View style={st.bannerCta}><Text style={st.bannerCtaText}>{ctaLabel}</Text></View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Product card (Zepto-style) ─────────────────────────────────────────────
// Real data only: image, price, coins earned, ADD. No fabricated MRP/rating.

function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[st.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View style={st.thumb}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, st.thumbFallback]}>
            <Text style={st.thumbLetter}>{product.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        {product.isFeatured ? (
          <View style={st.flag}><Text style={st.flagText}>Bestseller</Text></View>
        ) : null}
        <TouchableOpacity style={st.add} onPress={onPress} activeOpacity={0.8}>
          <Text style={st.addText}>ADD</Text>
        </TouchableOpacity>
      </View>

      <View style={st.pricePill}><Text style={st.pricePillText}>{priceFmt(product.price)}</Text></View>
      <Text style={st.name} numberOfLines={2}>{product.name}</Text>
      {product.category ? <Text style={st.qty} numberOfLines={1}>{product.category}</Text> : null}
      <View style={st.earn}>
        <Coins size={11} color="#a86b06" />
        <Text style={st.earnText}>Earn {product.coinsPrice.toLocaleString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export const MobileHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refresh = usePullToRefresh();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [controls, setControls] = useState(DEFAULT_CONTROLS);

  // Data fetching
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'home'],
    queryFn: () => productsAPI.getProducts({ limit: 24 }),
  });
  const { data: bannersRes } = useQuery({
    queryKey: ['banners'],
    queryFn: () => bannersAPI.getActiveBanners(),
  });
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });
  const { data: walletRes } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletAPI.getWallet(),
    enabled: isAuthenticated,
  });

  // Normalise responses
  const allProducts: Product[] =
    productsRes?.data?.products ?? productsRes?.products ?? [];
  const banners: Banner[] =
    bannersRes?.data?.banners ?? [];
  const apiCategories: Category[] =
    categoriesRes?.data?.categories ?? categoriesRes?.categories ?? [];
  const coinBalance: number =
    walletRes?.data?.wallet?.coins ?? walletRes?.data?.coins ?? 0;

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

  // Filter + search
  const filteredProducts = useMemo(() => {
    let p = allProducts;
    if (selectedCategory !== 'All') {
      p = p.filter((x) => x.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      p = p.filter((x) => x.name.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q));
    }
    return p;
  }, [allProducts, selectedCategory, searchQuery]);

  const isFiltering = selectedCategory !== 'All' || searchQuery.trim() !== '';
  const isListing = isFiltering || isControlsActive(controls);
  const listingProducts = applyProductControls(filteredProducts, controls);

  const categoryNames = useMemo(
    () => categories.filter((c) => c !== 'All'),
    [categories],
  );

  const handleProductPress = (p: Product) => {
    navigation.navigate('ProductDetail', { productId: p._id, product: p });
  };

  const RAIL_CARD_W = 150;
  const GRID_CARD_W = Math.floor((width - 16 * 2 - 12) / 2); // responsive 2-col, always fits

  if (productsLoading) {
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={st.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl {...refresh} />}
    >
      {/* ── Header (light-blue) ─────────────────────────────────────── */}
      <LinearGradient colors={['#E9F4FF', '#DCEBFF']} style={st.header}>
        <View style={st.hrow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.greet}>{greeting()}</Text>
            <TouchableOpacity style={st.locRow} activeOpacity={0.7}>
              <Text style={st.locText} numberOfLines={1}>{user?.name || 'Welcome'}</Text>
              <ChevronDown size={14} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <View style={st.coins}>
            <Coins size={13} color="#a86b06" />
            <Text style={st.coinsText}>{coinBalance.toLocaleString('en-IN')}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={st.avatar} activeOpacity={0.8}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={st.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={st.avatarInitial}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={st.searchRow}>
          <View style={st.searchBar}>
            <Search size={18} color={Colors.primary} />
            <TextInput
              style={st.searchInput}
              placeholder='Search products'
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={st.shortcut} onPress={() => navigation.navigate('Wallet')} activeOpacity={0.85}>
            <Coins size={16} color="#a86b06" />
            <Text style={st.shortcutText}>Coins</Text>
          </TouchableOpacity>
        </View>

        <View style={st.chipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={st.chipsContent}
          >
            {categories.map((cat) => {
              const on = selectedCategory === cat;
              return (
                <TouchableOpacity key={cat} style={st.chip} onPress={() => setSelectedCategory(cat)} activeOpacity={0.8}>
                  <View style={[st.chipIcon, on && st.chipIconOn]}>
                    {categoryImageByName[cat] ? (
                      <Image source={{ uri: categoryImageByName[cat] }} style={st.chipImg} resizeMode="cover" />
                    ) : (
                      <Text style={st.chipEmoji}>{emojiFor(cat)}</Text>
                    )}
                  </View>
                  <Text style={[st.chipLabel, on && st.chipLabelOn]} numberOfLines={1}>{cat}</Text>
                  {on ? <View style={st.chipUnderline} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={st.controlsWrap}>
            <ProductControlsBar state={controls} onChange={setControls} compact />
          </View>
        </View>
      </LinearGradient>

      {/* ── Listing: only matching products ──────────────────────────── */}
      {isListing ? (
        listingProducts.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>No products found</Text>
            <Text style={st.emptySub}>Try a different category, search, or filter</Text>
          </View>
        ) : (
          <View style={st.grid}>
            {listingProducts.map((p) => (
              <ProductCard key={p._id} product={p} width={GRID_CARD_W} onPress={() => handleProductPress(p)} />
            ))}
          </View>
        )
      ) : (
        /* ── Unfiltered home: promo + a horizontal rail per category ──── */
        <>
          {banners[0] ? <PromoBanner banner={banners[0]} /> : null}
          {categoryNames.map((cat, i) => {
            const catProducts = allProducts.filter(
              (p) => (p.category ?? '').trim().toLowerCase() === cat.trim().toLowerCase(),
            );
            if (catProducts.length === 0) return null;
            return (
              <View key={cat} style={st.sec}>
                <View style={st.secHead}>
                  <Text style={st.secTitle}>{cat}</Text>
                  <TouchableOpacity
                    style={st.seeAll}
                    onPress={() => navigation.navigate('CategoryProducts', { category: cat })}
                    activeOpacity={0.7}
                  >
                    <Text style={st.seeAllText}>See all</Text>
                    <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rail}>
                  {catProducts.slice(0, 10).map((p) => (
                    <ProductCard key={p._id} product={p} width={RAIL_CARD_W} onPress={() => handleProductPress(p)} />
                  ))}
                </ScrollView>
                {i % 2 === 1 && banners.length > 0 ? (
                  <PromoBanner banner={banners[(i + 1) % banners.length]} />
                ) : null}
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FF' },

  // Header
  header: {
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  hrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  greet: { fontSize: 12.5, fontFamily: Fonts.regular, color: '#475569' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  locText: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#1e293b', maxWidth: 180 },
  coins: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fdf3e0', borderWidth: 1, borderColor: '#f6e2b8',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  coinsText: { fontSize: 12.5, fontFamily: Fonts.extraBold, color: '#a86b06' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ddf7',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.primary },

  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 13, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text, height: 44 },
  shortcut: {
    width: 74, backgroundColor: '#fff', borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  shortcutText: { fontSize: 10.5, fontFamily: Fonts.bold, color: '#4a5568' },

  chipsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingRight: 10 },
  controlsWrap: { paddingBottom: 8, paddingLeft: 4 },
  chipsContent: { paddingHorizontal: 14, alignItems: 'flex-end', gap: 18 },
  chip: { alignItems: 'center', paddingBottom: 8 },
  chipIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 5,
  },
  chipIconOn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#bcd8fb' },
  chipEmoji: { fontSize: 22 },
  chipImg: { width: '100%', height: '100%', borderRadius: 14 },
  chipLabel: { fontSize: 11, fontFamily: Fonts.medium, color: '#475569', maxWidth: 64, textAlign: 'center' },
  chipLabelOn: { color: '#2E6BD0', fontFamily: Fonts.bold },
  chipUnderline: { height: 2.5, width: 26, borderRadius: 2, backgroundColor: Colors.primary, marginTop: 5 },

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

  // Product card
  card: { backgroundColor: 'transparent' },
  thumb: {
    height: 132, borderRadius: 13, backgroundColor: '#f4f7fc',
    borderWidth: 1, borderColor: '#eef2f7', position: 'relative', overflow: 'visible',
  },
  thumbFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef2f7', borderRadius: 13 },
  thumbLetter: { fontSize: 34, fontFamily: Fonts.extraBold, color: '#b8c4d6' },
  flag: {
    position: 'absolute', left: 0, top: 9, backgroundColor: '#fdeede',
    paddingHorizontal: 7, paddingVertical: 2, borderTopRightRadius: 6, borderBottomRightRadius: 6,
  },
  flagText: { fontSize: 9, fontFamily: Fonts.extraBold, color: '#a15a1e', textTransform: 'uppercase', letterSpacing: 0.4 },
  add: {
    position: 'absolute', right: 8, bottom: -13,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: Colors.primary, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 2,
  },
  addText: { fontSize: 12.5, fontFamily: Fonts.extraBold, color: Colors.primary, letterSpacing: 0.5 },
  pricePill: {
    alignSelf: 'flex-start', marginTop: 20,
    backgroundColor: Colors.success, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
  },
  pricePillText: { color: '#fff', fontSize: 12.5, fontFamily: Fonts.extraBold },
  name: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: '#28303c', marginTop: 6, lineHeight: 16, minHeight: 32 },
  qty: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  earn: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 7,
    backgroundColor: '#fdf3e0', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  earnText: { fontSize: 10.5, fontFamily: Fonts.extraBold, color: '#a86b06' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginBottom: 4 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: '#cbd5e1', textAlign: 'center' },
});
