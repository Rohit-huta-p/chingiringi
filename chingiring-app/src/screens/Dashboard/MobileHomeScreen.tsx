import React, { useState, useMemo } from 'react';
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
import { Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { dealsAPI, categoriesAPI, bannersAPI, Deal, Category, Banner } from '../../api/deals';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCashback(deal: Deal): string {
  if (deal.cashbackType === 'flat') return `₹${deal.flatCashback}`;
  return `${deal.cashbackPercent}%`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning!';
  if (h < 17) return 'Good Afternoon!';
  return 'Good Evening!';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Category emoji icons ────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  Fashion: '👗', Electronics: '📱', Home: '🏠',
  Pharmacy: '💊', Travel: '✈️', Food: '🍔', All: '🔥',
};

// ─── Category images (Unsplash) ──────────────────────────────────────────────

const CATEGORY_IMAGES: Record<string, string> = {
  Men:         'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=500&q=75',
  Women:       'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=75',
  Kids:        'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=400&q=75',
  Footwear:    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=75',
  Accessories: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=75',
  Fashion:     'https://images.unsplash.com/photo-1445205170230-053b83016050?w=500&q=75',
  Electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=75',
  Home:        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=75',
  Pharmacy:    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=75',
  Travel:      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=75',
  Food:        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75',
};

// Static 5-category showcase (shown when API categories are generic / unnamed)
const SHOWCASE_CATEGORIES = [
  { _id: 'sc-men',   name: 'Men' },
  { _id: 'sc-wom',   name: 'Women' },
  { _id: 'sc-kid',   name: 'Kids' },
  { _id: 'sc-foot',  name: 'Footwear' },
  { _id: 'sc-acc',   name: 'Accessories' },
];

// Gradient palettes — cycled per banner index
const BANNER_GRADIENTS: [string, string][] = [
  ['#4784E2', '#91BDFF'],
  ['#4338ca', '#6366f1'],
  ['#059669', '#34d399'],
  ['#7c3aed', '#a78bfa'],
];

// ─── Fallback data ───────────────────────────────────────────────────────────

const FALLBACK_DEALS: Deal[] = [
  { _id: '1', brand: 'Myntra',       title: 'Flat 50% Off on Top Brands',  description: '', cashbackPercent: 12, cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 45, expiresAt: new Date(Date.now() + 3 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Fashion', slug: 'fashion' } },
  { _id: '2', brand: 'Amazon',       title: 'Great Indian Festival Sale',  description: '', cashbackPercent: 5,  cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 1 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Electronics', slug: 'electronics' } },
  { _id: '3', brand: 'Nykaa',        title: 'Mega Beauty Sale',            description: '', cashbackPercent: 8,  cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 5 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Pharmacy', slug: 'pharmacy' } },
  { _id: '4', brand: 'boAt',         title: 'Wireless Earbuds 50% Off',    description: '', cashbackPercent: 15, cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 4 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Electronics', slug: 'electronics' } },
  { _id: '5', brand: 'PharmEasy',    title: 'Flat 25% Off on Medicines',   description: '', cashbackPercent: 5,  cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 6 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Pharmacy', slug: 'pharmacy' } },
  { _id: '6', brand: 'Campus Sutra', title: "Men's Tailored Jacket",       description: '', cashbackPercent: 10, cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 10 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Fashion', slug: 'fashion' } },
  { _id: '7', brand: 'Zomato',       title: '40% Off on First Order',      description: '', cashbackPercent: 8,  cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Food', slug: 'food' } },
  { _id: '8', brand: 'MakeMyTrip',   title: 'Hotel Deals — Save Big',      description: '', cashbackPercent: 6,  cashbackType: 'percentage', flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 30, expiresAt: new Date(Date.now() + 8 * 864e5).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Travel', slug: 'travel' } },
];

const FALLBACK_BANNERS: Banner[] = [
  { _id: 'fb1', title: 'Supersonic SALE',      subtitle: 'UP TO 100% CASHBACK on your first order', imageUrl: '', linkType: 'url', linkValue: '', position: 'hero' },
  { _id: 'fb2', title: 'Mega Cashback Event',  subtitle: 'Earn up to ₹500 back this week',           imageUrl: '', linkType: 'url', linkValue: '', position: 'inline' },
  { _id: 'fb3', title: 'Refer & Earn ₹50',     subtitle: 'Share your code and earn with every friend',imageUrl: '', linkType: 'url', linkValue: '', position: 'inline' },
];

// ─── Deal Card (2-col grid) ──────────────────────────────────────────────────

function MobileDealCard({ deal, onPress }: { deal: Deal; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 48) / 2;

  return (
    <TouchableOpacity style={[st.dealCard, { width: cardWidth }]} onPress={onPress} activeOpacity={0.75}>
      <View style={st.dealImageBox}>
        {deal.imageUrl ? (
          <Image source={{ uri: deal.imageUrl }} style={st.dealImage} resizeMode="cover" />
        ) : (
          <View style={st.dealImagePlaceholder}>
            <Text style={st.dealImageLetter}>{deal.brand[0]}</Text>
          </View>
        )}
        {/* Cashback badge overlaid */}
        <View style={st.dealCashbackBadge}>
          <Text style={st.dealCashbackText}>Get {formatCashback(deal)} off</Text>
        </View>
      </View>
      <View style={st.dealInfo}>
        <Text style={st.dealBrand} numberOfLines={1}>{deal.brand}</Text>
        <Text style={st.dealTitle} numberOfLines={2}>{deal.title || deal.description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Banner Strip ────────────────────────────────────────────────────────────

function BannerStrip({ banner, gradientIndex = 0 }: { banner: Banner; gradientIndex?: number }) {
  const gradient = BANNER_GRADIENTS[gradientIndex % BANNER_GRADIENTS.length];

  if (banner.imageUrl) {
    return (
      <TouchableOpacity style={st.bannerStrip} activeOpacity={0.9}>
        <Image source={{ uri: banner.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={[StyleSheet.absoluteFillObject]}
        />
        <View style={st.bannerTextBox}>
          <Text style={st.bannerTitle}>{banner.title}</Text>
          {banner.subtitle ? <Text style={st.bannerSub}>{banner.subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[st.bannerStrip, { overflow: 'hidden' }]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      {/* Decorative circle */}
      <View style={st.bannerCircle} />
      <View style={st.bannerTextBox}>
        <Text style={[st.bannerTitle, { color: '#fff' }]}>{banner.title}</Text>
        {banner.subtitle ? (
          <Text style={[st.bannerSub, { color: 'rgba(255,255,255,0.85)' }]}>{banner.subtitle}</Text>
        ) : null}
        <View style={st.bannerBadgesRow}>
          <View style={st.bannerBadge}><Text style={st.bannerBadgeTxt}>₹0 Handling Fee</Text></View>
          <View style={st.bannerBadge}><Text style={st.bannerBadgeTxt}>Free Delivery*</Text></View>
        </View>
      </View>
    </View>
  );
}

// ─── Shop by Category ────────────────────────────────────────────────────────

function ShopByCategorySection({
  apiCategories,
  onPress,
}: {
  apiCategories: Category[];
  onPress: (name: string) => void;
}) {
  const { width } = useWindowDimensions();

  // Use API categories (sans 'All'), fall back to static showcase
  const raw = apiCategories.filter((c) => c.name !== 'All');
  const display = raw.length >= 2 ? raw.slice(0, 5) : SHOWCASE_CATEGORIES;

  const hPad = 32; // 16 left + 16 right
  const gap = 8;
  const containerW = width - hPad;
  const bigW = Math.floor(containerW * 0.42);
  const rightW = containerW - bigW - gap;
  const smallW = Math.floor((rightW - gap) / 2);

  const bigCat = display[0];
  const smallCats = display.slice(1, 5);

  const bigImg = CATEGORY_IMAGES[bigCat.name] ?? `https://picsum.photos/seed/${bigCat.name}/400/600`;
  const smallImg = (name: string) => CATEGORY_IMAGES[name] ?? `https://picsum.photos/seed/${name}/300/300`;

  return (
    <View style={st.catSection}>
      <Text style={st.catSectionTitle}>Shop by category</Text>
      <View style={st.catGrid}>

        {/* ── Big left card ── */}
        <TouchableOpacity
          style={[st.catBigCard, { width: bigW }]}
          onPress={() => onPress(bigCat.name)}
          activeOpacity={0.85}
        >
          <Image source={{ uri: bigImg }} style={[st.catBigImage, { height: smallCats.length > 2 ? 268 : 140 }]} resizeMode="cover" />
          <Text style={st.catLabel}>{bigCat.name}</Text>
        </TouchableOpacity>

        {/* ── Right 2×2 grid ── */}
        <View style={[st.catRightGrid, { width: rightW }]}>
          {smallCats.map((cat) => (
            <TouchableOpacity
              key={cat._id}
              style={[st.catSmallCard, { width: smallW }]}
              onPress={() => onPress(cat.name)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: smallImg(cat.name) }} style={st.catSmallImage} resizeMode="cover" />
              <Text style={st.catLabel}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const MobileHomeScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // ── Data fetching
  const { data: dealsResponse, isLoading: dealsLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealsAPI.getDeals(),
  });
  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });
  const { data: bannersResponse } = useQuery({
    queryKey: ['public-banners'],
    queryFn: () => bannersAPI.getBanners(),
  });

  // ── Normalise API responses
  const allDeals: Deal[] = dealsResponse?.data?.deals ?? dealsResponse?.deals ?? dealsResponse?.data ?? FALLBACK_DEALS;
  const apiCategories: Category[] = categoriesResponse?.data?.categories ?? categoriesResponse?.categories ?? categoriesResponse?.data ?? [];
  const banners: Banner[] = bannersResponse?.data?.banners ?? bannersResponse?.banners ?? bannersResponse?.data ?? FALLBACK_BANNERS;

  const categories = useMemo(() => {
    if (apiCategories.length > 0) return ['All', ...apiCategories.map((c) => c.name)];
    return ['All', 'Fashion', 'Electronics', 'Home', 'Pharmacy'];
  }, [apiCategories]);

  // ── Filter + search
  const filteredDeals = useMemo(() => {
    let deals = allDeals;
    if (selectedCategory !== 'All') {
      deals = deals.filter((d) => d.category?.name?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      deals = deals.filter((d) => d.brand.toLowerCase().includes(q) || d.title?.toLowerCase().includes(q));
    }
    return deals;
  }, [allDeals, selectedCategory, searchQuery]);

  // ── Build repeating sections: Banner → 6Deals → Banner → Categories → repeat
  const sections = useMemo(() => {
    type Section =
      | { type: 'banner'; data: Banner; gradientIndex: number }
      | { type: 'deals'; data: Deal[] }
      | { type: 'categories' };

    const result: Section[] = [];
    const dealChunks = filteredDeals.length > 0 ? chunkArray(filteredDeals, 6) : [[]];
    let bannerIdx = 0;

    for (let i = 0; i < dealChunks.length; i++) {
      // Banner 1
      result.push({ type: 'banner', data: banners[bannerIdx % banners.length], gradientIndex: bannerIdx });
      bannerIdx++;

      // 6 deals
      result.push({ type: 'deals', data: dealChunks[i] });

      // Banner 2
      result.push({ type: 'banner', data: banners[bannerIdx % banners.length], gradientIndex: bannerIdx });
      bannerIdx++;

      // Shop by category
      result.push({ type: 'categories' });
    }

    return result;
  }, [filteredDeals, banners]);

  if (dealsLoading) {
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={st.container} showsVerticalScrollIndicator={false}>

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
              <Text style={st.avatarInitial}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tabs + Search + Categories */}
        <View style={st.tabSearchWrapper}>
          {/* Tabs row */}
          <View style={st.tabsRow}>
            {['Demo', '50%', 'Super', 'Cafe'].map((label, i) => {
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

      {/* ── Repeating sections ─────────────────────────────────────── */}
      {sections.map((section, idx) => {
        if (section.type === 'banner') {
          return (
            <BannerStrip
              key={`banner-${idx}`}
              banner={section.data}
              gradientIndex={section.gradientIndex}
            />
          );
        }

        if (section.type === 'deals') {
          if (section.data.length === 0) {
            return (
              <View key={`deals-${idx}`} style={st.emptyState}>
                <Text style={st.emptyTitle}>No deals found</Text>
                <Text style={st.emptySub}>Try a different category or search term</Text>
              </View>
            );
          }
          return (
            <View key={`deals-${idx}`} style={st.dealsGrid}>
              {section.data.map((deal) => (
                <MobileDealCard
                  key={deal._id}
                  deal={deal}
                  onPress={() => navigation.navigate('ProductDetail', { dealId: deal._id, deal })}
                />
              ))}
            </View>
          );
        }

        if (section.type === 'categories') {
          return (
            <ShopByCategorySection
              key={`cat-${idx}`}
              apiCategories={apiCategories}
              onPress={(name) => setSelectedCategory(name)}
            />
          );
        }

        return null;
      })}

      {/* Bottom spacer for floating tab bar */}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },

  // ── Header ────────────────────────────────────────────────────────────────
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
  },
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

  // ── Banner Strip ──────────────────────────────────────────────────────────
  bannerStrip: {
    height: 168,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bannerCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerTextBox: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 10,
  },
  bannerBadgesRow: { flexDirection: 'row', gap: 8 },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bannerBadgeTxt: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },

  // ── Deal Cards Grid ───────────────────────────────────────────────────────
  dealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  dealCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  dealImageBox: {
    height: 210,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dealImage: { width: '100%', height: '100%' },
  dealImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dealImageLetter: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    color: Colors.textSecondary,
  },
  dealCashbackBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dealCashbackText: {
    color: '#16a34a',
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  dealInfo: { padding: 10 },
  dealBrand: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  dealTitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ── Shop by Category ─────────────────────────────────────────────────────
  catSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  catSectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: '#1e293b',
    marginBottom: 12,
  },
  catGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  catBigCard: {
    alignItems: 'center',
  },
  catBigImage: {
    width: '100%',
    borderRadius: 16,
    marginBottom: 8,
  },
  catRightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catSmallCard: {
    alignItems: 'center',
  },
  catSmallImage: {
    width: '100%',
    height: 125,
    borderRadius: 14,
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    textAlign: 'center',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
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
