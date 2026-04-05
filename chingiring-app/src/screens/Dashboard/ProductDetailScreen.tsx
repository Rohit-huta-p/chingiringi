import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Image, Dimensions, Linking, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { dealsAPI } from '../../api/deals';

const SIZES = ['30', '32', '34', '36'];

function formatExpiresIn(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

export const ProductDetailScreen = () => {
  // Use screen width (not layout width) to detect desktop — the drawer sidebar reduces layout width
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;
  const navigation = useNavigation();
  const route = useRoute<any>();
  const passedDeal = route.params?.deal;
  const dealId = route.params?.dealId;
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const { data: fetchedDealResponse } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDeal(dealId),
    enabled: !!dealId && !passedDeal,
  });

  const deal = passedDeal || fetchedDealResponse?.data?.deal || fetchedDealResponse?.data;

  const handleShopNow = async () => {
    const url = deal?.affiliateUrl;
    if (!url) return;
    try {
      if (dealId) dealsAPI.trackClick(dealId).catch(() => {});
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open the link. Please try again.');
    }
  };

  const title = deal?.title || deal?.description || 'Flat 50% Off on Top Brands';
  const brand = deal?.brand || 'Myntra';
  const categoryName = deal?.category?.name || 'Fashion';
  const cashbackPercent = deal?.cashbackPercent ?? 12;
  const cashbackType = deal?.cashbackType || 'percentage';
  const flatCashback = deal?.flatCashback ?? 0;
  const expiresAt = deal?.expiresAt;
  const lockPeriodDays = deal?.lockPeriodDays ?? 45;
  const imageUrl = deal?.imageUrl;
  const termsAndConditions = deal?.termsAndConditions || '';
  const terms = termsAndConditions
    ? termsAndConditions.split('\n').filter(Boolean)
    : ['Max cashback 500', 'Valid only for new users', 'Cashback tracks in 48 hours'];
  const cashbackDisplay =
    cashbackType === 'flat' ? `\u20B9${flatCashback}` : `${cashbackPercent}%`;

  // ─── Image Panel ──────────────────────────────────────────────────────
  const imagePanel = (
    <View style={[styles.imageContainer, isDesktop && styles.imageContainerDesktop]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>{brand[0]}</Text>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>{'\u2039'}</Text>
      </TouchableOpacity>

      {/* Share button */}
      <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
        <Text style={styles.shareButtonText}>{'\u2197'}</Text>
      </TouchableOpacity>

      {/* Brand overlay at bottom */}
      <View style={styles.brandOverlay}>
        <Text style={styles.brandOverlayLabel}>Shop at</Text>
        <Text style={styles.brandOverlayName}>{brand}</Text>
        <Text style={styles.brandOverlayCategory}>{categoryName}</Text>
      </View>
    </View>
  );

  // ─── Details Panel ────────────────────────────────────────────────────
  const detailsPanel = (
    <ScrollView
      style={[styles.detailsScroll, isDesktop && styles.detailsScrollDesktop]}
      contentContainerStyle={styles.detailsContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Category Tags */}
      <View style={styles.tagsRow}>
        <View style={[styles.tagPill, styles.tagBlue]}>
          <Text style={[styles.tagText, styles.tagBlueText]}>{'\u25C7'} {categoryName}</Text>
        </View>
        <View style={[styles.tagPill, styles.tagOrange]}>
          <Text style={[styles.tagText, styles.tagOrangeText]}>{'\u25C7'} Active</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.productTitle}>{title}</Text>
      <Text style={styles.productSubtitle}>at {brand}</Text>

      {/* Stat Cards */}
      <View style={styles.statCardsRow}>
        <Card style={styles.statCard}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconCircle}>
              <Text style={styles.statIconText}>%</Text>
            </View>
            <Text style={styles.statLabel}>CASHBACK</Text>
          </View>
          <Text style={styles.statValue}>{cashbackDisplay}</Text>
          <Text style={styles.statSub}>On every purchase</Text>
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconCircle, { backgroundColor: '#fff7ed' }]}>
              <Text style={[styles.statIconText, { color: '#f97316' }]}>{'\u23F0'}</Text>
            </View>
            <Text style={styles.statLabel}>EXPIRES</Text>
          </View>
          <Text style={styles.statValue}>
            {expiresAt ? formatExpiresIn(expiresAt) : '3 days'}
          </Text>
          <Text style={styles.statSub}>Remaining</Text>
        </Card>
      </View>

      {/* Lock Period */}
      <Card style={styles.lockCard}>
        <View style={styles.lockRow}>
          <View style={styles.lockIconCircle}>
            <Text style={styles.lockIconText}>{'\u2713'}</Text>
          </View>
          <View style={styles.lockTextContainer}>
            <Text style={styles.lockTitle}>{lockPeriodDays}-Day Lock Period</Text>
            <Text style={styles.lockDescription}>
              Cashback confirmed after {lockPeriodDays} days {'\u2014'} covers returns &
              cancellations.
            </Text>
          </View>
        </View>
      </Card>

      {/* Available Sizes */}
      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>AVAILABLE SIZES</Text>
        <View style={styles.sizesRow}>
          {SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.sizePill, selectedSize === size && styles.sizePillActive]}
              onPress={() => setSelectedSize(size)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sizePillText,
                  selectedSize === size && styles.sizePillTextActive,
                ]}
              >
                {size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Terms & Conditions */}
      <Card style={styles.card}>
        <View style={styles.termsHeader}>
          <View style={styles.termsIconCircle}>
            <Text style={styles.termsIconText}>i</Text>
          </View>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
        </View>
        {terms.map((term, index) => (
          <View key={index} style={styles.termRow}>
            <View style={styles.termCheckCircle}>
              <Text style={styles.termCheckText}>{'\u2713'}</Text>
            </View>
            <Text style={styles.termText}>{term}</Text>
          </View>
        ))}
      </Card>

      {/* CTA */}
      <Button
        title={"Shop Now & Earn Cashback \u2197"}
        onPress={handleShopNow}
        style={styles.ctaButton}
      />
      <Text style={styles.helperText}>
        You'll be tracked and cashback credited automatically
      </Text>
    </ScrollView>
  );

  // ─── Layout ───────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View style={styles.desktopContainer}>
        {imagePanel}
        {detailsPanel}
      </View>
    );
  }

  // Mobile: stacked layout
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.mobileScrollContent}>
      {imagePanel}
      <View style={styles.mobileDetails}>{detailsPanel}</View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // ─── Containers ─────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mobileScrollContent: {
    paddingBottom: 40,
  },
  mobileDetails: {
    flex: 1,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },

  // ─── Image Panel ────────────────────────────────────────────────────
  imageContainer: {
    height: 360,
    backgroundColor: '#e8ecf0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageContainerDesktop: {
    flex: 1,
    height: 'auto' as any,
    minHeight: '100%' as any,
  },
  productImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#9ca3af',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 28,
    color: Colors.text,
    lineHeight: 32,
    marginTop: -2,
  },
  shareButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareButtonText: {
    fontSize: 18,
    color: Colors.text,
  },
  brandOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  brandOverlayLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  brandOverlayName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  brandOverlayCategory: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // ─── Details Panel ──────────────────────────────────────────────────
  detailsScroll: {
    flex: 1,
  },
  detailsScrollDesktop: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  detailsContent: {
    padding: 28,
    paddingBottom: 40,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagBlue: {
    borderColor: Colors.primary,
    backgroundColor: '#eff6ff',
  },
  tagOrange: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagBlueText: {
    color: Colors.primary,
  },
  tagOrangeText: {
    color: '#f97316',
  },
  productTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 34,
  },
  productSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
  },

  // ─── Stat Cards ─────────────────────────────────────────────────────
  statCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  statSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ─── Lock Period ────────────────────────────────────────────────────
  lockCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lockIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  lockIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  lockTextContainer: {
    flex: 1,
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  lockDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ─── Card, Sizes ───────────────────────────────────────────────────
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sizesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizePill: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sizePillTextActive: {
    color: '#fff',
  },

  // ─── Terms ──────────────────────────────────────────────────────────
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  termsIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsIconText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  termCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  termText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },

  // ─── CTA ────────────────────────────────────────────────────────────
  ctaButton: {
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 14,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
