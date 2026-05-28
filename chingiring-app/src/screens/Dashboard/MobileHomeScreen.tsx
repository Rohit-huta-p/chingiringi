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
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Star, Coins } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { categoriesAPI, Category } from '../../api/deals';
import { productsAPI, Product } from '../../api/products';
import { bannersAPI, Banner, resolveBannerGradient } from '../../api/banners';

// ─── Helpers ────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning!';
  if (h < 17) return 'Good Afternoon!';
  return 'Good Evening!';
}

function priceFmt(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Category emoji icons (legacy horizontal-scroll row) ────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  Fashion: '👗', Electronics: '📱', Home: '🏠',
  Pharmacy: '💊', Travel: '✈️', Food: '🍔', All: '🔥',
};

const PRODUCT_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=75',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=75',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=75',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=75',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=75',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&q=75',
];

const FALLBACK_PRODUCTS: Product[] = [
  { _id: 'p1', name: 'Wireless Headphones', description: 'Premium noise-cancelling headphones with 30hr battery', category: 'Electronics', price: 2999,  coinsPrice: 15000, imageUrl: PRODUCT_FALLBACK_IMAGES[0], stock: 50, sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
  { _id: 'p2', name: 'Smart Watch',         description: 'Fitness tracking smartwatch with heart rate monitor', category: 'Electronics', price: 4999,  coinsPrice: 25000, imageUrl: PRODUCT_FALLBACK_IMAGES[1], stock: 30, sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
  { _id: 'p3', name: 'Travel Backpack',     description: 'Durable waterproof backpack',                          category: 'Fashion',     price: 1499,  coinsPrice: 7500,  imageUrl: PRODUCT_FALLBACK_IMAGES[2], stock: 8,  sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
  { _id: 'p4', name: 'Portable Speaker',    description: '360° surround sound, IPX7 waterproof, 12hr battery',   category: 'Electronics', price: 1899,  coinsPrice: 9500,  imageUrl: PRODUCT_FALLBACK_IMAGES[3], stock: 20, sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
  { _id: 'p5', name: 'Cotton T-Shirt',      description: 'Premium organic cotton blend',                         category: 'Fashion',     price: 599,   coinsPrice: 3000,  imageUrl: PRODUCT_FALLBACK_IMAGES[4], stock: 100, sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
  { _id: 'p6', name: 'Leather Wallet',      description: 'Slim bifold genuine leather wallet',                   category: 'Fashion',     price: 899,   coinsPrice: 4500,  imageUrl: PRODUCT_FALLBACK_IMAGES[5], stock: 40, sold: 0, isActive: true, isFeatured: false, createdAt: '', updatedAt: '' },
];

// ─── Promo Banner (Supersonic SALE style) ───────────────────────────────────

function PromoBanner({ banner }: { banner?: Banner }) {
  // When admin uploaded an image, render IT — that's what they edited in the
  // banner form and what desktop already shows. Falling back to the gradient
  // placeholder caused "I uploaded BIG SALE, mobile shows orange ribbon" bug.
  const imageUrl = banner?.imageUrl;
  const title    = banner?.title    ?? 'Supersonic SALE';
  const subtitle = banner?.subtitle ?? '';
  const ctaLabel = banner?.ctaLabel;
  // Colour priority: admin's explicit gradientColors > slot default > brand fallback.
  // Used only when no imageUrl is set.
  const colors   = banner
    ? resolveBannerGradient(banner)
    : (['#1f4ed4', '#4784E2'] as [string, string]);

  return (
    <TouchableOpacity style={st.banner} activeOpacity={0.92}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={st.bannerBlobLeft} />
          <View style={st.bannerBlobRight} />

          <View style={st.bannerContent}>
            <Text style={st.bannerTitle}>{title}</Text>
            {subtitle ? (
              <View style={st.bannerSubChip}>
                <Text style={st.bannerSubChipText}>⚡ {subtitle}</Text>
              </View>
            ) : null}
          </View>

          {ctaLabel ? (
            <View style={st.bannerFeeRow}>
              <View style={st.bannerFeeChip}>
                <Text style={st.bannerFeeChipMain}>{ctaLabel}</Text>
              </View>
            </View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Product Card (2-col) ───────────────────────────────────────────────────

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const cardW = (width - 16 * 2 - 12) / 2;

  const discountPercent = 50;
  const originalPrice   = Math.round(product.price * (100 / (100 - discountPercent)));
  const lowStock        = product.stock > 0 && product.stock <= 10;

  return (
    <TouchableOpacity style={[st.card, { width: cardW }]} onPress={onPress} activeOpacity={0.85}>
      <View style={st.cardImageBox}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, st.cardImageFallback]}>
            <Text style={st.cardImageLetter}>{product.name?.[0] ?? '?'}</Text>
          </View>
        )}
        <View style={st.discountBadge}>
          <Text style={st.discountBadgeText}>{discountPercent}% OFF</Text>
        </View>
        {lowStock && (
          <View style={st.stockBadge}>
            <Text style={st.stockBadgeText}>{product.stock} left</Text>
          </View>
        )}
      </View>

      <View style={st.cardBody}>
        <Text style={st.cardTitle} numberOfLines={1}>{product.name}</Text>
        <Text style={st.cardDesc}  numberOfLines={2}>{product.description}</Text>

        <View style={st.cardRatingRow}>
          <Star size={11} color="#f59e0b" fill="#f59e0b" />
          <Text style={st.cardRating}>4.5</Text>
          <Text style={st.cardReviewCount}>(128)</Text>
        </View>

        <View style={st.cardPriceRow}>
          <Text style={st.cardPrice}>{priceFmt(product.price)}</Text>
          <Text style={st.cardPriceStrike}>{priceFmt(originalPrice)}</Text>
        </View>

        <View style={st.coinsPill}>
          <Coins size={11} color={Colors.primary} />
          <Text style={st.coinsPillText}>{product.coinsPrice.toLocaleString('en-IN')} coins</Text>
        </View>

        <View style={st.buyBtn}>
          <Text style={st.buyBtnText}>Buy Now</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export const MobileHomeScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const refresh = usePullToRefresh();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'home'],
    queryFn: () => productsAPI.getProducts({ limit: 24 }),
  });
  const { data: bannersRes } = useQuery({
    // Same key as desktop HomeScreen so admin mutations invalidate both surfaces.
    queryKey: ['banners'],
    queryFn: () => bannersAPI.getActiveBanners(),
  });
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });

  // Normalise responses
  const allProducts: Product[] =
    productsRes?.data?.products ?? productsRes?.products ?? FALLBACK_PRODUCTS;
  const banners: Banner[] =
    bannersRes?.data?.banners ?? [];
  const apiCategories: Category[] =
    categoriesRes?.data?.categories ?? categoriesRes?.categories ?? [];

  // Horizontal-scroll category list (original behaviour)
  const categories = useMemo(() => {
    if (apiCategories.length > 0) return ['All', ...apiCategories.map((c) => c.name)];
    return ['All', 'Fashion', 'Electronics', 'Home', 'Pharmacy'];
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

  // Build repeating sections: banner → 4 products → banner → 4 products → ...
  const sections = useMemo(() => {
    type Section =
      | { type: 'banner'; data?: Banner; index: number }
      | { type: 'products'; data: Product[] };

    const result: Section[] = [];
    const productChunks = filteredProducts.length > 0 ? chunkArray(filteredProducts, 4) : [[]];

    for (let i = 0; i < productChunks.length; i++) {
      result.push({ type: 'banner',   data: banners[i % Math.max(banners.length, 1)], index: i });
      result.push({ type: 'products', data: productChunks[i] });
    }
    return result;
  }, [filteredProducts, banners]);

  const handleProductPress = (p: Product) => {
    navigation.navigate('ProductDetail', { productId: p._id, product: p });
  };

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

      {/* ── Blue Header ───────────────────────────────────────────── */}
      <View style={st.headerBg}>
        {/* Greeting row */}
        <View style={st.greetingRow}>
          <View>
            <Text style={st.greetingText}>{greeting()}</Text>
            <Text style={st.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <View style={st.avatarCircle}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={st.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={st.avatarInitial}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Tabs + Search + Categories */}
        <View style={st.tabSearchWrapper}>
          {/* Tabs row */}
          <View style={st.tabsRow}>
            {['Products', 'Deals', 'Festivals', 'Season'].map((label, i) => {
              const isActive = i === activeTab;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setActiveTab(i)}
                  style={isActive ? st.headerTabActive : st.headerTab}
                  activeOpacity={0.8}
                >
                  {isActive && (
                    <View style={st.curveLeft}>
                      <View style={[st.curveInner, { right: 0, backgroundColor: Colors.primaryLight }]} />
                    </View>
                  )}
                  <Text style={[st.headerTabText, isActive && st.headerTabTextActive]}>{label}</Text>
                  {isActive && (
                    <View style={st.curveRight}>
                      <View style={[st.curveInner, { left: 0, backgroundColor: Colors.primaryLight }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Blue panel: search + categories */}
          <View style={st.bluePanel}>
            <View style={st.searchBar}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={st.searchInput}
                placeholder='Search by "Face Wash"'
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={st.categoryIconsRow}
              contentContainerStyle={st.categoryIconsContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={st.categoryIconItem}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <View style={[st.categoryIconCircle, selectedCategory === cat && st.categoryIconCircleActive]}>
                    <Text style={st.categoryEmoji}>{CATEGORY_ICONS[cat] || '🛒'}</Text>
                  </View>
                  <Text style={[st.categoryIconLabel, selectedCategory === cat && st.categoryIconLabelActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* ── Repeating: banner → product grid ────────────────────────── */}
      {sections.map((section, idx) => {
        if (section.type === 'banner') {
          return <PromoBanner key={`b-${idx}`} banner={section.data} />;
        }
        if (section.data.length === 0) {
          return (
            <View key={`empty-${idx}`} style={st.empty}>
              <Text style={st.emptyTitle}>No products found</Text>
              <Text style={st.emptySub}>Try a different category or search term</Text>
            </View>
          );
        }
        return (
          <View key={`g-${idx}`} style={st.grid}>
            {section.data.map((p) => (
              <ProductCard key={p._id} product={p} onPress={() => handleProductPress(p)} />
            ))}
          </View>
        );
      })}

      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8FF',
  },

  // ── Header (original) ────────────────────────────────────────────────────
  headerBg: {
    backgroundColor: Colors.primaryLight,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontFamily: Fonts.extraBold,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: {
    fontSize: 16,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },
  tabSearchWrapper: { marginTop: 4 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
  },
  headerTab: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'visible',
    backgroundColor: Colors.background,
  },
  headerTabActive: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 18,
    marginBottom: -8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginRight: 2,
    overflow: 'visible',
    backgroundColor: Colors.primary,
    zIndex: 2,
  },
  headerTabText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  headerTabTextActive: {
    color: '#fff',
    fontFamily: Fonts.extraBold,
  },
  curveLeft: {
    position: 'absolute', bottom: 0, left: -12,
    width: 12, height: 12, backgroundColor: Colors.primary, overflow: 'hidden', zIndex: 1,
  },
  curveRight: {
    position: 'absolute', bottom: 0, right: -12,
    width: 12, height: 12, backgroundColor: Colors.primary, overflow: 'hidden', zIndex: 1,
  },
  curveInner: {
    position: 'absolute', bottom: 0,
    width: 24, height: 24, borderRadius: 12,
  },
  bluePanel: {
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    height: 40,
  },
  categoryIconsRow: { marginTop: 14, marginBottom: 6 },
  categoryIconsContent: { paddingHorizontal: 4 },
  categoryIconItem: { alignItems: 'center', marginRight: 20 },
  categoryIconCircle: {
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4, padding: 10, borderRadius: 30,
  },
  categoryIconCircleActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  categoryEmoji: { fontSize: 18 },
  categoryIconLabel: {
    fontSize: 11, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.85)',
  },
  categoryIconLabelActive: { color: '#fff', fontFamily: Fonts.bold },

  // ── Banner ───────────────────────────────────────────────────────────────
  banner: {
    height: 160,
    marginHorizontal: 0,
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  bannerBlobLeft: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerBlobRight: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 26,
    fontFamily: Fonts.extraBold,
    letterSpacing: 0.5,
  },
  bannerSubChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bannerSubChipText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  bannerFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerFeeChip: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bannerFeeChipMain: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.extraBold,
  },
  bannerFeeText: {
    color: Colors.text,
    fontSize: 10,
    fontFamily: Fonts.semiBold,
  },

  // ── Product Grid ─────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageBox: {
    height: 148,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  cardImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  cardImageLetter: {
    fontSize: 32,
    fontFamily: Fonts.extraBold,
    color: 'rgba(255,255,255,0.6)',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primaryLight10,
    borderColor: Colors.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  discountBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontFamily: Fonts.extraBold,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeText: {
    color: '#92400e',
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  cardBody: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 14,
    minHeight: 28,
    marginBottom: 4,
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardRating: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  cardReviewCount: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  cardPriceStrike: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  coinsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  coinsPillText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  buyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.bold,
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#94a3b8',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#cbd5e1',
    textAlign: 'center',
  },
});
