import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

const SIZES = ['30', '32', '34', '36'];

const TERMS = [
  'Max cashback 500',
  'Valid only for new users',
  'Cashback tracks in 48 hours',
];

export const ProductDetailScreen = () => {
  const navigation = useNavigation();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        <TouchableOpacity style={styles.navArrowLeft} activeOpacity={0.7}>
          <Text style={styles.navArrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navArrowRight} activeOpacity={0.7}>
          <Text style={styles.navArrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareIconButton} activeOpacity={0.7}>
          <Text style={styles.shareIconText}>{'\u2197'}</Text>
        </TouchableOpacity>
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        {/* Category Tags */}
        <View style={styles.tagsRow}>
          <View style={[styles.tagPill, styles.tagBlue]}>
            <Text style={[styles.tagText, styles.tagBlueText]}>Fashion</Text>
          </View>
          <View style={[styles.tagPill, styles.tagOrange]}>
            <Text style={[styles.tagText, styles.tagOrangeText]}>Active</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.productTitle}>Flat 50% Off on Top Brands</Text>
        <Text style={styles.productSubtitle}>at Myntra</Text>

        {/* Stat Cards */}
        <View style={styles.statCardsRow}>
          <Card style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Text style={styles.statIconText}>%</Text>
            </View>
            <Text style={styles.statLabel}>CASHBACK</Text>
            <Text style={styles.statValue}>12%</Text>
            <Text style={styles.statSub}>On every purchase</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Text style={styles.statIconText}>{'\u23F0'}</Text>
            </View>
            <Text style={styles.statLabel}>EXPIRES</Text>
            <Text style={styles.statValue}>3 days</Text>
            <Text style={styles.statSub}>Remaining</Text>
          </Card>
        </View>

        {/* Lock Period */}
        <View style={styles.lockCard}>
          <View style={styles.lockHeader}>
            <Text style={styles.lockIcon}>{'\u{1F6E1}'}</Text>
            <Text style={styles.lockTitle}>45-Day Lock Period</Text>
          </View>
          <Text style={styles.lockDescription}>
            Cashback confirmed after 45 days {'\u2014'} covers returns & cancellations.
          </Text>
        </View>

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
                <Text style={[styles.sizePillText, selectedSize === size && styles.sizePillTextActive]}>
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Terms & Conditions */}
        <Card style={styles.card}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          {TERMS.map((term, index) => (
            <View key={index} style={styles.termRow}>
              <Text style={styles.termBullet}>{'\u2022'}</Text>
              <Text style={styles.termText}>{term}</Text>
            </View>
          ))}
        </Card>

        {/* CTA */}
        <Button
          title="Shop Now & Earn Cashback \u2197"
          onPress={() => {}}
          style={styles.ctaButton}
        />
        <Text style={styles.helperText}>
          You'll be tracked and cashback credited automatically
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  imageContainer: {
    height: 300,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navArrowLeft: {
    position: 'absolute',
    left: 12,
    top: '45%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowRight: {
    position: 'absolute',
    right: 12,
    top: '45%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    fontSize: 24,
    color: Colors.text,
    lineHeight: 28,
  },
  shareIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconText: {
    fontSize: 18,
    color: Colors.text,
  },
  detailsSection: {
    padding: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
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
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  productSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  statSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  lockCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  lockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  lockDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginLeft: 26,
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionLabel: {
    fontSize: 10,
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
    borderRadius: 22,
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
  termsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  termBullet: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 8,
    lineHeight: 20,
  },
  termText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  ctaButton: {
    marginTop: 8,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
