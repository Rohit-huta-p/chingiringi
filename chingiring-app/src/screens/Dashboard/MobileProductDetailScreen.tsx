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
import {
  ArrowLeft, Share2, Clock, Percent, Lock, CheckCircle, Star, PencilLine,
  Minus, Plus, Truck, RefreshCcw, ShieldCheck, Award,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { Button } from '../../components/Button';
import { dealsAPI } from '../../api/deals';
import { clicksAPI } from '../../api/clicks';
import { productsAPI } from '../../api/products';

function formatExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.ceil(diff / 86_400_000);
  return days === 1 ? '1 day' : `${days} days`;
}

// ─── Reviews (hardcoded — backend reviews API not yet built) ───────────────
// Matches the 3 sample reviews in Figma 395:1104. Swap to a `reviewsAPI`
// fetch once `backend/src/modules/reviews/` ships.

interface Review {
  _id: string;
  author: string;
  initial: string;
  initialBg: string;
  rating: number;          // 1..5
  title: string;
  body: string;
  productThumb?: string;   // small product thumbnail rendered on the card
  daysAgo?: number;
}

const PLACEHOLDER_REVIEWS: Review[] = [
  {
    _id: 'r1',
    author: 'Rajiv Kumar',
    initial: 'R',
    initialBg: '#fde68a',
    rating: 5,
    title: 'Excellent sound quality!',
    body: 'These headphones are amazing! The noise cancellation works perfectly and the battery life is incredible.',
    productThumb: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120&q=70',
    daysAgo: 2,
  },
  {
    _id: 'r2',
    author: 'Priya Sharma',
    initial: 'P',
    initialBg: '#bfdbfe',
    rating: 4,
    title: 'Good but slightly heavy',
    body: "Great sound and build quality, but it's a bit heavy. Still, the comfort makes up for it. Worth the price.",
    productThumb: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=120&q=70',
    daysAgo: 5,
  },
  {
    _id: 'r3',
    author: 'Amit Patel',
    initial: 'A',
    initialBg: '#fecaca',
    rating: 5,
    title: 'Best purchase this year',
    body: 'Absolutely love these! Comfortable, great sound, perfect for daily use. I highly recommended.',
    productThumb: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&q=70',
    daysAgo: 9,
  },
];

// ─── Product mode (Figma 470:2916) ──────────────────────────────────────────
// Strict rule: only render fields actually persisted on the Product model
// (name, description, price, coinsPrice, imageUrl, stock, sold, category).
// The Figma also shows star rating, review count, old-price strikethrough,
// and a color picker. None of those exist in the schema yet → omitted here.
// When backend ships rating + variants, drop them into the gaps marked
// `// TODO(schema):` below.

function ProductDetailMobile({
  product,
  onBack,
  onShopNow,
}: {
  product: any;
  onBack: () => void;
  onShopNow: () => void;
}) {
  const [quantity, setQuantity] = React.useState(1);

  const name        = product?.name ?? 'Product';
  const description = product?.description ?? '';
  const imageUrl    = product?.imageUrl;
  const price       = Number(product?.price ?? 0);
  const coinsPrice  = Number(product?.coinsPrice ?? 0);
  const stock       = Number(product?.stock ?? 0);
  const sold        = Number(product?.sold ?? 0);

  const fmtPrice = (n: number) => `₹${(n * quantity).toLocaleString('en-IN')}`;

  return (
    <View style={pStyles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero image with back button ─────────────────────── */}
        <View style={pStyles.heroBox}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={pStyles.heroImg} resizeMode="cover" />
          ) : (
            <View style={pStyles.heroPlaceholder}>
              <Text style={pStyles.heroPlaceholderLetter}>{name[0] ?? '?'}</Text>
            </View>
          )}
          <TouchableOpacity style={pStyles.backBtn} onPress={onBack}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={pStyles.body}>
          {/* Rating row — backend has no rating field yet. Hidden until schema adds it.
              TODO(schema): show <Star/> 4.5 · 128 reviews when product.rating exists. */}

          <Text style={pStyles.title} numberOfLines={2}>{name}</Text>
          {description ? (
            <Text style={pStyles.description} numberOfLines={3}>{description}</Text>
          ) : null}

          {/* Price + quantity stepper */}
          <View style={pStyles.priceRow}>
            <Text style={pStyles.price}>{fmtPrice(price)}</Text>
            <View style={pStyles.stepper}>
              <TouchableOpacity
                style={pStyles.stepBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={14} color={Colors.text} strokeWidth={2.2} />
              </TouchableOpacity>
              <Text style={pStyles.stepQty}>{quantity}</Text>
              <TouchableOpacity
                style={pStyles.stepBtn}
                onPress={() => setQuantity((q) => Math.min(Math.max(stock, 1), q + 1))}
                disabled={stock > 0 && quantity >= stock}
              >
                <Plus
                  size={14}
                  color={stock > 0 && quantity >= stock ? '#cbd5e1' : Colors.text}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Color picker — no variants field on Product model. Hidden.
              TODO(schema): render color swatches when product.variants exists. */}

          {/* 3-card stat row: stock | sold | coins */}
          <View style={pStyles.statsRow}>
            <View style={pStyles.statCard}>
              <Text style={pStyles.statLabel}>STOCK</Text>
              <Text style={pStyles.statValue}>{stock} units</Text>
            </View>
            <View style={pStyles.statCard}>
              <Text style={pStyles.statLabel}>SOLD</Text>
              <Text style={pStyles.statValue}>{sold}+</Text>
            </View>
            <View style={pStyles.statCard}>
              <Text style={pStyles.statLabel}>COINS</Text>
              <Text style={pStyles.statValue}>{coinsPrice.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Static promise badges — no backend data needed */}
          <View style={pStyles.promiseRow}>
            <View style={pStyles.promiseItem}>
              <View style={pStyles.promiseIcon}>
                <Truck size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={pStyles.promiseLabel}>Free Delivery</Text>
            </View>
            <View style={pStyles.promiseItem}>
              <View style={pStyles.promiseIcon}>
                <RefreshCcw size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={pStyles.promiseLabel}>Easy Returns</Text>
            </View>
            <View style={pStyles.promiseItem}>
              <View style={pStyles.promiseIcon}>
                <ShieldCheck size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={pStyles.promiseLabel}>Secure Pay</Text>
            </View>
          </View>

          {/* Loyalty Reward card — derived from coinsPrice */}
          {coinsPrice > 0 ? (
            <View style={pStyles.loyaltyCard}>
              <View style={pStyles.loyaltyMedal}>
                <Award size={18} color="#b45309" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pStyles.loyaltyTitle}>Loyalty Reward</Text>
                <Text style={pStyles.loyaltyAmount}>
                  +{(coinsPrice * quantity).toLocaleString('en-IN')} coins
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={pStyles.ctaBar}>
        <TouchableOpacity activeOpacity={0.85} onPress={onShopNow} style={pStyles.ctaWrap}>
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={pStyles.ctaBtn}
          >
            <Text style={pStyles.ctaText}>Shop Now · {fmtPrice(price)}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const MobileProductDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const passedDeal    = route.params?.deal;
  const dealId        = route.params?.dealId;
  const passedProduct = route.params?.product;
  const productId     = route.params?.productId;
  const isProductMode = !!(passedProduct || productId);

  // ── Product mode (renders the Figma 470:2916 layout) ────────────────
  // Fetch by id only when the caller didn't pass the full object. Skipping
  // refetch for "sample"/template ids (HomeScreen uses these for fallback
  // rows before real data lands).
  const { data: fetchedProductResponse } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsAPI.getProduct(productId),
    enabled: isProductMode && !!productId && !passedProduct && productId !== 'sample',
  });
  const productForView =
    passedProduct ||
    fetchedProductResponse?.data?.product ||
    fetchedProductResponse?.data;

  if (isProductMode) {
    // Product "Shop Now": open the product's buy link (subid-tracked, same as
    // deals) when present; otherwise the product is display-only.
    const handleBuyProduct = async () => {
      const url = productForView?.affiliateUrl;
      if (!url) {
        Alert.alert(
          'Coming soon',
          'This product is display-only — no buy link has been added yet.',
        );
        return;
      }
      try {
        let openUrl = url;
        const pid = productForView?._id || productId;
        if (pid && pid !== 'sample') {
          try {
            const { redirectUrl } = await clicksAPI.log({ productId: pid, source: 'product_detail' });
            if (redirectUrl) openUrl = redirectUrl;
          } catch {
            /* fall through to the raw url */
          }
        }
        await Linking.openURL(openUrl);
      } catch {
        Alert.alert('Error', 'Could not open the link.');
      }
    };
    return (
      <ProductDetailMobile
        product={productForView}
        onBack={() => navigation.goBack()}
        onShopNow={handleBuyProduct}
      />
    );
  }

  // ── Deal mode (existing layout — cashback / lock period / T&C / reviews)
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
      // Subid-rewritten URL so the merchant report can attribute the sale back
      // to this user. Fall back to the raw URL if logging fails — don't break
      // the user's tap because our analytics is down.
      let openUrl = url;
      if (dealId) {
        try {
          const { redirectUrl } = await clicksAPI.log({ dealId, source: 'product_detail' });
          if (redirectUrl) openUrl = redirectUrl;
        } catch {
          /* fall through to raw url */
        }
      }
      await Linking.openURL(openUrl);
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

          {/* ── Reviews ─────────────────────────────────────── */}
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsTitle}>
                Reviews <Text style={styles.reviewsCount}>({PLACEHOLDER_REVIEWS.length})</Text>
              </Text>
              <TouchableOpacity style={styles.writeReviewBtn} activeOpacity={0.85}>
                <PencilLine size={14} color={Colors.primary} strokeWidth={2.2} />
                <Text style={styles.writeReviewText}>Write Review</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsScroll}
            >
              {PLACEHOLDER_REVIEWS.map((r) => (
                <View key={r._id} style={styles.reviewCard}>
                  {/* Header: avatar + name + stars */}
                  <View style={styles.reviewHeader}>
                    <View style={[styles.reviewAvatar, { backgroundColor: r.initialBg }]}>
                      <Text style={styles.reviewAvatarText}>{r.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewAuthor} numberOfLines={1}>{r.author}</Text>
                      <View style={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            color="#f59e0b"
                            fill={i < r.rating ? '#f59e0b' : 'transparent'}
                            strokeWidth={2}
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Title (green) */}
                  <Text style={styles.reviewTitleText}>{r.title}</Text>

                  {/* Body */}
                  <Text style={styles.reviewBody} numberOfLines={3}>{r.body}</Text>

                  {/* Footer: product thumb + days-ago */}
                  <View style={styles.reviewFooter}>
                    {r.productThumb ? (
                      <Image source={{ uri: r.productThumb }} style={styles.reviewThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.reviewThumb, { backgroundColor: '#1e293b' }]} />
                    )}
                    {r.daysAgo != null ? (
                      <Text style={styles.reviewMeta}>{r.daysAgo}d ago</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
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
    backgroundColor: '#F5F8FF',
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

  // ── Reviews ──
  reviewsSection: {
    marginTop: 22,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewsCount: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  writeReviewText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsScroll: {
    gap: 12,
    paddingRight: 4,
  },
  reviewCard: {
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 2,
  },
  reviewTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  reviewBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
    minHeight: 48,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  reviewMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
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

// ─── Product-mode styles (Figma 470:2916) ───────────────────────────────────
// Kept separate from `styles` so the deal-mode visual tweaks don't bleed in.

const pStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Hero
  heroBox: {
    margin: 16,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b',
  },
  heroPlaceholderLetter: {
    fontSize: 64, fontWeight: '800', color: 'rgba(255,255,255,0.5)',
  },
  backBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 3,
  },

  body: { paddingHorizontal: 16, paddingTop: 4 },

  title: {
    fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4, lineHeight: 28,
  },
  description: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14,
  },

  // Price + stepper
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18,
  },
  price: { fontSize: 28, fontWeight: '800', color: Colors.text },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e8edf5', borderRadius: 18, backgroundColor: '#fff',
  },
  stepBtn: {
    width: 34, height: 34, justifyContent: 'center', alignItems: 'center',
  },
  stepQty: {
    minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '700', color: Colors.text,
  },

  // Stat cards row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8edf5',
    paddingVertical: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.6, marginBottom: 6,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.text },

  // Promise badges
  promiseRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 14, marginBottom: 14,
  },
  promiseItem: { alignItems: 'center', gap: 6 },
  promiseIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 1,
  },
  promiseLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.textSecondary,
  },

  // Loyalty reward card
  loyaltyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#fde68a',
    paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 4,
  },
  loyaltyMedal: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fde68a',
    justifyContent: 'center', alignItems: 'center',
  },
  loyaltyTitle: { fontSize: 12, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  loyaltyAmount: { fontSize: 15, fontWeight: '800', color: '#92400e' },

  // Sticky CTA
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1, borderTopColor: '#e8edf5',
  },
  ctaWrap: { borderRadius: 28, overflow: 'hidden' },
  ctaBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
