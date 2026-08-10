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
import { ProductShareCard } from '../../components/ProductShareCard';
import { RatingBars } from '../../components/RatingBars';
import { discountPct, savingsAmt, splitDescription } from '../../utils/product';
import { dealsAPI } from '../../api/deals';
import { clicksAPI } from '../../api/clicks';
import { productsAPI } from '../../api/products';
import { sharesAPI } from '../../api/shares';
import { useAuthStore } from '../../store';
import { cloudinaryFill } from '../../utils/cloudinary';

// Mobile hero is a fixed 4:3 shape that scales with width (not a pinned height),
// so a 4:3 upload fills it with no crop at any mobile width. Used to size the fetch.
const HERO_ASPECT = 4 / 3;

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
  onBuy,
  canBuy,
  reviews,
  reviewCount,
  averageRating,
  onWriteReview,
  onOpenProduct,
}: {
  product: any;
  onBack: () => void;
  onShare: () => void;
  onBuy: () => void;
  canBuy: boolean;
  reviews: any[];
  reviewCount: number;
  averageRating: number;
  onWriteReview: () => void;
  onOpenProduct: (p: any) => void;
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
  // Mobile-specific photos lead (cover first), then the desktop gallery for
  // extra swipes (deduped). Back-compat: an old single mobileImageUrl seeds it.
  const mobilePhotos: string[] = product?.mobileImages?.length
    ? product.mobileImages
    : (product?.mobileImageUrl ? [product.mobileImageUrl] : []);
  const gallery: string[] = mobilePhotos.length
    ? [...mobilePhotos, ...baseGallery.filter((u) => !mobilePhotos.includes(u))]
    : baseGallery;
  const price       = Number(product?.price ?? 0);
  const sold        = Number(product?.sold ?? 0);
  const category    = String(product?.category ?? '').trim();
  const description = String(product?.description ?? '').trim();
  const merchant    = String(product?.merchant ?? '').trim();
  const pRating     = Number(product?.rating ?? 0);
  const pRatingCount = Number(product?.ratingCount ?? 0);
  // Admin-set rating wins; else the live in-app review average.
  const headlineRating = pRating > 0 ? pRating : averageRating;
  const headlineCount  = pRatingCount > 0 ? pRatingCount : reviewCount;

  // Price markdown (real only when admin set an MRP above price).
  const mrp   = Number(product?.mrp ?? 0);
  const off   = discountPct(mrp, price);
  const saved = savingsAmt(mrp, price);
  // About (prose) vs Highlights (bullets) from the single description field.
  const { about, highlights } = splitDescription(description);

  // Live "shared today" count (real) — drives the share card's social proof.
  const { data: statsRes } = useQuery({
    queryKey: ['shareStats', 'product', product?._id],
    queryFn: () => sharesAPI.getStats('product', product._id),
    enabled: !!product?._id && product._id !== 'sample',
  });
  const sharedToday = statsRes?.data?.todayCount ?? 0;

  // "You may also like" — same category, current product filtered out.
  const { data: simRes } = useQuery({
    queryKey: ['products', 'similar', category],
    queryFn: () => productsAPI.getProducts({ category, limit: 12 }),
    enabled: !!category,
  });
  const similar = (simRes?.data?.products ?? [])
    .filter((p: any) => p?._id && p._id !== product?._id)
    .slice(0, 8);

  // Hero pages are inset by the 16px heroBox margin on each side.
  const pageW = Math.max(1, winW - 32);
  const heroH = Math.round(pageW / HERO_ASPECT); // 4:3 box height, scales with width

  const fmtPrice = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <View style={pStyles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero carousel with back + share ─────────────────── */}
        <View style={[pStyles.heroBox, { height: heroH }]}>
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
                  source={{ uri: cloudinaryFill(uri, pageW, heroH) ?? uri }}
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

          {off ? (
            <View style={pStyles.offBadge}><Text style={pStyles.offBadgeT}>{off}% OFF</Text></View>
          ) : null}

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

          {/* Rating summary (from reviews averageRating) */}
          {headlineRating > 0 && headlineCount > 0 ? (
            <View style={pStyles.metaRow}>
              <View style={pStyles.ratingPill}>
                <Star size={13} color="#f59e0b" fill="#f59e0b" strokeWidth={2} />
                <Text style={pStyles.ratingValue}>{headlineRating.toFixed(1)}</Text>
                <Text style={pStyles.ratingCount}>
                  · {headlineCount.toLocaleString('en-IN')} {headlineCount === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Price + savings (savings only render when a real MRP was set) */}
          <View style={pStyles.priceRow}>
            <Text style={pStyles.price}>{fmtPrice(price)}</Text>
            {mrp > price ? <Text style={pStyles.was}>{fmtPrice(mrp)}</Text> : null}
            {off ? <Text style={pStyles.offInline}>{off}% off</Text> : null}
          </View>
          {saved ? <Text style={pStyles.save}>You save {fmtPrice(saved)}</Text> : null}

          {/* Merchant trust card */}
          {merchant ? (
            <View style={pStyles.mcard}>
              <View style={pStyles.mlogo}><Text style={pStyles.mlogoT}>{merchant.slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={pStyles.m1}>Sold by {merchant}</Text>
                <Text style={pStyles.m2}>Secure checkout — you complete the purchase on {merchant}.</Text>
              </View>
            </View>
          ) : null}

          {/* Share card — the signature Chingiringi block */}
          <View style={{ marginBottom: 14 }}>
            <ProductShareCard
              sharedToday={sharedToday}
              sharesLeft={sharesLeft}
              sharesCap={sharesCap}
              onShare={onShare}
            />
          </View>

          {/* Highlights — bullets parsed from a line-separated description */}
          {highlights.length ? (
            <View style={pStyles.hl}>
              <Text style={pStyles.hlH}>Highlights</Text>
              {highlights.map((h, i) => (
                <View key={i} style={pStyles.hlRow}>
                  <Text style={pStyles.hlTick}>✓</Text>
                  <Text style={pStyles.hlT}>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* About this item (prose) — shown when the description is a paragraph */}
          {about ? (
            <View style={pStyles.aboutSection}>
              <Text style={pStyles.aboutHeader}>About this item</Text>
              <Text style={pStyles.aboutText}>{about}</Text>
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

          {reviews.length >= 3 ? (
            <View style={pStyles.reviewSummary}>
              <View style={pStyles.reviewScore}>
                <Text style={pStyles.reviewScoreN}>{averageRating.toFixed(1)}</Text>
                <Text style={pStyles.reviewScoreStar}>★★★★★</Text>
              </View>
              <View style={{ flex: 1 }}>
                <RatingBars reviews={reviews} />
                <Text style={pStyles.reviewSummaryNote}>from {reviews.length} app {reviews.length === 1 ? 'review' : 'reviews'}</Text>
              </View>
            </View>
          ) : null}

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

        {/* You may also like — same category, current product filtered out */}
        {similar.length ? (
          <View style={pStyles.simSection}>
            <Text style={pStyles.simTitle}>You may also like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pStyles.simScroll}>
              {similar.map((p: any) => (
                <TouchableOpacity key={p._id} activeOpacity={0.85} style={pStyles.simCard} onPress={() => onOpenProduct(p)}>
                  <View style={pStyles.simImg}>
                    {p.mobileImageUrl || p.imageUrl ? (
                      <Image source={{ uri: p.mobileImageUrl || p.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 26 }}>🛍️</Text>
                    )}
                  </View>
                  <View style={pStyles.simBody}>
                    <Text style={pStyles.simName} numberOfLines={2}>{p.name}</Text>
                    {p.description ? <Text style={pStyles.simDesc} numberOfLines={2}>{p.description}</Text> : null}
                    <View style={pStyles.simPriceRow}>
                      <Text style={pStyles.simPrice}>{fmtPrice(Number(p.price) || 0)}</Text>
                      {Number(p.mrp) > (Number(p.price) || 0) ? <Text style={pStyles.simWas}>{fmtPrice(Number(p.mrp))}</Text> : null}
                      {discountPct(Number(p.mrp), Number(p.price)) ? <Text style={pStyles.simOff}>{discountPct(Number(p.mrp), Number(p.price))}% off</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom CTA — Buy Now primary; Share secondary (Direction A) */}
      <View style={pStyles.ctaBar}>
        <View style={pStyles.ctaRow}>
          {canBuy ? (
            <>
              <TouchableOpacity activeOpacity={0.85} onPress={onBuy} style={[pStyles.ctaWrap, { flex: 1 }]}>
                <LinearGradient
                  colors={Gradient.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={pStyles.ctaBtn}
                >
                  <Text style={pStyles.ctaText}>Buy Now →</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={pStyles.buyBtn}>
                <Text style={pStyles.buyBtnText}>Share</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity activeOpacity={0.85} onPress={onShare} style={[pStyles.ctaWrap, { flex: 1 }]}>
              <LinearGradient
                colors={Gradient.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={pStyles.ctaBtn}
              >
                <Text style={pStyles.ctaText}>Share &amp; Earn 100 CR</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
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
    const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/product/${reviewProductId}?ref=cr_${user?.id ?? ''}`;
    // Same query key ProductDetailMobile's badge and the invalidate calls below use.
    const { data: shareQuotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
    // Buy Now — opens the product's buy/affiliate link (only shown when set).
    const buyUrl: string | undefined = productForView?.affiliateUrl;
    const handleBuy = async () => {
      if (!buyUrl) return;
      try { await Linking.openURL(buyUrl); }
      catch { Alert.alert('Error', 'Could not open the link.'); }
    };

    return (
      <>
        <ProductDetailMobile
          product={productForView}
          onBack={() => navigation.goBack()}
          onShare={() => canShare && setShareOpen(true)}
          onBuy={handleBuy}
          canBuy={!!buyUrl}
          reviews={reviews}
          reviewCount={reviewCount}
          averageRating={averageRating}
          onWriteReview={() => setReviewOpen(true)}
          onOpenProduct={(p) => (navigation as any).navigate('ProductDetail', { productId: p._id, product: p })}
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
                await sharesAPI.postShare('product', reviewProductId);
                queryClient.invalidateQueries({ queryKey: ['wallet'] });
                queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
                queryClient.invalidateQueries({ queryKey: ['shareQuota'] });
                Alert.alert('Shared!', `${shareQuotaRes?.data?.coinsPerShare ?? 50} CR pending — it unlocks when a friend opens your link.`);
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
    // height applied inline (pageW / HERO_ASPECT) so the 4:3 hero scales with
    // width instead of a pinned pixel height.
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
  price: { fontSize: 28, fontWeight: '800', color: Colors.text },

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
  },
  ratingValue: { fontSize: 13, fontWeight: '800', color: '#b45309' },
  ratingCount: { fontSize: 12, fontWeight: '600', color: '#a16207' },
  categoryChip: {
    backgroundColor: '#eff6ff', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#dbeafe',
  },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  merchantChip: {
    backgroundColor: '#f1f5f9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  merchantChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  // Availability + social proof
  availRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16, flexWrap: 'wrap',
  },
  soldText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // Trust row (Direction A)
  trustRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  trustPill: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
  },
  trustN: { fontSize: 14, fontWeight: '800', color: Colors.text },
  trustNGold: { color: '#d98a12' },
  trustS: { fontSize: 10.5, color: Colors.textSecondary, marginTop: 1 },

  // About this item
  aboutSection: { marginTop: 4, marginBottom: 4 },
  aboutHeader: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  aboutText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  // Hero off-badge
  offBadge: { position: 'absolute', bottom: 12, left: 12, backgroundColor: '#ef4444', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  offBadgeT: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  // Price row + savings
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  was: { fontSize: 15, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  offInline: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
  save: { fontSize: 13, fontWeight: '700', color: '#10b981', marginBottom: 14 },

  // Merchant trust card
  mcard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 14, padding: 12, marginBottom: 14 },
  mlogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#232f3e', alignItems: 'center', justifyContent: 'center' },
  mlogoT: { color: '#ff9900', fontWeight: '800', fontSize: 16 },
  m1: { fontSize: 13, fontWeight: '800', color: Colors.text },
  m2: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },

  // Highlights
  hl: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 14, padding: 14, marginBottom: 14 },
  hlH: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  hlRow: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  hlTick: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  hlT: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Review summary + bars
  reviewSummary: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  reviewScore: { alignItems: 'center', minWidth: 54 },
  reviewScoreN: { fontSize: 32, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  reviewScoreStar: { color: '#f59e0b', fontSize: 10, letterSpacing: 1 },
  reviewSummaryNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 6 },

  // You may also like
  simSection: { marginTop: 22 },
  simTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12, paddingHorizontal: 16 },
  simScroll: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  simCard: { width: 160, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 12, overflow: 'hidden' },
  simImg: { width: '100%', height: 120, backgroundColor: '#e8ecf0', alignItems: 'center', justifyContent: 'center' },
  simBody: { padding: 10 },
  simName: { fontSize: 12, fontWeight: '700', color: Colors.text, lineHeight: 16, minHeight: 32 },
  simDesc: { fontSize: 11, color: Colors.textSecondary, lineHeight: 14, marginTop: 3, minHeight: 28 },
  simPriceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  simPrice: { fontSize: 13, fontWeight: '800', color: Colors.text },
  simWas: { fontSize: 11, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  simOff: { fontSize: 10.5, fontWeight: '800', color: '#ef4444' },

  // Sticky CTA
  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopWidth: 1, borderTopColor: '#e8edf5',
  },
  ctaRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  ctaWrap: { borderRadius: 28, overflow: 'hidden' },
  ctaBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  buyBtn: {
    borderRadius: 28, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buyBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  hint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
