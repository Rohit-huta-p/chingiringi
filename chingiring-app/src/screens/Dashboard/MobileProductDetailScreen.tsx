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
  useWindowDimensions,
} from 'react-native';
import {
  ArrowLeft, Share2, Clock, Percent, Lock, CheckCircle, Star, PencilLine,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsAPI, toUiReview } from '../../api/reviews';
import { WriteReviewModal } from '../../components/WriteReviewModal';
import { ShareSheet } from '../../components/ShareSheet';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { Button } from '../../components/Button';
import { dealsAPI } from '../../api/deals';
import { clicksAPI } from '../../api/clicks';
import { productsAPI } from '../../api/products';
import { sharesAPI } from '../../api/shares';
import { useAuthStore } from '../../store';

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
  onShare,
  reviews,
  reviewCount,
  averageRating,
  onWriteReview,
}: {
  product: any;
  onBack: () => void;
  onShare: () => void;
  reviews: any[];
  reviewCount: number;
  averageRating: number;
  onWriteReview: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const [imgIndex, setImgIndex] = React.useState(0);

  // Daily share quota — same query key the share actions invalidate.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const sharesLeft = quotaRes?.data?.remaining;
  const sharesCap = quotaRes?.data?.cap;

  const name        = product?.name ?? 'Product';
  const imageUrl    = product?.imageUrl;
  // Gallery, cover first. Falls back to the single imageUrl for products
  // created before multi-image, and to [] when there's no image at all.
  const baseGallery: string[] =
    product?.images?.length ? product.images : (imageUrl ? [imageUrl] : []);
  // A mobile-specific crop (if set) leads the gallery, mirroring the banner
  // desktop/mobile split — otherwise the normal cover-first gallery.
  const gallery: string[] = product?.mobileImageUrl
    ? [product.mobileImageUrl, ...baseGallery.filter((u) => u !== product.mobileImageUrl)]
    : baseGallery;
  const price       = Number(product?.price ?? 0);
  const sold        = Number(product?.sold ?? 0);
  const category    = String(product?.category ?? '').trim();
  const description = String(product?.description ?? '').trim();

  // Hero pages are inset by the 16px heroBox margin on each side.
  const pageW = Math.max(1, winW - 32);

  const fmtPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <View style={pStyles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero carousel with back + share ─────────────────── */}
        <View style={pStyles.heroBox}>
          {gallery.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={gallery.length > 1}
              onMomentumScrollEnd={(e) =>
                setImgIndex(Math.round(e.nativeEvent.contentOffset.x / pageW))
              }
            >
              {gallery.map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  style={{ width: pageW, height: '100%' }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={pStyles.heroPlaceholder}>
              <Text style={pStyles.heroPlaceholderLetter}>{name[0] ?? '?'}</Text>
            </View>
          )}

          <TouchableOpacity style={pStyles.backBtn} onPress={onBack}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={pStyles.shareBtn} onPress={onShare}>
            <Share2 size={18} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {gallery.length > 1 ? (
            <View style={pStyles.dots}>
              {gallery.map((_, i) => (
                <View key={i} style={[pStyles.dot, i === imgIndex && pStyles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={pStyles.body}>
          <Text style={pStyles.title} numberOfLines={2}>{name}</Text>

          {/* Rating summary (from reviews averageRating) + category chip */}
          {(averageRating > 0 && reviewCount > 0) || category ? (
            <View style={pStyles.metaRow}>
              {averageRating > 0 && reviewCount > 0 ? (
                <View style={pStyles.ratingPill}>
                  <Star size={13} color="#f59e0b" fill="#f59e0b" strokeWidth={2} />
                  <Text style={pStyles.ratingValue}>{averageRating.toFixed(1)}</Text>
                  <Text style={pStyles.ratingCount}>
                    · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              ) : null}
              {category ? (
                <View style={pStyles.categoryChip}>
                  <Text style={pStyles.categoryChipText}>{category}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Price */}
          <Text style={pStyles.price}>{fmtPrice(price)}</Text>

          {/* Social proof */}
          {sold > 0 ? (
            <View style={pStyles.availRow}>
              <Text style={pStyles.soldText}>🔥 {sold.toLocaleString('en-IN')}+ bought</Text>
            </View>
          ) : null}

          {/* About this item — renders the description product mode previously
              dropped. Hidden when the product has no description. */}
          {description ? (
            <View style={pStyles.aboutSection}>
              <Text style={pStyles.aboutHeader}>About this item</Text>
              <Text style={pStyles.aboutText}>{description}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Reviews ─────────────────────────────────────── */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.reviewsTitle}>
              Reviews <Text style={styles.reviewsCount}>({reviewCount})</Text>
            </Text>
            <TouchableOpacity style={styles.writeReviewBtn} activeOpacity={0.85} onPress={onWriteReview}>
              <PencilLine size={14} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.writeReviewText}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {reviews.length === 0 ? (
            <Text style={{ color: Colors.textSecondary, fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 }}>
              No reviews yet. Be the first to write one!
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reviewsScroll}
            >
              {reviews.map((r) => (
                <View key={r._id} style={styles.reviewCard}>
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
                  <Text style={styles.reviewBody} numberOfLines={4}>{r.body}</Text>
                  {r.daysAgo != null ? (
                    <Text style={styles.reviewMeta}>{r.daysAgo}d ago</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={pStyles.ctaBar}>
        <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={pStyles.ctaWrap}>
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={pStyles.ctaBtn}
          >
            <Text style={pStyles.ctaText}>Share &amp; Earn 100 CR</Text>
          </LinearGradient>
        </TouchableOpacity>
        {sharesLeft != null && (
          <Text style={pStyles.hint}>{sharesLeft}/{sharesCap} shares left today</Text>
        )}
      </View>
    </View>
  );
}

export const MobileProductDetailScreen = () => {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
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
    enabled: isProductMode && !!productId && productId !== 'sample',
  });
  // Prefer the complete fetched product (has affiliateUrl etc.); fall back to
  // the passed object for instant paint while the fetch is in flight.
  const productForView =
    fetchedProductResponse?.data?.product ||
    fetchedProductResponse?.data ||
    passedProduct;

  // Reviews — real data from the API (product mode only).
  const reviewProductId = productForView?._id || productId;
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { data: reviewsRes } = useQuery({
    queryKey: ['reviews', reviewProductId],
    queryFn: () => reviewsAPI.getProductReviews(reviewProductId),
    enabled: !!reviewProductId && reviewProductId !== 'sample',
  });
  const reviews = (reviewsRes?.data?.reviews ?? []).map(toUiReview);
  const reviewCount = reviewsRes?.data?.count ?? reviews.length;
  const averageRating = Number(reviewsRes?.data?.averageRating ?? 0);
  const submitReview = async (rating: number, text: string) => {
    await reviewsAPI.createReview(reviewProductId, { rating, text });
    queryClient.invalidateQueries({ queryKey: ['reviews', reviewProductId] });
    setReviewOpen(false);
  };

  if (isProductMode) {
    // Share the product — opens the custom ShareSheet. Credits 100 CR only
    // once a channel link is actually opened (see onShared below), and only
    // for real products (not the 'sample' template rows).
    const canShare = !!reviewProductId && reviewProductId !== 'sample';
    const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app'}/product/${reviewProductId}?ref=cr_${user?.id ?? ''}`;

    return (
      <>
        <ProductDetailMobile
          product={productForView}
          onBack={() => navigation.goBack()}
          onShare={() => canShare && setShareOpen(true)}
          reviews={reviews}
          reviewCount={reviewCount}
          averageRating={averageRating}
          onWriteReview={() => setReviewOpen(true)}
        />
        <WriteReviewModal
          visible={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onSubmit={submitReview}
        />
        {canShare ? (
          <ShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            title={productForView?.name || 'Product'}
            imageUrl={productForView?.productImage || productForView?.imageUrl}
            discount={productForView?.discount ? `${productForView?.discount}% off` : undefined}
            url={shareUrl}
            onShared={async () => {
              try {
                const { data } = await sharesAPI.postShare('product', reviewProductId);
                queryClient.invalidateQueries({ queryKey: ['wallet'] });
                queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
                queryClient.invalidateQueries({ queryKey: ['shareQuota'] });
                Alert.alert(
                  data.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
                  data.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
                );
              } catch { /* cap/offline — no credit */ }
            }}
          />
        ) : null}
      </>
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
    backgroundColor: '#F0F4F8',
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
  root: { flex: 1, backgroundColor: '#F0F4F8' },

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

  // Price
  price: { fontSize: 28, fontWeight: '800', color: Colors.text, marginTop: 8, marginBottom: 18 },

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

  // Share button (mirrors the back button)
  shareBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
    elevation: 3,
  },

  // Carousel dots
  dots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: { width: 18, backgroundColor: '#fff' },

  // Rating + category meta row
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14, flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fffbeb', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#fde68a',
  },
  ratingValue: { fontSize: 13, fontWeight: '800', color: '#b45309' },
  ratingCount: { fontSize: 12, fontWeight: '600', color: '#a16207' },
  categoryChip: {
    backgroundColor: '#eff6ff', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#dbeafe',
  },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Availability + social proof
  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16, flexWrap: 'wrap',
  },
  soldText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // About this item
  aboutSection: { marginTop: 18 },
  aboutHeader: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  aboutText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

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
  hint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
