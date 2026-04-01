import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Search, Zap, SlidersHorizontal } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { DealCard } from '../../components/DealCard';
import { dealsAPI, categoriesAPI, Deal, Category, TrendingBrand } from '../../api/deals';

// Fallback data used when API calls fail
const FALLBACK_CATEGORIES = ['All', 'Fashion', 'Electronics', 'Home', 'Pharmacy', 'Travel', 'Food'];
const FALLBACK_TRENDING_BRANDS = [
  { brand: 'Myntra', category: 'Fashion', maxCashback: 12, totalClicks: 0, dealCount: 0 },
  { brand: 'Amazon', category: 'Electronics', maxCashback: 5, totalClicks: 0, dealCount: 0 },
  { brand: 'Swiggy', category: 'Food', maxCashback: 100, totalClicks: 0, dealCount: 0 },
  { brand: 'Nykaa', category: 'Pharmacy', maxCashback: 8, totalClicks: 0, dealCount: 0 },
  { brand: 'Campus Sutra', category: 'Fashion', maxCashback: 10, totalClicks: 0, dealCount: 0 },
];
const FALLBACK_DEALS = [
  { _id: '1', brand: 'Myntra', title: 'Flat 50% Off on Top Brands', description: 'Flat 50% Off on Top Brands', cashbackPercent: 12, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Fashion', slug: 'fashion' } },
  { _id: '2', brand: 'Amazon', title: 'Great Indian Festival Sale', description: 'Great Indian Festival Sale', cashbackPercent: 5, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 1 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Electronics', slug: 'electronics' } },
  { _id: '3', brand: 'Swiggy', title: '50% Off on First Order', description: '50% Off on First Order', cashbackPercent: 0, cashbackType: 'flat' as const, flatCashback: 100, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Food', slug: 'food' } },
  { _id: '4', brand: 'Nykaa', title: 'Mega Beauty Sale', description: 'Mega Beauty Sale', cashbackPercent: 8, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Pharmacy', slug: 'pharmacy' } },
  { _id: '5', brand: 'Campus Sutra', title: "Campus Sutra Men's Tailored Jacket", description: "Campus Sutra Men's Tailored Jacket", cashbackPercent: 10, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Fashion', slug: 'fashion' } },
  { _id: '6', brand: 'boAt', title: 'Wireless Earbuds 50% Off', description: 'Wireless Earbuds 50% Off', cashbackPercent: 15, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 4 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Electronics', slug: 'electronics' } },
  { _id: '7', brand: 'Pepperfry', title: 'Home Decor Extravaganza', description: 'Home Decor Extravaganza', cashbackPercent: 7, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 12 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Home', slug: 'home' } },
  { _id: '8', brand: 'PharmEasy', title: 'Flat 25% Off on Medicines', description: 'Flat 25% Off on Medicines', cashbackPercent: 5, cashbackType: 'percentage' as const, flatCashback: 0, affiliateUrl: '', imageUrl: '', lockPeriodDays: 0, expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(), tags: [], termsAndConditions: '', isActive: true, isFeatured: false, clickCount: 0, createdAt: '', category: { _id: '', name: 'Pharmacy', slug: 'pharmacy' } },
];

function formatCashback(deal: Deal): string {
  if (deal.cashbackType === 'flat') {
    return `\u20B9${deal.flatCashback} back`;
  }
  return `${deal.cashbackPercent}% back`;
}

function formatExpiresIn(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'about 24 hours';
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

function formatBrandCashback(brand: TrendingBrand): string {
  return `${brand.maxCashback}% back`;
}

export const HomeScreen = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch deals
  const {
    data: dealsResponse,
    isLoading: dealsLoading,
  } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealsAPI.getDeals(),
  });

  // Fetch trending brands
  const {
    data: trendingResponse,
    isLoading: trendingLoading,
  } = useQuery({
    queryKey: ['trendingBrands'],
    queryFn: () => dealsAPI.getTrendingBrands(),
  });

  // Fetch categories
  const {
    data: categoriesResponse,
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });

  // Resolve data with fallbacks
  const allDeals: Deal[] = dealsResponse?.data?.deals ?? dealsResponse?.deals ?? dealsResponse?.data ?? FALLBACK_DEALS;
  const trendingBrands: TrendingBrand[] = trendingResponse?.data?.brands ?? trendingResponse?.brands ?? trendingResponse?.data ?? FALLBACK_TRENDING_BRANDS;
  const apiCategories: Category[] = categoriesResponse?.data?.categories ?? categoriesResponse?.categories ?? categoriesResponse?.data ?? [];

  const categories: string[] = useMemo(() => {
    if (apiCategories.length > 0) {
      const names = apiCategories.map((c: Category) => c.name);
      return ['All', ...names];
    }
    return FALLBACK_CATEGORIES;
  }, [apiCategories]);

  // Filter deals by selected category
  const filteredDeals = useMemo(() => {
    if (selectedCategory === 'All') return allDeals;
    return allDeals.filter(
      (deal) => deal.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [allDeals, selectedCategory]);

  const isLoading = dealsLoading || trendingLoading || categoriesLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Loading deals...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search deals, brands..."
            placeholderTextColor={Colors.textSecondary}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.todayDealsBtn}>
            <Zap size={16} color={Colors.primary} fill={Colors.primary} />
            <Text style={styles.todayDealsText}>Today's Deals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <SlidersHorizontal size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
            style={styles.avatar}
          />
        </View>
      </View>

      {/* Categories */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.categoryPillText, selectedCategory === cat && styles.categoryPillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroMain}>
          <View style={styles.featuredBadge}>
            <Zap size={12} color="#fff" fill="#fff" />
            <Text style={styles.featuredBadgeText}>FEATURED</Text>
          </View>
          <Text style={styles.heroSubtitle}>EARN WHILE YOU SHOP</Text>
          <Text style={styles.heroTitle}>Up to <Text style={{color: '#60a5fa'}}>20% cashback</Text>{'\n'}on fashion brands</Text>
          <TouchableOpacity style={styles.heroBtn}>
            <Text style={styles.heroBtnText}>Explore Fashion ↗</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroSide}>
          <View style={[styles.sideCard, styles.sideCardDark, { marginBottom: 16 }]}>
            <Text style={styles.sideCardLabelLight}>⚡ LIVE DEALS</Text>
            <Text style={[styles.sideCardHighlight, {color: '#fff'}]}>{allDeals.length}<Text style={{color: '#60a5fa'}}>+</Text></Text>
            <Text style={{color: '#94a3b8', fontSize: 12}}>Updated daily</Text>
          </View>
          <View style={styles.sideCard}>
            <Text style={[styles.sideCardTitle, {color: Colors.primary}]}>Myntra</Text>
            <Text style={styles.sideCardDesc}>Electronics Sale</Text>
            <Text style={{color: Colors.primary, fontSize: 13, marginTop: 4}}>Up to <Text style={{fontWeight: '700'}}>15% cashback</Text></Text>
          </View>
        </View>
      </View>

      {/* Trending Now */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <TouchableOpacity><Text style={styles.seeAllText}>See all {'>'}</Text></TouchableOpacity>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingRow}>
          {trendingBrands.map((brand) => (
            <View key={brand.brand} style={styles.trendingItem}>
              <View style={styles.trendingBrandCircle}>
                <View style={styles.trendingCashbackBadge}>
                  <Text style={styles.trendingCashbackText}>{formatBrandCashback(brand)}</Text>
                </View>
                <Text style={styles.trendingBrandText}>{brand.brand[0]}</Text>
              </View>
              <Text style={styles.trendingBrandName}>{brand.brand}</Text>
              <Text style={styles.trendingBrandCategory}>{brand.category}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* All Deals */}
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>All Deals</Text>
          <Text style={styles.dealsCount}>{filteredDeals.length} deals</Text>
        </View>
      </View>
      <View style={styles.dealsGrid}>
        {filteredDeals.map((deal) => (
          <DealCard
            key={deal._id}
            brand={deal.brand}
            description={deal.title || deal.description}
            cashback={formatCashback(deal)}
            expiresIn={formatExpiresIn(deal.expiresAt)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    padding: 32,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    outlineStyle: 'none' as any, // For web focus
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayDealsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  todayDealsText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  categoriesRow: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
  },
  categoryPillActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  categoryPillText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: Colors.surface,
  },
  heroSection: {
    flexDirection: 'row',
    marginBottom: 40,
    flexWrap: 'wrap',
  },
  heroMain: {
    flex: 2,
    minWidth: 300,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 40,
    marginRight: 16,
    justifyContent: 'center',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96,165,250,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    marginBottom: 16,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    maxWidth: '80%',
    marginBottom: 24,
    lineHeight: 40,
  },
  heroBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  heroSide: {
    flex: 1,
    minWidth: 200,
  },
  sideCard: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    justifyContent: 'center',
  },
  sideCardTitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  sideCardHighlight: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  sideCardDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  sideCardLabelLight: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  sideCardDesc: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  dealsCount: {
    marginLeft: 12,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trendingRow: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  trendingItem: {
    marginRight: 24,
    alignItems: 'center',
  },
  trendingBrandCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trendingBrandText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  trendingCashbackBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  trendingCashbackText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  trendingBrandName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  trendingBrandCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10, // Offset for card margins
  },
});
