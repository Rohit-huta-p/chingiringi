import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  Star,
  ChevronRight,
  ArrowRight,
  Share2,
  Sparkles,
  Sparkles as SparklesIcon,
  Tag,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { categoriesAPI, Category } from '../../api/deals';
import { productsAPI, Product } from '../../api/products';
import {
  Banner as BannerModel,
  BannerSlot,
  bannersAPI,
  bucketBySlot,
  resolveBannerGradient,
} from '../../api/banners';

// ─── Helpers ────────────────────────────────────────────────────────────────

function userInitials(name?: string | null): string {
  if (!name) return 'U';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function priceFmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Content ────────────────────────────────────────────────────────────────

const PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=75',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=75',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=75',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=75',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&q=75',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=75',
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=75',
  'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=500&q=75',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&q=75',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&q=75',
  'https://images.unsplash.com/photo-1511385348-a52b4a160dc2?w=500&q=75',
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500&q=75',
];

const CATEGORY_IMAGES: Record<string, string> = {
  Men: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=600&q=75',
  Women: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=75',
  Kids: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600&q=75',
  Footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=75',
  Accessories: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=75',
};

// ─── Buy Now button (gradient) ──────────────────────────────────────────────

function BuyNowButton({ onPress }: { onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={s.buyBtn}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <LinearGradient
        colors={['#4784E2', '#91BDFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={s.buyBtnTxt}>Buy Now</Text>
    </TouchableOpacity>
  );
}

// ─── Product Card ───────────────────────────────────────────────────────────

function ProductCard({
  image,
  brand,
  title,
  subtitle,
  price,
  oldPrice,
  coins,
  rating,
  ratingCount,
  badge,
  stockLeft,
  isNew,
  onPress,
  width,
}: {
  image: string;
  brand: string;
  title: string;
  subtitle?: string;
  price: number;
  oldPrice?: number;
  coins: number;
  rating?: number;
  ratingCount?: number;
  badge?: { text: string; color: string };
  stockLeft?: number;
  isNew?: boolean;
  onPress: () => void;
  width: number;
}) {
  return (
    <TouchableOpacity
      style={[s.productCard, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.productImageBox}>
        <Image source={{ uri: image }} style={s.productImage} resizeMode="cover" />
        {badge ? (
          <View style={[s.productBadge, { backgroundColor: badge.color }]}>
            <Text style={s.productBadgeTxt}>{badge.text}</Text>
          </View>
        ) : null}
        {stockLeft != null && stockLeft > 0 ? (
          <View style={s.stockBadge}>
            <Text style={s.stockBadgeTxt}>{stockLeft} left!</Text>
          </View>
        ) : isNew ? (
          <View style={s.newBadge}>
            <Text style={s.newBadgeTxt}>NEW</Text>
          </View>
        ) : null}
      </View>
      <View style={s.productInfo}>
        <Text style={s.productTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.productSub} numberOfLines={1}>
          {subtitle || brand}
        </Text>
        {rating != null && ratingCount != null ? (
          <View style={s.ratingRow}>
            <Star size={11} color="#f59e0b" fill="#f59e0b" strokeWidth={0} />
            <Text style={s.ratingValue}>{rating.toFixed(1)}</Text>
            <Text style={s.ratingCount}>({ratingCount.toLocaleString('en-IN')})</Text>
          </View>
        ) : null}
        <View style={s.priceRow}>
          <Text style={s.productPrice}>{priceFmt(price)}</Text>
          {oldPrice ? (
            <Text style={s.productOldPrice}>{priceFmt(oldPrice)}</Text>
          ) : null}
        </View>
        <View style={s.coinsPill}>
          <View style={s.coinsIcon}>
            <Text style={s.coinsIconTxt}>◆</Text>
          </View>
          <Text style={s.coinsPillTxt}>
            {coins.toLocaleString('en-IN')} coins
          </Text>
        </View>
        <BuyNowButton onPress={onPress} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Product Grid Section ───────────────────────────────────────────────────

type GridItem = {
  title: string;
  subtitle: string;
  rating: number;
  ratingCount: number;
  price: number;
  oldPrice: number;
  coins: number;
  discount: number;
  _id?: string;
  productImage?: string;
  category: string;
  productStock?: number;
};

function ProductGrid({
  title,
  count,
  startIdx = 0,
  containerWidth,
  cols = 6,
  onProductPress,
  onSeeAll,
  newBadgeCols = [],
  stockLeftCols = [],
  products = [],
  hasFilter = false,
}: {
  title: string;
  count?: string;
  startIdx?: number;
  containerWidth: number;
  cols?: number;
  onProductPress: (item: GridItem) => void;
  onSeeAll?: () => void;
  newBadgeCols?: number[];
  stockLeftCols?: { col: number; left: number }[];
  products?: Product[];
  hasFilter?: boolean;
}) {
  const gap = 16;
  const cardW = (containerWidth - gap * (cols - 1)) / cols;
  const limit = cols * 2;

  // Real products only — no template/demo tiles. Each section shows a
  // different window via startIdx so a small catalog doesn't repeat
  // identically across sections.
  const windowed: Product[] = products.length
    ? Array.from(
        { length: Math.min(products.length, limit) },
        (_, i) => products[(startIdx + i) % products.length],
      )
    : [];
  const rows = chunk(windowed, cols);

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>{title}</Text>
          {count ? (
            <View style={s.countChip}>
              <Text style={s.countChipTxt}>{count}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={s.seeAllBtn} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={s.seeAllTxt}>See all</Text>
          <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      {windowed.length === 0 ? (
        <Text style={s.gridEmpty}>
          {hasFilter ? 'No products match your search.' : 'No products yet.'}
        </Text>
      ) : rows.map((row, rIdx) => (
        <View
          key={rIdx}
          style={[s.productRow, { gap, marginBottom: rIdx < rows.length - 1 ? 16 : 0 }]}
        >
          {row.map((product, idx) => {
            const globalIdx = rIdx * cols + idx;
            const image = product.imageUrl || PRODUCT_IMAGES[globalIdx % PRODUCT_IMAGES.length];
            const isNew = newBadgeCols.includes(globalIdx);
            const stockHint = stockLeftCols.find((sc) => sc.col === globalIdx);
            const stockLeft =
              product.stock != null && product.stock > 0 && product.stock <= 15
                ? product.stock
                : stockHint?.left;
            return (
              <ProductCard
                key={product._id ?? globalIdx}
                image={image}
                brand={product.category || ''}
                title={product.name}
                subtitle={product.description || product.category}
                price={product.price}
                coins={product.coinsPrice}
                isNew={isNew}
                stockLeft={stockLeft}
                onPress={() =>
                  onProductPress({
                    _id: product._id,
                    title: product.name,
                    subtitle: product.description || product.category || '',
                    price: product.price,
                    oldPrice: 0,
                    coins: product.coinsPrice,
                    rating: 0,
                    ratingCount: 0,
                    discount: 0,
                    productImage: image,
                    category: product.category || '',
                    productStock: product.stock,
                  })
                }
                width={cardW}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Banner fallback (when no image) ────────────────────────────────────────
//
// Colours come from the banner's slot (or its admin-set gradientColors
// override). This keeps the home page consistent with the slot preview shown
// in the admin form — see SLOT_GRADIENTS in src/api/banners.ts.

function FallbackGradient({ banner }: { banner: BannerModel }) {
  const colors = resolveBannerGradient(banner);
  return (
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

// ─── Hero Banner ────────────────────────────────────────────────────────────

function HeroBanner({ banner, onPress }: { banner?: BannerModel | null; onPress?: () => void }) {
  if (!banner) return null;
  const image = banner.imageUrl || banner.overlayImage;
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.95 : 1} onPress={onPress} style={s.heroBanner}>
      {image ? (
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      ) : (
        <>
          <FallbackGradient banner={banner} />
          <View style={s.fbHero}>
            {banner.title ? <Text style={s.fbHeroTitle}>{banner.title}</Text> : null}
            {banner.subtitle ? <Text style={s.fbHeroSub}>{banner.subtitle}</Text> : null}
            {banner.ctaLabel ? (
              <View style={s.fbHeroCta}>
                <Text style={s.fbHeroCtaTxt}>{banner.ctaLabel}</Text>
                <ArrowRight size={14} color="#0f172a" strokeWidth={2.5} />
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Promo Strip ────────────────────────────────────────────────────────────

function PromoStrip({
  banner,
  onPress,
}: {
  banner?: BannerModel | null;
  onPress?: () => void;
}) {
  if (!banner) return null;
  const image = banner.imageUrl || banner.overlayImage;
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.95 : 1} onPress={onPress} style={s.promoStrip}>
      {image ? (
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      ) : (
        <>
          <FallbackGradient banner={banner} />
          <View style={s.fbThin}>
            <View style={{ flex: 1, gap: 4 }}>
              {banner.badges && banner.badges.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {banner.badges.map((b) => (
                    <View
                      key={b.label}
                      style={[s.fbBadge, { backgroundColor: b.color || '#ef4444' }]}
                    >
                      <Text style={s.fbBadgeTxt}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {banner.title ? <Text style={s.fbTitle}>{banner.title}</Text> : null}
            </View>
            {banner.ctaLabel ? (
              <View style={s.fbCta}>
                <Text style={s.fbCtaTxt}>{banner.ctaLabel}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Dual Banner ────────────────────────────────────────────────────────────

function DualBannerHalf({
  banner,
  onPress,
}: {
  banner?: BannerModel | null;
  onPress?: () => void;
}) {
  if (!banner) return null;
  const image = banner.imageUrl || banner.overlayImage;
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.95 : 1}
      onPress={onPress}
      style={s.dualBanner}
    >
      {image ? (
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      ) : (
        <>
          <FallbackGradient banner={banner} />
          <View style={s.fbDual}>
            {banner.badges && banner.badges[0] ? (
              <View
                style={[
                  s.fbBadge,
                  { backgroundColor: banner.badges[0].color || '#ef4444' },
                ]}
              >
                <Text style={s.fbBadgeTxt}>{banner.badges[0].label}</Text>
              </View>
            ) : null}
            {banner.title ? <Text style={s.fbDualTitle}>{banner.title}</Text> : null}
            {banner.subtitle ? (
              <Text style={s.fbDualSub}>{banner.subtitle}</Text>
            ) : null}
            {banner.ctaLabel ? (
              <View style={s.fbCta}>
                <Text style={s.fbCtaTxt}>{banner.ctaLabel}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

function DualBanner({
  left,
  right,
  onLeftPress,
  onRightPress,
}: {
  left?: BannerModel | null;
  right?: BannerModel | null;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}) {
  if (!left && !right) return null;
  return (
    <View style={s.dualBannerRow}>
      <DualBannerHalf banner={left} onPress={onLeftPress} />
      <DualBannerHalf banner={right} onPress={onRightPress} />
    </View>
  );
}

// ─── Earn Coins Banner ──────────────────────────────────────────────────────

function EarnCoinsBanner({
  banner,
  onPress,
}: {
  banner?: BannerModel | null;
  onPress: () => void;
}) {
  if (!banner) return null;
  const image = banner.imageUrl || banner.overlayImage;
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.earnBanner}>
      {image ? (
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      ) : (
        <>
          <FallbackGradient banner={banner} />
          <View style={s.fbThin}>
            <View style={s.fbIcon}>
              <Sparkles size={20} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              {banner.title ? <Text style={s.fbTitle}>{banner.title}</Text> : null}
              {banner.subtitle ? (
                <Text style={s.fbSub}>{banner.subtitle}</Text>
              ) : null}
            </View>
            {banner.ctaLabel ? (
              <View style={s.fbCta}>
                <Text style={s.fbCtaTxt}>{banner.ctaLabel}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── How to Explore Section ─────────────────────────────────────────────────

// Legacy - replaced by ProductGrid for consistency
function MoreToExploreSection({
  containerWidth,
  onPress,
  onSeeAll,
  products = [],
  hasFilter = false,
}: {
  containerWidth: number;
  onPress: (item: GridItem) => void;
  onSeeAll?: () => void;
  products?: Product[];
  hasFilter?: boolean;
}) {
  return (
    <ProductGrid
      title="More to Explore"
      startIdx={15}
      containerWidth={containerWidth}
      cols={6}
      onProductPress={onPress}
      onSeeAll={onSeeAll}
      hasFilter={hasFilter}
      stockLeftCols={[{ col: 1, left: 12 }]}
      newBadgeCols={[3]}
      products={products}
    />
  );
}

// ─── Refer & Earn Banner ────────────────────────────────────────────────────

function ReferBanner({
  banner,
  onPress,
}: {
  banner?: BannerModel | null;
  onPress: () => void;
}) {
  if (!banner) return null;
  const image = banner.imageUrl || banner.overlayImage;
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.referBanner}>
      {image ? (
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      ) : (
        <>
          <FallbackGradient banner={banner} />
          <View style={s.fbThin}>
            <View style={s.fbIcon}>
              <Share2 size={20} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              {banner.title ? <Text style={s.fbTitle}>{banner.title}</Text> : null}
              {banner.subtitle ? (
                <Text style={s.fbSub}>{banner.subtitle}</Text>
              ) : null}
            </View>
            {banner.ctaLabel ? (
              <View style={s.fbCta}>
                <Text style={s.fbCtaTxt}>{banner.ctaLabel}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Shop by Category (asymmetric grid) ─────────────────────────────────────

function ShopByCategorySection({
  containerWidth,
  onPress,
  categories = [],
}: {
  containerWidth: number;
  onPress: (name: string) => void;
  categories?: Category[];
}) {
  const gap = 12;
  const bigW = Math.floor(containerWidth * 0.28);
  const rightW = containerWidth - bigW - gap;
  const smallW = Math.floor((rightW - gap * 3) / 4);

  // Real categories only — no hardcoded showcase.
  const liveCats = categories
    .filter((c) => c.isActive !== false)
    .slice(0, 5)
    .map((c) => ({ key: c.name, label: c.name, image: c.icon }));

  // Nothing real to show → hide the whole section rather than fake it.
  if (liveCats.length === 0) return null;

  const imgFor = (c: { key: string; image?: string }) =>
    c.image || CATEGORY_IMAGES[c.key] || PRODUCT_IMAGES[0];

  const [big, ...rest] = liveCats;

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Shop by category</Text>
      <View style={{ flexDirection: 'row', gap }}>
        <TouchableOpacity
          style={[s.catBig, { width: bigW }]}
          onPress={() => onPress(big.key)}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: imgFor(big) }}
            style={s.catBigImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={s.catBigLabel}>{big.label}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', gap }}>
          {rest.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[s.catSmall, { width: smallW }]}
              onPress={() => onPress(c.key)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: imgFor(c) }}
                style={s.catSmallImg}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={s.catSmallLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Top Nav Bar ────────────────────────────────────────────────────────────

function TopNav({
  selectedCategory,
  onCategoryChange,
  categories,
  searchQuery,
  onSearchChange,
  userName,
  userAvatarUrl,
  onProfilePress,
  width,
}: {
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  categories: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userName?: string;
  userAvatarUrl?: string;
  onProfilePress: () => void;
  width: number;
}) {
  return (
    <View style={s.topNav}>
      <View style={[s.topNavInner, { width }]}>
        {/* Row 1: Search full-width + avatar */}
        <View style={s.topNavRow}>
          <View style={s.navSearchBox}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              placeholder="Search products, brands..."
              placeholderTextColor="#94a3b8"
              style={s.navSearchInput}
              value={searchQuery}
              onChangeText={onSearchChange}
            />
          </View>
          <TouchableOpacity
            style={s.navAvatar}
            activeOpacity={0.7}
            onPress={onProfilePress}
          >
            {userAvatarUrl ? (
              <Image source={{ uri: userAvatarUrl }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            ) : (
              <>
                <LinearGradient
                  colors={Gradient.brand}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={s.navAvatarTxt}>{userInitials(userName)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {/* Row 2: Category chips — the real categories admin has added */}
        <View style={s.navChipsRow}>
          {categories.map((label) => {
            const active = label === selectedCategory;
            const Icon = label === 'All' ? SparklesIcon : Tag;
            return (
              <TouchableOpacity
                key={label}
                style={[s.navChip, active && s.navChipActive]}
                onPress={() => onCategoryChange(label)}
                activeOpacity={0.7}
              >
                <Icon size={14} color={active ? '#fff' : '#64748b'} strokeWidth={2.5} />
                <Text style={[s.navChipTxt, active && s.navChipTxtActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const userName = useAuthStore((st) => st.user?.name);
  const userAvatarUrl = useAuthStore((st) => st.user?.avatarUrl);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Approx content area width after sidebar + padding
  const sidebarW = 250;
  const horizPad = 32 * 2;
  const contentW = Math.max(900, width - sidebarW - horizPad);

  // Fetch all products (paginated from server, default page size)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsAPI.getProducts({ limit: 24 }),
    staleTime: 60_000,
  });

  // Active categories for Shop-by-Category and nav chips
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 5 * 60_000,
  });

  // Fetch all active banners once and bucket by slot. Each banner section
  // below pulls its own slot from this cache.
  const { data: bannerRes } = useQuery({
    queryKey: ['banners'],
    queryFn: () => bannersAPI.getActiveBanners(),
    staleTime: 60_000,
  });

  // Extract arrays with fallback normalization (handles a few backend shapes:
  // { data: { products } }, { products }, { data: Product[] }, raw array).
  const products: Product[] =
    productsData?.data?.products ?? productsData?.products ?? productsData?.data ?? [];
  const categories: Category[] =
    categoriesData?.data?.categories ??
    categoriesData?.categories ??
    categoriesData?.data ??
    [];

  // Categories that actually have ≥1 product. Empty categories are hidden
  // from the user — no chip, no per-category section, no "Shop by category" tile.
  const productCategorySet = new Set(
    products.map((p) => (p.category ?? '').trim().toLowerCase()).filter(Boolean),
  );
  const activeCategories: Category[] = categories.filter(
    (c) => c.isActive !== false && productCategorySet.has(c.name.trim().toLowerCase()),
  );

  // Category filter chips: "All" + only the categories that have products.
  const categoryChips: string[] = ['All', ...activeCategories.map((c) => c.name)];

  // Products belonging to a specific category — for the per-category sections.
  const productsInCategory = (name: string) =>
    products.filter(
      (p) => (p.category ?? '').trim().toLowerCase() === name.trim().toLowerCase(),
    );

  // ── Search + category filter (applied to every product grid) ──────────────
  const hasFilter = selectedCategory !== 'All' || searchQuery.trim() !== '';
  const matchesFilters = (p: Product) => {
    const catOk =
      selectedCategory === 'All' ||
      (p.category ?? '').toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const searchOk =
      !q ||
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q);
    return catOk && searchOk;
  };
  const filteredProducts = hasFilter ? products.filter(matchesFilters) : products;

  const allBanners: BannerModel[] = bannerRes?.data?.banners ?? [];
  const bySlot = bucketBySlot(allBanners);
  const firstBannerFor = (slot: BannerSlot): BannerModel | null =>
    bySlot[slot]?.[0] ?? null;

  if (productsLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const onProductPress = (item: GridItem) => {
    // Pass the resolved item so the detail screen can render instantly,
    // and pass productId separately so it can refetch fresh data when
    // the click came from a real (non-template) product.
    navigation.navigate('ProductDetail', {
      productId: item._id,
      product: item,
    });
  };

  const onCategoryPress = (name: string) => {
    setSelectedCategory(name);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // "See all" on a section: focus that category and jump to the top so the
  // filtered catalog is front-and-centre.
  const handleSeeAll = (category: string) => {
    setSelectedCategory(category);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={s.root}>
      <TopNav
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryPress}
        categories={categoryChips}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        onProfilePress={() => navigation.navigate('Profile')}
        width={contentW}
      />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.body, { maxWidth: contentW + 64, width: '100%' }]}>
          <HeroBanner banner={firstBannerFor('hero')} />

          <ProductGrid
            title="All Products"
            count={filteredProducts.length ? `${filteredProducts.length} items` : undefined}
            startIdx={0}
            containerWidth={contentW}
            cols={6}
            onProductPress={onProductPress}
            onSeeAll={() => handleSeeAll('All')}
            hasFilter={hasFilter}
            stockLeftCols={[{ col: 1, left: 8 }]}
            products={filteredProducts}
          />

          <PromoStrip banner={firstBannerFor('flash-strip')} />

          {/* Per-category sections — one row per category that has products, so
              a product only ever appears under its own category (never a
              mislabelled "Electronics" row). Shown on the unfiltered home;
              when a chip filter is active, "All Products" already narrows. */}
          {!hasFilter &&
            activeCategories.map((cat) => {
              const catProducts = productsInCategory(cat.name);
              if (catProducts.length === 0) return null;
              return (
                <ProductGrid
                  key={(cat as any)._id ?? cat.name}
                  title={cat.name}
                  count={`${catProducts.length} item${catProducts.length === 1 ? '' : 's'}`}
                  startIdx={0}
                  containerWidth={contentW}
                  cols={6}
                  onProductPress={onProductPress}
                  onSeeAll={() => handleSeeAll(cat.name)}
                  hasFilter={false}
                  products={catProducts}
                />
              );
            })}

          <DualBanner
            left={firstBannerFor('dual-left')}
            right={firstBannerFor('dual-right')}
          />

          <ProductGrid
            title="New Arrivals"
            startIdx={6}
            containerWidth={contentW}
            cols={6}
            onProductPress={onProductPress}
            onSeeAll={() => handleSeeAll('All')}
            hasFilter={hasFilter}
            newBadgeCols={[0, 1, 2, 3, 6]}
            stockLeftCols={[{ col: 5, left: 5 }]}
            products={filteredProducts}
          />

          <EarnCoinsBanner
            banner={firstBannerFor('earn-coins')}
            onPress={() => navigation.navigate('Wallet')}
          />

          <MoreToExploreSection
            containerWidth={contentW}
            onPress={onProductPress}
            onSeeAll={() => handleSeeAll('All')}
            hasFilter={hasFilter}
            products={filteredProducts}
          />

          <ReferBanner
            banner={firstBannerFor('refer-earn')}
            onPress={() => navigation.navigate('Referrals')}
          />

          <ShopByCategorySection
            containerWidth={contentW}
            onPress={onCategoryPress}
            categories={activeCategories}
          />
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Generic full-bleed image (used by image-only banners)
  fullImage: { width: '100%', height: '100%' },

  // ── Banner fallback (gradient + content when no image)
  fbHero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 32,
    zIndex: 1,
  },
  fbHeroTitle: {
    fontSize: 32,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    lineHeight: 38,
  },
  fbHeroSub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    marginBottom: 14,
  },
  fbHeroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  fbHeroCtaTxt: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  fbThin: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
    zIndex: 1,
  },
  fbIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fbBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fbBadgeTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  fbTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  fbSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  fbCta: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  fbCtaTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  fbDual: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    gap: 6,
    zIndex: 1,
  },
  fbDualTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    lineHeight: 26,
  },
  fbDualSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },

  // ── Top Nav
  topNav: {
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.6)',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  topNavInner: {
    gap: 12,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  navChipActive: {
    backgroundColor: '#0f172a',
  },
  navChipTxt: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#475569',
  },
  navChipTxtActive: {
    color: '#fff',
  },
  navSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
  },
  navSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.text,
    outlineStyle: 'none' as any,
  },
  navIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navAvatarTxt: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Scroll body
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 64,
  },
  body: {
    padding: 32,
    gap: 32,
  },

  // ── Hero banner
  heroBanner: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGreenHalf: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '42%',
  },
  heroYellowHalf: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    left: '42%',
  },
  heroContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    gap: 32,
    zIndex: 1,
  },
  heroTacoWrap: {
    width: 240,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTacoImg: {
    width: 260,
    height: 260,
    marginTop: 20,
  },
  heroText: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 54,
    fontFamily: Fonts.extraBold,
    color: '#E67E22',
    letterSpacing: 1,
    lineHeight: 58,
  },
  heroSubtitle: {
    fontSize: 22,
    fontFamily: Fonts.medium,
    color: '#4A7A32',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 18,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#4A7A32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  heroCtaIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E67E22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCtaTxt: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Section
  section: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#4784E2',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  countChipTxt: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#475569',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllTxt: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  gridEmpty: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#94a3b8',
    paddingVertical: 28,
    textAlign: 'center',
  },

  // ── Product Card
  productRow: {
    flexDirection: 'row',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  productImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  productImage: { width: '100%', height: '100%' },
  productBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  productBadgeTxt: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#10b981',
  },
  newBadgeTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  stockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  stockBadgeTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  productInfo: {
    padding: 12,
    gap: 4,
  },
  productTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  productSub: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: '#475569',
    marginLeft: 2,
  },
  ratingCount: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  productOldPrice: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 6,
  },
  coinsIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4784E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsIconTxt: {
    fontSize: 8,
    color: '#fff',
    fontFamily: Fonts.bold,
  },
  coinsPillTxt: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: '#1D4ED8',
  },
  buyBtn: {
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  buyBtnTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Promo Strip (thin banner)
  promoStrip: {
    height: 70,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  promoLeft: {
    flex: 1,
    gap: 6,
  },
  promoBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  promoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  promoBadgeTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },
  promoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  promoCtaTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },

  // ── Dual Banner
  dualBannerRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dualBanner: {
    flex: 1,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  dualBannerLeft: {},
  dualBannerRight: {},
  dualBannerText: {
    flex: 1,
    zIndex: 1,
  },
  dualBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  dualBadgeTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  dualBannerTitle: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    color: '#581C87',
    lineHeight: 28,
  },
  dualBannerSub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#6D28D9',
    marginTop: 2,
  },
  dualBannerCta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#581C87',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dualBannerCtaTxt: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  dualBannerImg: {
    width: 160,
    height: '100%',
  },

  // ── Earn Coins Banner
  earnBanner: {
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  earnContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  earnIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(146,64,14,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  earnTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#78350F',
  },
  earnSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#92400E',
    marginTop: 2,
  },
  earnCta: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  earnCtaTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#92400E',
  },

  // ── How to Explore (larger card)
  exploreCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  exploreImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F9',
  },
  exploreText: {
    padding: 10,
  },
  exploreTitle: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#0f172a',
    marginBottom: 2,
  },
  exploreSub: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginBottom: 6,
  },
  explorePrice: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Refer Banner
  referBanner: {
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  referContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  referIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#fff',
  },
  referSub: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  referCta: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  referCtaTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },

  // ── Shop by Category (asymmetric grid)
  catBig: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 16,
  },
  catBigImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  catBigLabel: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#fff',
    zIndex: 1,
  },
  catSmall: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 12,
  },
  catSmallImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  catSmallLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#fff',
    zIndex: 1,
  },
});
