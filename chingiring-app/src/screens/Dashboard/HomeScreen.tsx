import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { Search, Zap, SlidersHorizontal } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { DealCard } from '../../components/DealCard';

const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Home', 'Pharmacy', 'Travel', 'Food'];
const TRENDING_BRANDS = [
  { name: 'Myntra', category: 'Fashion', cashback: '12% back' },
  { name: 'Amazon', category: 'Electronics', cashback: '5% back' },
  { name: 'Swiggy', category: 'Food', cashback: '₹100 back' },
  { name: 'Nykaa', category: 'Pharmacy', cashback: '8% back' },
  { name: 'Campus Sutra', category: 'Fashion', cashback: '10% back' },
];
const ALL_DEALS = [
  { id: 1, brand: 'Myntra', description: 'Flat 50% Off on Top Brands', cashback: '12% back', expiresIn: '3 days' },
  { id: 2, brand: 'Amazon', description: 'Great Indian Festival Sale', cashback: '5% back', expiresIn: 'about 24 hours' },
  { id: 3, brand: 'Swiggy', description: '50% Off on First Order', cashback: '₹100 back', expiresIn: '7 days' },
  { id: 4, brand: 'Nykaa', description: 'Mega Beauty Sale', cashback: '8% back', expiresIn: '5 days' },
  { id: 5, brand: 'Campus Sutra', description: "Campus Sutra Men's Tailored Jacket", cashback: '10% back', expiresIn: '10 days' },
  { id: 6, brand: 'boAt', description: 'Wireless Earbuds 50% Off', cashback: '15% back', expiresIn: '4 days' },
  { id: 7, brand: 'Pepperfry', description: 'Home Decor Extravaganza', cashback: '7% back', expiresIn: '12 days' },
  { id: 8, brand: 'PharmEasy', description: 'Flat 25% Off on Medicines', cashback: '5% back', expiresIn: '6 days' },
];

export const HomeScreen = () => {
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
          {CATEGORIES.map((cat, index) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryPill, index === 0 && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryPillText, index === 0 && styles.categoryPillTextActive]}>{cat}</Text>
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
            <Text style={[styles.sideCardHighlight, {color: '#fff'}]}>8<Text style={{color: '#60a5fa'}}>+</Text></Text>
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
          {TRENDING_BRANDS.map(brand => (
            <View key={brand.name} style={styles.trendingItem}>
              <View style={styles.trendingBrandCircle}>
                <View style={styles.trendingCashbackBadge}>
                  <Text style={styles.trendingCashbackText}>{brand.cashback}</Text>
                </View>
                <Text style={styles.trendingBrandText}>{brand.name[0]}</Text>
              </View>
              <Text style={styles.trendingBrandName}>{brand.name}</Text>
              <Text style={styles.trendingBrandCategory}>{brand.category}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* All Deals */}
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>All Deals</Text>
          <Text style={styles.dealsCount}>{ALL_DEALS.length} deals</Text>
        </View>
      </View>
      <View style={styles.dealsGrid}>
        {ALL_DEALS.map(deal => (
          <DealCard 
            key={deal.id}
            brand={deal.brand}
            description={deal.description}
            cashback={deal.cashback}
            expiresIn={deal.expiresIn}
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
