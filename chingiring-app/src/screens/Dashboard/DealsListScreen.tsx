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
import {
  Search,
  Bell,
  ChevronRight,
  Clock,
  SlidersHorizontal,
  Zap,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { dealsAPI, categoriesAPI, Deal, Category } from '../../api/deals';
import {
  bannersAPI,
  Banner as BannerModel,
  resolveBannerGradient,
} from '../../api/banners';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCashback(deal: Deal): string {
  if (deal.cashbackType === 'flat') return `₹${deal.flatCashback} back`;
  return `${deal.cashbackPercent}% back`;
}

function formatExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 48) return `about ${Math.max(hours, 1)} hours`;
  const days = Math.ceil(diff / 86_400_000);
  return days === 1 ? '1 day' : `${days} days`;
}

function userInitials(name?: string | null): string {
  if (!name) return 'U';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// Stable image fallback per brand (deterministic by hash) so cards don't flicker.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=75',
  'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=75',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=75',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=75',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=75',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=75',
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=75',
  'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600&q=75',
];

function pickFallbackImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
}

// ─── Top Nav ────────────────────────────────────────────────────────────────

// Maps live category names → emoji. The backend stores `icon` as a lucide
// name (e.g. "shirt", "utensils"); rendering those as text looks broken,
// so we map common categories to emoji and fall back to a dot.
const CATEGORY_EMOJI: Record<string, string> = {
  fashion: '👗',
  electronics: '⚡',
  'food & dining': '🍽️',
  food: '🍽️',
  'health & beauty': '💄',
  health: '💄',
  beauty: '💄',
  pharmacy: '💊',
  'home & living': '🏠',
  home: '🏠',
  travel: '✈️',
  sports: '🏋️',
  kids: '🧸',
  footwear: '👟',
  accessories: '👜',
};

function emojiForCategory(name: string): string {
  return CATEGORY_EMOJI[name.toLowerCase()] ?? '•';
}

function TopNav({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  userName,
  userAvatarUrl,
  onProfilePress,
  width,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  categories: { label: string; emoji: string }[];
  userName?: string;
  userAvatarUrl?: string;
  onProfilePress: () => void;
  width: number;
}) {
  return (
    <View style={s.topNav}>
      <View style={[s.topNavInner, { width }]}>
        <View style={s.topNavRow}>
          <View style={s.navSearchBox}>
            <Search size={16} color="#94a3b8" />
            <TextInput
              placeholder="Search deals, brands..."
              placeholderTextColor="#94a3b8"
              style={s.navSearchInput}
              value={searchQuery}
              onChangeText={onSearchChange}
            />
          </View>
          <TouchableOpacity style={s.todaysDealsBtn} activeOpacity={0.85}>
            <Zap size={14} color={Colors.primary} fill={Colors.primary} strokeWidth={0} />
            <Text style={s.todaysDealsTxt}>Today's Deals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.navIconBtn} activeOpacity={0.7}>
            <SlidersHorizontal size={16} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.navAvatar} activeOpacity={0.7} onPress={onProfilePress}>
            {userAvatarUrl ? (
              <Image source={{ uri: userAvatarUrl }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
            ) : (
              <>
                <LinearGradient colors={Gradient.brand} style={StyleSheet.absoluteFillObject} />
                <Text style={s.navAvatarTxt}>{userInitials(userName)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.navChipsRow}>
          {categories.map(({ label, emoji }) => {
            const active = label === selectedCategory;
            return (
              <TouchableOpacity
                key={label}
                style={[s.navChip, active && s.navChipActive]}
                onPress={() => onCategoryChange(label)}
                activeOpacity={0.7}
              >
                <Text style={[s.navChipEmoji, active && { color: '#fff' }]}>{emoji}</Text>
                <Text style={[s.navChipTxt, active && s.navChipTxtActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Featured Hero (left big card) ──────────────────────────────────────────

function FeaturedHeroCard({
  deal,
  onPress,
}: {
  deal?: Deal | null;
  onPress?: () => void;
}) {
  const cashback = deal ? formatCashback(deal).replace(' back', ' cashback') : 'Up to 20% cashback';
  const titleSuffix = deal?.category?.name
    ? `on ${deal.category.name.toLowerCase()} brands`
    : 'on fashion brands';
  const ctaLabel = deal?.category?.name ? `Explore ${deal.category.name}` : 'Explore Fashion';

  // Deep dark fashion-cable image (matches design vibe)
  const heroImage =
    deal?.imageUrl ||
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80';

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.heroLeft}>
      <Image source={{ uri: heroImage }} style={s.fullImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(10,15,25,0.85)', 'rgba(10,15,25,0.55)', 'rgba(10,15,25,0.85)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.featuredPill}>
        <Sparkles size={10} color="#fff" strokeWidth={2.5} />
        <Text style={s.featuredPillTxt}>FEATURED</Text>
      </View>
      <View style={s.heroLeftContent}>
        <Text style={s.heroOverline}>EARN WHILE YOU SHOP</Text>
        <Text style={s.heroTitle}>
          Up to <Text style={s.heroTitleAccent}>{cashback}</Text>
          {'\n'}
          {titleSuffix}
        </Text>
        <View style={s.heroFooter}>
          <View style={s.heroCta}>
            <Text style={s.heroCtaTxt}>{ctaLabel}</Text>
            <ArrowUpRight size={14} color="#0f172a" strokeWidth={2.5} />
          </View>
          <View style={s.avatarPile}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  s.pileAvatar,
                  { left: i * 14, backgroundColor: ['#f59e0b', '#ec4899', '#10b981'][i] },
                ]}
              />
            ))}
            <View style={[s.pileAvatar, s.pileMore, { left: 3 * 14 }]}>
              <Text style={s.pileMoreTxt}>+5</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Live Deals card (small dark) ───────────────────────────────────────────

function LiveDealsCard({ count }: { count: number }) {
  return (
    <View style={s.liveCard}>
      <LinearGradient
        colors={['#0F1A35', '#1E2D55']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.liveTopRow}>
        <Text style={s.liveLabel}>LIVE DEALS</Text>
        <View style={s.liveDot} />
      </View>
      <View style={s.liveCount}>
        <Text style={s.liveCountTxt}>{count}</Text>
        <Text style={s.liveCountPlus}>+</Text>
      </View>
      <Text style={s.liveSub}>Updated daily</Text>
      <View style={s.liveSparkle}>
        <Sparkles size={28} color="rgba(255,255,255,0.18)" strokeWidth={1.5} />
      </View>
    </View>
  );
}

// ─── Promo Image card (Electronics Sale) ────────────────────────────────────

function PromoImageCard({
  deal,
  onPress,
}: {
  deal?: Deal | null;
  onPress?: () => void;
}) {
  const image =
    deal?.imageUrl ||
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80';
  const title = deal?.brand
    ? `${deal.category?.name || 'Featured'} Sale`
    : 'Electronics Sale';
  const subtitle = deal
    ? `Up to ${formatCashback(deal).replace(' back', ' cashback')}`
    : 'Up to 15% cashback';

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={s.promoCard}>
      <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.65)']}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.promoText}>
        <Text style={s.promoTitle}>{title}</Text>
        <Text style={s.promoSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Trending Card (compact) ────────────────────────────────────────────────

function TrendingCard({
  deal,
  width,
  onPress,
}: {
  deal: Deal;
  width: number;
  onPress: () => void;
}) {
  const image = deal.imageUrl || pickFallbackImage(deal._id || deal.brand);
  return (
    <TouchableOpacity
      style={[s.trendCard, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.trendImageBox}>
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
        <View style={s.cashChip}>
          <Text style={s.cashChipTxt}>{formatCashback(deal)}</Text>
        </View>
      </View>
      <Text style={s.trendBrand} numberOfLines={1}>{deal.brand}</Text>
      <Text style={s.trendCategory} numberOfLines={1}>
        {deal.category?.name || ''}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Deal Card (full grid item) ─────────────────────────────────────────────

function DealGridCard({
  deal,
  width,
  onPress,
}: {
  deal: Deal;
  width: number;
  onPress: () => void;
}) {
  const image = deal.imageUrl || pickFallbackImage(deal._id || deal.brand);
  return (
    <TouchableOpacity
      style={[s.dealCard, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.dealImageBox}>
        <Image source={{ uri: image }} style={s.fullImage} resizeMode="cover" />
        <View style={s.cashChip}>
          <Text style={s.cashChipTxt}>{formatCashback(deal)}</Text>
        </View>
      </View>
      <View style={s.dealContent}>
        <Text style={s.dealBrand} numberOfLines={1}>{deal.brand}</Text>
        <Text style={s.dealTitle} numberOfLines={1}>
          {deal.title || deal.description}
        </Text>
        <View style={s.dealExpiry}>
          <Clock size={11} color="#f97316" strokeWidth={2.5} />
          <Text style={s.dealExpiryTxt}>{formatExpiresIn(deal.expiresAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  onSeeAll,
}: {
  title: string;
  count?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionLeft}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>{title}</Text>
        {count ? <Text style={s.sectionCount}>{count}</Text> : null}
      </View>
      {onSeeAll ? (
        <TouchableOpacity style={s.seeAllBtn} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={s.seeAllTxt}>See all</Text>
          <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Shop-by-Category horizontal card ──────────────────────────────────────
//
// Renders a square emoji-on-color tile per category. Tapping sets the page
// filter (parent passes onPress). Width is fixed so a row of them feels like
// a scrollable rail rather than a wrapping grid.
function CategoryShopCard({
  category,
  onPress,
}: {
  category: Category;
  onPress: () => void;
}) {
  // Deterministic gradient per category so colors stay stable across reloads.
  const PALETTES: [string, string][] = [
    ['#4784E2', '#91BDFF'],
    ['#F59E0B', '#FDE68A'],
    ['#10b981', '#a7f3d0'],
    ['#ec4899', '#fbcfe8'],
    ['#8b5cf6', '#ddd6fe'],
    ['#0891b2', '#a5f3fc'],
    ['#ef4444', '#fecaca'],
    ['#f97316', '#fed7aa'],
  ];
  let hash = 0;
  for (let i = 0; i < category.name.length; i++) hash = (hash + category.name.charCodeAt(i)) % PALETTES.length;
  const gradient = PALETTES[hash];

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.shopByCatCard}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.shopByCatEmojiWrap}>
        <Text style={s.shopByCatEmoji}>{emojiForCategory(category.name)}</Text>
      </View>
      <Text style={s.shopByCatLabel} numberOfLines={1}>{category.name}</Text>
    </TouchableOpacity>
  );
}

// ─── Promo banner strip ────────────────────────────────────────────────────
//
// Uses the shared SLOT_GRADIENTS via resolveBannerGradient — keeps the
// admin form preview consistent with what shows on this page.
function PromoBannerStrip({ banner, onPress }: { banner: BannerModel; onPress?: () => void }) {
  const colors = resolveBannerGradient(banner);
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.92 : 1} onPress={onPress} style={s.bannerStrip}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {banner.imageUrl ? (
        <Image source={{ uri: banner.imageUrl }} style={s.bannerStripImage} resizeMode="cover" />
      ) : null}
      <View style={s.bannerStripContent}>
        {banner.title ? <Text style={s.bannerStripTitle}>{banner.title}</Text> : null}
        {banner.subtitle ? <Text style={s.bannerStripSub}>{banner.subtitle}</Text> : null}
      </View>
      {banner.ctaLabel ? (
        <View style={s.bannerStripCta}>
          <Text style={s.bannerStripCtaTxt}>{banner.ctaLabel}</Text>
          <ChevronRight size={14} color="#0f172a" strokeWidth={2.5} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export const DealsListScreen = () => {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const userName = useAuthStore((st) => st.user?.name);
  const userAvatarUrl = useAuthStore((st) => st.user?.avatarUrl);
  const refresh = usePullToRefresh();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Compact viewport detection. The desktop drawer mounts at >=768px so
  // anything below uses a stacked / smaller-grid layout.
  const isCompact = width < 1024;
  const isMobile = width < 768;
  const sidebarW = width >= 768 ? 250 : 0;
  const horizPad = isMobile ? 16 * 2 : 32 * 2;
  const contentW = Math.max(isMobile ? 320 : 700, width - sidebarW - horizPad);

  // ── Data
  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () =>
      dealsAPI.getDeals({ limit: 24, sort: '-createdAt' }),
    staleTime: 60_000,
  });

  const { data: featuredData } = useQuery({
    queryKey: ['deals', 'featured'],
    queryFn: () => dealsAPI.getFeaturedDeals(),
    staleTime: 60_000,
  });

  // Admin-flagged trending deals (plan C). Falls back to click-count
  // sort if admin hasn't marked anything yet — see `trendingDeals` below.
  const { data: trendingData } = useQuery({
    queryKey: ['deals', 'trending'],
    queryFn: () => dealsAPI.getDeals({ trending: 'true', limit: 10 }),
    staleTime: 60_000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 5 * 60_000,
  });

  const { data: bannerRes } = useQuery({
    queryKey: ['banners'],
    queryFn: () => bannersAPI.getActiveBanners(),
    staleTime: 60_000,
  });

  const allDeals: Deal[] =
    dealsData?.data?.deals ?? dealsData?.deals ?? dealsData?.data ?? [];
  const featuredDeals: Deal[] =
    featuredData?.data?.deals ?? featuredData?.deals ?? featuredData?.data ?? [];
  const adminTrendingDeals: Deal[] =
    trendingData?.data?.deals ?? trendingData?.deals ?? trendingData?.data ?? [];
  const apiCategories: Category[] =
    categoriesData?.data?.categories ??
    categoriesData?.categories ??
    categoriesData?.data ??
    [];
  const allBanners: BannerModel[] = bannerRes?.data?.banners ?? [];
  // Pick a banner for the Deals page promo strip — admin can set the
  // 'flash-strip' slot; fall back to any active banner so the section
  // never sits empty when admin has banners configured for other slots.
  const dealsBanner =
    allBanners.find((b) => b.slot === 'flash-strip') ?? allBanners[0] ?? null;

  // Build category chip list. Prefer live API names, fall back to PRD-spec
  // categories from the design (Fashion, Electronics, Home, Pharmacy).
  const categoryChips = useMemo(() => {
    if (apiCategories.length === 0) return [{ label: 'All', emoji: '+' }];
    const live = apiCategories
      .filter((c) => c.isActive !== false)
      .slice(0, 6)
      .map((c) => ({ label: c.name, emoji: emojiForCategory(c.name) }));
    return [{ label: 'All', emoji: '+' }, ...live];
  }, [apiCategories]);

  // ── Filter / search
  const filteredDeals = useMemo(() => {
    let deals = allDeals;
    if (selectedCategory !== 'All') {
      deals = deals.filter(
        (d) => d.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      deals = deals.filter(
        (d) =>
          d.brand.toLowerCase().includes(q) ||
          d.title?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return deals;
  }, [allDeals, selectedCategory, searchQuery]);

  // Derive sections.
  // Hero: prefer first featured deal; promo: second featured (or first non-hero).
  const heroDeal = featuredDeals[0] ?? filteredDeals[0] ?? null;
  const promoDeal =
    featuredDeals.find((d) => d._id !== heroDeal?._id) ??
    filteredDeals.find((d) => d._id !== heroDeal?._id) ??
    null;

  // Trending: prefer admin-flagged `isTrending` deals (plan C). When admin
  // hasn't curated anything yet, fall back to top 5 by clickCount so the
  // section is never empty on a fresh install.
  const trendingDeals = useMemo(() => {
    if (adminTrendingDeals.length > 0) return adminTrendingDeals.slice(0, 8);
    const pool = allDeals.length > 0 ? allDeals : filteredDeals;
    return [...pool]
      .sort((a, b) => (b.clickCount ?? 0) - (a.clickCount ?? 0))
      .slice(0, 5);
  }, [adminTrendingDeals, allDeals, filteredDeals]);

  // Group deals by category for the per-category rows. Indexed by category _id.
  const dealsByCategory = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const d of allDeals) {
      const id = d.category?._id;
      if (!id) continue;
      (map[id] ??= []).push(d);
    }
    return map;
  }, [allDeals]);

  // Active categories that should appear as their own row on the deals page.
  // `showOnDealsPage` defaults true server-side so existing setups don't
  // require admin action — toggle to false to hide a category.
  const dealsPageCategories = useMemo(() => {
    return apiCategories
      .filter((c) => c.isActive !== false && c.showOnDealsPage !== false)
      .sort(
        (a, b) =>
          (a.dealsPageSortOrder ?? 0) - (b.dealsPageSortOrder ?? 0) ||
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
  }, [apiCategories]);

  // ── Layout grid columns
  const trendCols = isMobile ? 2.4 : isCompact ? 4 : 5; // 2.4 → horizontal scroll feel on mobile
  const allDealsCols = isMobile ? 2 : isCompact ? 3 : 5;
  const gap = isMobile ? 12 : 16;

  const trendCardW =
    isMobile
      ? Math.floor((contentW - gap * 2) / 2.4)
      : (contentW - gap * (Math.floor(trendCols) - 1)) / Math.floor(trendCols);
  const dealCardW =
    (contentW - gap * (allDealsCols - 1)) / allDealsCols;

  if (dealsLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const onDealPress = (deal: Deal) => {
    navigation.navigate('ProductDetail', { dealId: deal._id, deal });
  };

  return (
    <View style={s.root}>
      <TopNav
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categoryChips}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        onProfilePress={() => navigation.navigate('Profile')}
        width={contentW}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...refresh} />}
      >
        <View style={[s.body, { width: contentW + (isMobile ? 32 : 64) }]}>
          {/* ── Hero Row ─────────────────────────────────────────────────── */}
          {isCompact ? (
            <View style={{ gap }}>
              <FeaturedHeroCard deal={heroDeal} onPress={() => heroDeal && onDealPress(heroDeal)} />
              <View style={[s.heroRightStack, { gap }]}>
                <LiveDealsCard count={allDeals.length} />
                <PromoImageCard deal={promoDeal} onPress={() => promoDeal && onDealPress(promoDeal)} />
              </View>
            </View>
          ) : (
            <View style={[s.heroRow, { gap }]}>
              <View style={{ flex: 1.5 }}>
                <FeaturedHeroCard deal={heroDeal} onPress={() => heroDeal && onDealPress(heroDeal)} />
              </View>
              <View style={[s.heroRightStack, { flex: 1, gap }]}>
                <LiveDealsCard count={allDeals.length} />
                <PromoImageCard deal={promoDeal} onPress={() => promoDeal && onDealPress(promoDeal)} />
              </View>
            </View>
          )}

          {/* ── Trending Now ─────────────────────────────────────────────── */}
          {trendingDeals.length > 0 ? (
            <View style={s.section}>
              <SectionHeader
                title="Trending Now"
                onSeeAll={() => setSelectedCategory('All')}
              />
              {isMobile ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap, paddingRight: 16 }}
                >
                  {trendingDeals.map((deal) => (
                    <TrendingCard
                      key={deal._id}
                      deal={deal}
                      width={trendCardW}
                      onPress={() => onDealPress(deal)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={[s.row, { gap }]}>
                  {trendingDeals.slice(0, Math.floor(trendCols)).map((deal) => (
                    <TrendingCard
                      key={deal._id}
                      deal={deal}
                      width={trendCardW}
                      onPress={() => onDealPress(deal)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── All Deals ────────────────────────────────────────────────── */}
          <View style={s.section}>
            <SectionHeader
              title="All Deals"
              count={`${filteredDeals.length} deals`}
            />
            {filteredDeals.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>No deals match your filter</Text>
                <Text style={s.emptySub}>Try clearing the search or pick a different category</Text>
              </View>
            ) : (
              <View style={[s.grid, { gap }]}>
                {filteredDeals.map((deal) => (
                  <DealGridCard
                    key={deal._id}
                    deal={deal}
                    width={dealCardW}
                    onPress={() => onDealPress(deal)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Featured Picks ───────────────────────────────────────────── */}
          {featuredDeals.length > 0 ? (
            <View style={s.section}>
              <SectionHeader title="Featured Picks" count={`${featuredDeals.length} deals`} />
              {isMobile ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap, paddingRight: 16 }}
                >
                  {featuredDeals.map((deal) => (
                    <TrendingCard
                      key={deal._id}
                      deal={deal}
                      width={trendCardW}
                      onPress={() => onDealPress(deal)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={[s.row, { gap }]}>
                  {featuredDeals.slice(0, Math.floor(trendCols)).map((deal) => (
                    <TrendingCard
                      key={deal._id}
                      deal={deal}
                      width={trendCardW}
                      onPress={() => onDealPress(deal)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* ── Shop by Category ─────────────────────────────────────────── */}
          {dealsPageCategories.length > 0 ? (
            <View style={s.section}>
              <SectionHeader title="Shop by Category" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap, paddingRight: 16 }}
              >
                {dealsPageCategories.map((cat) => (
                  <CategoryShopCard
                    key={cat._id}
                    category={cat}
                    onPress={() => setSelectedCategory(cat.name)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* ── Promo Banner ─────────────────────────────────────────────── */}
          {dealsBanner ? (
            <View style={s.section}>
              <PromoBannerStrip banner={dealsBanner} />
            </View>
          ) : null}

          {/* ── Per-Category rows (Food & Dining, Electronics, ...) ──────── */}
          {dealsPageCategories.map((cat) => {
            const list = dealsByCategory[cat._id] ?? [];
            if (list.length === 0) return null; // auto-hide empty
            return (
              <View key={`cat-row-${cat._id}`} style={s.section}>
                <SectionHeader
                  title={cat.name}
                  count={`${list.length} deals`}
                  onSeeAll={() => setSelectedCategory(cat.name)}
                />
                {isMobile ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap, paddingRight: 16 }}
                  >
                    {list.map((deal) => (
                      <TrendingCard
                        key={deal._id}
                        deal={deal}
                        width={trendCardW}
                        onPress={() => onDealPress(deal)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[s.row, { gap }]}>
                    {list.slice(0, Math.floor(trendCols)).map((deal) => (
                      <TrendingCard
                        key={deal._id}
                        deal={deal}
                        width={trendCardW}
                        onPress={() => onDealPress(deal)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  fullImage: { width: '100%', height: '100%' },

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
  topNavInner: { gap: 12 },
  topNavRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  todaysDealsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E9F4FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
  },
  todaysDealsTxt: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
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
  navChipEmoji: {
    fontSize: 13,
    color: '#475569',
  },
  navChipTxt: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#475569',
  },
  navChipTxtActive: {
    color: '#fff',
  },

  // ── Body
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 64,
  },
  body: {
    padding: 32,
    gap: 32,
  },

  // ── Hero Row
  heroRow: {
    flexDirection: 'row',
  },
  heroRightStack: {
    flexDirection: 'column',
  },
  heroLeft: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F1A35',
  },
  heroLeftContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 28,
    zIndex: 2,
  },
  featuredPill: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 3,
  },
  featuredPillTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 1,
  },
  heroOverline: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    lineHeight: 36,
  },
  heroTitleAccent: {
    color: '#FBBF24',
  },
  heroFooter: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  heroCtaTxt: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  avatarPile: {
    flexDirection: 'row',
    height: 26,
    width: 90,
    position: 'relative',
  },
  pileAvatar: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0F1A35',
  },
  pileMore: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pileMoreTxt: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Live Deals card
  liveCard: {
    height: 112,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
    backgroundColor: '#0F1A35',
  },
  liveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  liveLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveCount: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    zIndex: 2,
  },
  liveCountTxt: {
    fontSize: 36,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    lineHeight: 38,
  },
  liveCountPlus: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    marginTop: 2,
    marginLeft: 2,
  },
  liveSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    zIndex: 2,
  },
  liveSparkle: {
    position: 'absolute',
    right: 16,
    top: 16,
  },

  // ── Promo card
  promoCard: {
    flex: 1,
    height: 112,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  promoText: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    zIndex: 2,
  },
  promoTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  promoSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // ── Section
  section: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#94a3b8',
    marginLeft: 4,
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

  row: {
    flexDirection: 'row',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // ── Cashback chip (shared)
  cashChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    zIndex: 2,
  },
  cashChipTxt: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // ── Trending card
  trendCard: {},
  trendImageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    marginBottom: 8,
  },
  trendBrand: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  trendCategory: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 2,
  },

  // ── Deal grid card
  dealCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  dealImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  dealContent: {
    padding: 12,
    gap: 4,
  },
  dealBrand: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
  dealTitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#64748b',
  },
  dealExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dealExpiryTxt: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#f97316',
  },

  // ── Empty state
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748b',
  },

  // ── Shop by Category (horizontal cards)
  shopByCatCard: {
    width: 140,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    justifyContent: 'space-between',
  },
  shopByCatEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopByCatEmoji: { fontSize: 18 },
  shopByCatLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: -0.2,
  },

  // ── Promo banner strip
  bannerStrip: {
    height: 132,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  bannerStripImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  bannerStripContent: {
    gap: 4,
    maxWidth: '70%',
  },
  bannerStripTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  bannerStripSub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.92)',
  },
  bannerStripCta: {
    position: 'absolute',
    right: 24,
    top: '50%',
    transform: [{ translateY: -16 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerStripCtaTxt: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#0f172a',
  },
});
