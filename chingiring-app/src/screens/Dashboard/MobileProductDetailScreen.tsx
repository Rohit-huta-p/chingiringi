import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { ArrowLeft, Share2, Clock, Percent, Lock, CheckCircle } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Button } from '../../components/Button';
import { dealsAPI } from '../../api/deals';

function formatExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.ceil(diff / 86_400_000);
  return days === 1 ? '1 day' : `${days} days`;
}

export const MobileProductDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const passedDeal = route.params?.deal;
  const dealId = route.params?.dealId;

  const { data: fetchedDealResponse } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDeal(dealId),
    enabled: !!dealId && !passedDeal,
  });

  const deal = passedDeal || fetchedDealResponse?.data?.deal || fetchedDealResponse?.data;

  const title = deal?.title || deal?.description || 'Flat 50% Off on Top Brands';
  const brand = deal?.brand || 'Myntra';
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
  const cashbackDisplay = cashbackType === 'flat' ? `₹${flatCashback}` : `${cashbackPercent}%`;

  const handleShopNow = async () => {
    const url = deal?.affiliateUrl;
    if (!url) return;
    try {
      if (dealId) dealsAPI.trackClick(dealId).catch(() => {});
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open the link.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Product Image ─────────────────────────────────── */}
        <View style={styles.imageBox}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderLetter}>{brand[0]}</Text>
            </View>
          )}

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.shareBtn}>
            <Share2 size={18} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Content ───────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Brand badge */}
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>{brand}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Info cards row */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Percent size={16} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.infoLabel}>CASHBACK</Text>
              <Text style={styles.infoValue}>{cashbackDisplay}</Text>
            </View>
            <View style={styles.infoCard}>
              <Clock size={16} color="#f97316" strokeWidth={2} />
              <Text style={styles.infoLabel}>EXPIRY</Text>
              <Text style={styles.infoValue}>{expiresAt ? formatExpiresIn(expiresAt) : '—'}</Text>
            </View>
          </View>

          {/* Lock period notice */}
          <View style={styles.lockNotice}>
            <Lock size={14} color="#f97316" strokeWidth={2} />
            <View style={styles.lockTextWrap}>
              <Text style={styles.lockTitle}>Lock Period: {lockPeriodDays} Days</Text>
              <Text style={styles.lockDesc}>
                Cashback stays pending for {lockPeriodDays} days to ensure no returns or cancellations before confirmation.
              </Text>
            </View>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.termsSection}>
            <Text style={styles.termsHeader}>Terms & Conditions</Text>
            {terms.map((term: string, i: number) => (
              <View key={i} style={styles.termRow}>
                <CheckCircle size={14} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.termText}>{term}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <Button
          title="Shop Now & Earn Cashback"
          onPress={handleShopNow}
          style={styles.shopBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },

  // ── Image ──
  imageBox: {
    height: 300,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8edf5',
  },
  imagePlaceholderLetter: {
    fontSize: 64,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Content ──
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  brandBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    lineHeight: 26,
  },

  // ── Info cards ──
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },

  // ── Lock notice ──
  lockNotice: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 10,
  },
  lockTextWrap: {
    flex: 1,
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c2410c',
    marginBottom: 2,
  },
  lockDesc: {
    fontSize: 12,
    color: '#9a3412',
    lineHeight: 17,
  },

  // ── Terms ──
  termsSection: {
    marginTop: 4,
  },
  termsHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  termText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
  },
  shopBtn: {
    borderRadius: 12,
    height: 50,
  },
});
