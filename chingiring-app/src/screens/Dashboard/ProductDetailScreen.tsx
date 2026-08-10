import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Image, Dimensions, Alert, Platform, Share, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BadgeCheck, Lock, Coins } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsAPI, toUiReview, UiReview } from '../../api/reviews';
import { WriteReviewModal } from '../../components/WriteReviewModal';
import { ShareSheet } from '../../components/ShareSheet';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ProductShareCard } from '../../components/ProductShareCard';
import { RatingBars } from '../../components/RatingBars';
import { discountPct, savingsAmt, splitDescription } from '../../utils/product';
import { dealsAPI } from '../../api/deals';
import { productsAPI } from '../../api/products';
import { sharesAPI } from '../../api/shares';
import { useAuthStore } from '../../store';
import { cloudinaryFill } from '../../utils/cloudinary';

const SIZES = ['30', '32', '34', '36'];

// ─── Reviews ───────────────────────────────────────────────────────────────
// Real reviews come from GET /api/products/:id/reviews (src/api/reviews.ts).
// This Review shape is what ReviewCard renders; toUiReview() maps the API rows.

interface Review {
  _id: string;
  author: string;
  initial: string;
  initialBg: string;
  rating: number;
  title: string;
  body: string;
  productThumb?: string;
  daysAgo?: number;
}

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={{ fontSize: size, color: i < rating ? '#f59e0b' : '#e2e8f0', lineHeight: size + 1 }}>
          {'★'}
        </Text>
      ))}
    </View>
  );
}

function ReviewCard({ review, desktop }: { review: Review; desktop?: boolean }) {
  return (
    <View style={[reviewStyles.card, desktop && reviewStyles.cardDesktop]}>
      <View style={reviewStyles.header}>
        <View style={[reviewStyles.avatar, { backgroundColor: review.initialBg }]}>
          <Text style={reviewStyles.avatarText}>{review.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={reviewStyles.author} numberOfLines={1}>{review.author}</Text>
          <StarRow rating={review.rating} size={11} />
        </View>
      </View>
      <Text style={reviewStyles.title}>{review.title}</Text>
      <Text style={reviewStyles.body} numberOfLines={3}>{review.body}</Text>
      <View style={reviewStyles.footer}>
        {review.productThumb ? (
          <Image source={{ uri: review.productThumb }} style={reviewStyles.thumb} resizeMode="contain" />
        ) : (
          <View style={[reviewStyles.thumb, { backgroundColor: '#1e293b' }]} />
        )}
        {review.daysAgo != null ? (
          <Text style={reviewStyles.meta}>{review.daysAgo}d ago</Text>
        ) : null}
      </View>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  card: {
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8edf5',
    marginRight: 12,
  },
  cardDesktop: {
    flex: 1,
    marginRight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  author: { fontSize: 13, fontWeight: '700', color: Colors.text },
  title: { fontSize: 13, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  body: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16, marginBottom: 10, minHeight: 48 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9' },
  meta: { fontSize: 11, color: Colors.textSecondary },
});

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
  const user = useAuthStore((s) => s.user);
  const route = useRoute<any>();
  const passedDeal = route.params?.deal;
  const dealId = route.params?.dealId;
  const passedProduct = route.params?.product;
  const productId = route.params?.productId;
  const isProductMode = !!(passedProduct || productId);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  const { data: fetchedDealResponse } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDeal(dealId),
    enabled: !!dealId && !passedDeal,
  });

  // Always fetch the live product when we have a real id — even if a product
  // object was passed. The Home grid passes a stripped item (no affiliateUrl,
  // among other fields), so trusting it alone made every grid-opened product
  // look link-less. Skip only for "sample"/missing ids (template rows).
  const { data: fetchedProductResponse } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsAPI.getProduct(productId),
    enabled: !!productId && productId !== 'sample',
  });

  const deal = passedDeal || fetchedDealResponse?.data?.deal || fetchedDealResponse?.data;
  const fetchedProduct =
    fetchedProductResponse?.data?.product || fetchedProductResponse?.data;
  // Prefer the complete fetched product; fall back to the passed object so the
  // screen still paints instantly while the fetch is in flight.
  const product = fetchedProduct || passedProduct;
  const targetProductId = product?._id || productId;

  // Reviews — real data from the API (replaces the old placeholder list).
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: reviewsRes } = useQuery({
    queryKey: ['reviews', targetProductId],
    queryFn: () => reviewsAPI.getProductReviews(targetProductId),
    enabled: !!targetProductId && targetProductId !== 'sample',
  });
  const reviews: UiReview[] = (reviewsRes?.data?.reviews ?? []).map(toUiReview);
  const reviewCount = reviewsRes?.data?.count ?? reviews.length;
  const averageRating = Number(reviewsRes?.data?.averageRating ?? 0);

  // Daily share quota — same query key the share actions invalidate.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const sharesLeft = quotaRes?.data?.remaining;
  const sharesCap = quotaRes?.data?.cap;

  const submitReview = async (rating: number, text: string) => {
    await reviewsAPI.createReview(targetProductId, { rating, text });
    queryClient.invalidateQueries({ queryKey: ['reviews', targetProductId] });
    setReviewOpen(false);
  };

  // Share the current item \u2014 native share sheet; web falls back to the Web
  // Share API, then clipboard. Works for both product and deal modes. Product
  // shares carry a referral link and are credited (once per item per day) but
  // ONLY after the share sheet reports a completed share \u2014 never before.
  const handleShare = async () => {
    // Product shares MUST go through our ShareSheet (no "Copy" loophole). Every
    // product-mode trigger (CTA + the image-panel share icons) routes here.
    // handleShare below is the deal-mode / OS-sheet path only (deals never credit).
    if (isProductMode) { setShareOpen(true); return; }
    const shareTitle = isProductMode
      ? (product?.title || product?.name || 'Check out this product')
      : (deal?.title || deal?.description || 'Check out this deal');
    const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
    const pid = product?._id || productId;
    const shareUrl = isProductMode
      ? (pid && pid !== 'sample' ? `${base}/s/product/${pid}?ref=cr_${user?.id ?? ''}` : '')
      : (deal?.affiliateUrl || '');
    const message = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle;

    let shared = false;
    try {
      if (Platform.OS === 'web') {
        const nav: any = (globalThis as any).navigator;
        if (nav?.share) {
          await nav.share({ title: shareTitle, text: shareTitle, url: shareUrl || undefined });
          shared = true;
        } else if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(message);
          // Copying isn't a real share, so no credit (shared stays false).
          // Product mode gets the generic copy prompt since it won't see the
          // reward alert below; deal mode keeps its original confirmation.
          Alert.alert('Link copied', isProductMode ? 'Paste it anywhere to share.' : 'Link copied to your clipboard.');
        }
      } else {
        const result = await Share.share({ message, title: shareTitle });
        shared = result.action === Share.sharedAction;
      }
    } catch {
      shared = false; // user dismissed the share sheet, or sharing is unsupported
    }

    if (shared && isProductMode && pid && pid !== 'sample') {
      try {
        await sharesAPI.postShare('product', pid);
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
        queryClient.invalidateQueries({ queryKey: ['shareQuota'] });
        Alert.alert('Shared!', `${quotaRes?.data?.coinsPerShare ?? 50} CR pending \u2014 it unlocks when a friend opens your link.`);
      } catch {
        /* cap reached or offline \u2014 the share already happened */
      }
    }
  };

  // Product "Buy Now" \u2014 opens the product's buy/affiliate link (product mode).
  const handleBuyNow = async () => {
    const url = product?.affiliateUrl;
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Error', 'Could not open the link.'); }
  };

  // \u2500\u2500 Deal-mode bindings (used when navigation passes deal/dealId) \u2500\u2500
  const title = deal?.title || deal?.description || 'Flat 50% Off on Top Brands';
  const brand = deal?.brand || 'Myntra';
  const categoryName = deal?.category?.name || 'Fashion';
  const cashbackPercent = deal?.cashbackPercent ?? 12;
  const cashbackType = deal?.cashbackType || 'percentage';
  const flatCashback = deal?.flatCashback ?? 0;
  const expiresAt = deal?.expiresAt;
  const lockPeriodDays = deal?.lockPeriodDays ?? 45;
  const dealImageUrl = deal?.imageUrl;
  const termsAndConditions = deal?.termsAndConditions || '';
  const terms = termsAndConditions
    ? termsAndConditions.split('\n').filter(Boolean)
    : ['Max cashback 500', 'Valid only for new users', 'Cashback tracks in 48 hours'];
  const cashbackDisplay =
    cashbackType === 'flat' ? `\u20B9${flatCashback}` : `${cashbackPercent}%`;

  // \u2500\u2500 Product-mode bindings (used when navigation passes product/productId) \u2500\u2500
  // Accepts both shapes: the merged HomeScreen template item ({ title,
  // subtitle, productImage, oldPrice, coins, discount, productStock, ... })
  // and the raw API Product ({ name, description, imageUrl, price,
  // coinsPrice, stock, ... }).
  const productName = product?.title || product?.name || 'Product';
  // Single-cover fallback chain (ShareSheet + empty-gallery): desktop cover →
  // mobile cover, so a product with only mobile photos still has an image.
  const productImage = product?.productImage || product?.imageUrl || product?.mobileImageUrl;
  const productCategory = product?.category?.name || product?.category || '';
  const productPrice = product?.price ?? 0;
  const productOldPrice = product?.oldPrice ?? 0;
  const productDescription = product?.subtitle || product?.description || '';
  const productRating = product?.rating;
  const productRatingCount = product?.ratingCount;
  const productDiscount = product?.discount;
  const productSold = product?.sold ?? 0;
  const productAffiliateUrl = product?.affiliateUrl;
  const productMerchant = product?.merchant;
  const productImages: string[] = Array.isArray(product?.images) ? product.images : [];
  const productMobileImages: string[] = Array.isArray(product?.mobileImages) ? product.mobileImages : [];
  // Headline rating: admin-set product.rating/ratingCount wins; else the live
  // in-app review average. (The Reviews section still uses the real review count.)
  const headlineRating = productRating && productRating > 0 ? productRating : averageRating;
  const headlineRatingCount = productRatingCount && productRatingCount > 0 ? productRatingCount : reviewCount;

  // Price markdown — prefer the real `mrp` field; fall back to a template
  // oldPrice (HomeScreen items) so both shapes still show a strikethrough.
  const productMrp = product?.mrp ?? 0;
  const strike = productMrp > productPrice ? productMrp : (productOldPrice > productPrice ? productOldPrice : 0);
  const off = discountPct(strike, productPrice);
  const saved = savingsAmt(strike, productPrice);
  // About (prose) vs Highlights (bullets) from the single description field.
  const { about: productAbout, highlights: productHighlights } = splitDescription(productDescription);

  // Live "shared today" count (real) — social proof for the share card.
  const { data: shareStatsRes } = useQuery({
    queryKey: ['shareStats', 'product', targetProductId],
    queryFn: () => sharesAPI.getStats('product', targetProductId),
    enabled: !!targetProductId && targetProductId !== 'sample',
  });
  const sharedToday = shareStatsRes?.data?.todayCount ?? 0;

  // "You may also like" — same category, current product filtered out.
  const { data: simRes } = useQuery({
    queryKey: ['products', 'similar', productCategory],
    queryFn: () => productsAPI.getProducts({ category: productCategory, limit: 12 }),
    enabled: !!productCategory,
  });
  const similar = (simRes?.data?.products ?? [])
    .filter((p: any) => p?._id && p._id !== targetProductId)
    .slice(0, 5);

  const priceFmt = (n: number) => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

  // Image + identity used by the shared image panel. Product mode supports a
  // multi-image gallery (cover first); the thumbnail strip swaps activeImg.
  // Desktop (md+) prefers the desktop gallery; when it's empty (admin uploaded
  // only mobile photos) fall back to the mobile gallery, then any single cover —
  // mirrors the reverse fallback MobileProductDetailScreen already does.
  const productGallery: string[] = productImages.length
    ? productImages
    : productMobileImages.length
      ? productMobileImages
      : (productImage ? [productImage] : []);
  const activeProductImage = productGallery[activeImg] ?? productImage;
  const imageUrl = isProductMode ? activeProductImage : dealImageUrl;
  // Crisp, box-sized delivery (kills upscale blur; c_fill,g_auto avoids stretch).
  // Desktop box ≈ 438×476 (aspectRatio 0.92); mobile container is full-width×360.
  const heroUrl =
    cloudinaryFill(imageUrl, isDesktop ? 438 : screenWidth, isDesktop ? 476 : 360) ?? imageUrl;
  const overlayPrimary = isProductMode ? (productMerchant || productName) : brand;
  const overlaySecondary = isProductMode
    ? productCategory || 'Product'
    : categoryName;
  const overlayLabel = isProductMode ? 'Available at' : 'Shop at';

  // Thumbnail strip for the product gallery (shown only when >1 image).
  const thumbStrip =
    isProductMode && productGallery.length > 1 ? (
      <View style={styles.thumbStrip}>
        {productGallery.map((uri, i) => (
          <TouchableOpacity
            key={`${uri}-${i}`}
            style={[styles.thumbItem, i === activeImg && styles.thumbItemActive]}
            onPress={() => setActiveImg(i)}
            activeOpacity={0.8}
          >
            <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </View>
    ) : null;

  // ─── Image Panel ──────────────────────────────────────────────────────
  const imagePanel = isDesktop ? (
    <View style={styles.desktopImageCol}>
      <View style={styles.desktopImageBox}>
        {imageUrl ? (
          <Image source={{ uri: heroUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{brand[0]}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{'‹'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} activeOpacity={0.7} onPress={handleShare}>
          <Text style={styles.shareButtonText}>{'↗'}</Text>
        </TouchableOpacity>
        {off ? <View style={styles.offBadgeDesk}><Text style={styles.offBadgeDeskT}>{off}% OFF</Text></View> : null}
      </View>
      {thumbStrip}
    </View>
  ) : (
    <View style={styles.imageContainer}>
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
      <TouchableOpacity style={styles.shareButton} activeOpacity={0.7} onPress={handleShare}>
        <Text style={styles.shareButtonText}>{'\u2197'}</Text>
      </TouchableOpacity>

      {/* Brand overlay at bottom */}
      <View style={styles.brandOverlay}>
        <Text style={styles.brandOverlayLabel}>{overlayLabel}</Text>
        <Text style={styles.brandOverlayName}>{overlayPrimary}</Text>
        <Text style={styles.brandOverlayCategory}>{overlaySecondary}</Text>
      </View>
    </View>
  );

  // ─── Product Details Panel ────────────────────────────────────────────
  const productDetailsPanel = (
    <ScrollView
      style={[styles.detailsScroll, isDesktop && styles.detailsScrollDesktop]}
      contentContainerStyle={styles.detailsContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Breadcrumb */}
      <View style={styles.crumb}>
        <Text style={styles.crumbItem}>Home</Text>
        {productCategory ? (
          <>
            <Text style={styles.crumbSep}>{'›'}</Text>
            <Text style={styles.crumbItem}>{productCategory}</Text>
          </>
        ) : null}
        <Text style={styles.crumbSep}>{'›'}</Text>
        <Text style={styles.crumbCur} numberOfLines={1}>{productName}</Text>
      </View>

      {/* Title */}
      <Text style={styles.productTitle}>{productName}</Text>

      {/* Rating (real, from reviews) + sold social proof */}
      {(headlineRating > 0 && headlineRatingCount > 0) || productSold > 0 ? (
        <View style={styles.metaRow}>
          {headlineRating > 0 && headlineRatingCount > 0 ? (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingStar}>{'★'}</Text>
              <Text style={styles.ratingValue}>{headlineRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>
                · {headlineRatingCount.toLocaleString('en-IN')} {headlineRatingCount === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          ) : null}
          {productSold > 0 ? (
            <Text style={styles.soldText}>🔥 {productSold.toLocaleString('en-IN')}+ bought</Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Buy card (purchase-first) ─────────────── */}
      <Card style={styles.buyCard}>
        <View>
          <View style={styles.buyPriceRow}>
            <Text style={styles.buyPrice}>{priceFmt(productPrice)}</Text>
            {strike > productPrice ? (
              <Text style={styles.buyOldPrice}>{priceFmt(strike)}</Text>
            ) : null}
            {off ? <Text style={styles.buyOff}>{off}% off</Text> : null}
          </View>
          {saved ? <Text style={styles.buySave}>You save {priceFmt(saved)}</Text> : null}
          <Text style={styles.buyTax}>Inclusive of all taxes</Text>
        </View>

        {/* Buy Now is primary; Share is the secondary. No buy link → Share
            becomes the primary full-width action. */}
        {productAffiliateUrl ? (
          <Button title="Buy Now →" onPress={handleBuyNow} style={styles.buyBtnMain} />
        ) : (
          <Button
            title="Share & Earn 100 CR ↗"
            onPress={() => setShareOpen(true)}
            style={styles.buyBtnMain}
          />
        )}
      </Card>

      {/* Merchant trust card */}
      {productMerchant ? (
        <View style={styles.mcard}>
          <View style={styles.mlogo}><Text style={styles.mlogoT}>{productMerchant.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.m1}>Sold by {productMerchant}</Text>
            <Text style={styles.m2}>Secure checkout — you complete the purchase on {productMerchant}.</Text>
          </View>
        </View>
      ) : null}

      {/* Share card — the signature Chingiringi block */}
      <View style={{ marginBottom: 12 }}>
        <ProductShareCard
          sharedToday={sharedToday}
          sharesLeft={sharesLeft}
          sharesCap={sharesCap}
          onShare={() => setShareOpen(true)}
        />
      </View>

      {/* Trust badges */}
      <View style={styles.trust3}>
        <View style={styles.tb}><BadgeCheck size={18} color="#10b981" strokeWidth={2.2} /><Text style={styles.tbLb}>Verified merchant</Text></View>
        <View style={styles.tb}><Lock size={17} color={Colors.primary} strokeWidth={2.2} /><Text style={styles.tbLb}>Secure checkout</Text></View>
        <View style={styles.tb}><Coins size={17} color="#d98a12" strokeWidth={2.2} /><Text style={styles.tbLb}>Earn on every share</Text></View>
      </View>

      {/* Highlights — bullets parsed from a line-separated description */}
      {productHighlights.length ? (
        <Card style={styles.card}>
          <Text style={styles.hlH}>Highlights</Text>
          {productHighlights.map((h, i) => (
            <View key={i} style={styles.hlRow}>
              <Text style={styles.hlTick}>{'✓'}</Text>
              <Text style={styles.hlT}>{h}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* About this item (prose) */}
      {productAbout ? (
        <Card style={styles.card}>
          <View style={styles.termsHeader}>
            <View style={styles.termsIconCircle}>
              <Text style={styles.termsIconText}>i</Text>
            </View>
            <Text style={styles.termsTitle}>About this item</Text>
          </View>
          <Text style={[styles.termText, { marginLeft: 0 }]}>
            {productAbout}
          </Text>
        </Card>
      ) : null}
      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={productName}
        imageUrl={productImage}
        discount={productDiscount ? `${productDiscount}% off` : undefined}
        url={`${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/product/${targetProductId}?ref=cr_${user?.id ?? ''}`}
        onShared={async () => {
          if (!targetProductId || targetProductId === 'sample') return;
          try {
            await sharesAPI.postShare('product', targetProductId);
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
            queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
            queryClient.invalidateQueries({ queryKey: ['shareQuota'] });
            Alert.alert('Shared!', `${quotaRes?.data?.coinsPerShare ?? 50} CR pending — it unlocks when a friend opens your link.`);
          } catch { /* cap/offline — no credit */ }
        }}
      />
    </ScrollView>
  );

  // ─── Reviews block (rendered inside details on mobile; full-width below
  //     the row on desktop — matches Figma 395:1104 layout) ─────────────
  const reviewsBlock = (
    <View style={[styles.reviewsSection, isDesktop && styles.reviewsSectionDesktop]}>
      <View style={styles.reviewsHeader}>
        <Text style={styles.reviewsTitle}>
          Reviews <Text style={styles.reviewsCount}>({reviewCount})</Text>
        </Text>
        <TouchableOpacity style={styles.writeReviewBtn} activeOpacity={0.85} onPress={() => setReviewOpen(true)}>
          <Text style={styles.writeReviewText}>{'✎'}  Write Review</Text>
        </TouchableOpacity>
      </View>

      {reviews.length >= 3 ? (
        <View style={styles.reviewSummary}>
          <View style={styles.reviewScore}>
            <Text style={styles.reviewScoreN}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.reviewScoreStar}>{'★★★★★'}</Text>
            <Text style={styles.reviewScoreC}>{reviewCount.toLocaleString('en-IN')} reviews</Text>
          </View>
          <View style={styles.reviewBarsWrap}>
            <RatingBars reviews={reviews} />
            <Text style={styles.reviewNote}>from {reviews.length} app {reviews.length === 1 ? 'review' : 'reviews'}</Text>
          </View>
        </View>
      ) : null}

      {isDesktop ? (
        <View style={styles.reviewsGrid}>
          {reviews.map((r) => (
            <ReviewCard key={r._id} review={r} desktop />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reviewsScroll}
        >
          {reviews.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
        </ScrollView>
      )}

      <WriteReviewModal
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={submitReview}
      />
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
        {terms.map((term: string, index: number) => (
          <View key={index} style={styles.termRow}>
            <View style={styles.termCheckCircle}>
              <Text style={styles.termCheckText}>{'\u2713'}</Text>
            </View>
            <Text style={styles.termText}>{term}</Text>
          </View>
        ))}
      </Card>

      {/* CTA \u2014 share is the primary action here now (Buy CTA removed). */}
      <Button
        title="Share This Deal \u2197"
        onPress={handleShare}
        style={styles.ctaButton}
      />
      <Text style={styles.helperText}>
        Share with friends to spread the word
      </Text>

      {/* Reviews \u2014 render inline only on mobile. Desktop puts the block
          full-width BELOW both columns (see desktop layout return). */}
      {!isDesktop ? reviewsBlock : null}

    </ScrollView>
  );

  // Pick the panel for the current navigation mode. Product mode renders
  // price + description + share/buy CTAs; deal mode keeps cashback/lock/terms.
  const activePanel = isProductMode ? productDetailsPanel : detailsPanel;

  // ─── Layout ───────────────────────────────────────────────────────────
  // Desktop (Figma 395:1104): image + details side-by-side at top, then a
  // full-width Reviews section below. The whole page scrolls as one unit
  // (outer ScrollView) so the reviews stay attached to the bottom edge of
  // the detail content rather than living inside the column's scroll.
  if (isDesktop) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.desktopScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.desktopRow}>
          {imagePanel}
          {activePanel}
        </View>
        {/* Reviews always rendered full-width below on desktop — matches
            Figma 395:1104. Same placeholder data drives deal + product modes. */}
        <View style={styles.desktopReviewsWrap}>{reviewsBlock}</View>
        {isProductMode && similar.length ? (
          <View style={styles.simWrap}>
            <Text style={styles.simTitle}>You may also like</Text>
            <View style={styles.simGrid}>
              {similar.map((p: any) => (
                <TouchableOpacity
                  key={p._id}
                  activeOpacity={0.85}
                  style={styles.simCard}
                  onPress={() => (navigation as any).navigate('ProductDetail', { productId: p._id, product: p })}
                >
                  <View style={styles.simImg}>
                    {p.imageUrl || p.mobileImageUrl ? (
                      <Image source={{ uri: p.imageUrl || p.mobileImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 30 }}>🛍️</Text>
                    )}
                  </View>
                  <View style={styles.simBody}>
                    <Text style={styles.simName} numberOfLines={2}>{p.name}</Text>
                    {p.description ? <Text style={styles.simDesc} numberOfLines={2}>{p.description}</Text> : null}
                    <View style={styles.simPriceRow}>
                      <Text style={styles.simPrice}>{priceFmt(Number(p.price) || 0)}</Text>
                      {Number(p.mrp) > (Number(p.price) || 0) ? <Text style={styles.simWas}>{priceFmt(Number(p.mrp))}</Text> : null}
                      {discountPct(Number(p.mrp), Number(p.price)) ? <Text style={styles.simOff}>{discountPct(Number(p.mrp), Number(p.price))}% off</Text> : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // Mobile: stacked layout
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.mobileScrollContent}>
      {imagePanel}
      <View style={styles.mobileDetails}>{activePanel}</View>
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
    backgroundColor: '#F0F4F8',
  },
  // New desktop wrapper: vertical scroll, row at top, reviews below.
  desktopScrollContent: {
    backgroundColor: '#F0F4F8',
  },
  desktopRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F8',
    alignItems: 'flex-start', // image col is fixed-height; let details col size naturally
  },
  desktopReviewsWrap: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    backgroundColor: '#F0F4F8',
  },

  // ─── Desktop image col (Figma 395:1104) ─────────────────────────────
  // Image is fixed-height (NOT column-filling). Brand info sits in its own
  // white card BELOW the image.
  desktopImageCol: {
    width: 480,
    padding: 28,
    paddingRight: 14,
    gap: 14,
    backgroundColor: '#F0F4F8',
  },
  desktopImageBox: {
    width: '100%',
    aspectRatio: 0.92, // ~Figma proportions, scales with column width — no forced upscale
    borderRadius: 18,
    backgroundColor: '#e8ecf0',
    overflow: 'hidden',
    position: 'relative',
  },
  desktopBrandCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e8edf5',
  },
  desktopBrandLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  desktopBrandName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  desktopBrandCategory: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    // Better browser-side scaling for product images that aren't native-res.
    // No-op on native; honoured by react-native-web → <img style="image-rendering:...">.
    ...(Platform.OS === 'web'
      ? ({ imageRendering: 'high-quality', WebkitImageRendering: 'high-quality' } as any)
      : {}),
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

  // ─── Gallery thumbnails ─────────────────────────────────────────────
  thumbStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbItem: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#e8ecf0',
  },
  thumbItemActive: {
    borderColor: Colors.primary,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },

  // ─── Rating + sold meta row ─────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: { fontSize: 13, color: '#f59e0b' },
  ratingValue: { fontSize: 13, fontWeight: '800', color: '#b45309' },
  ratingCount: { fontSize: 12, fontWeight: '600', color: '#a16207' },
  soldText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // ─── Details Panel ──────────────────────────────────────────────────
  detailsScroll: {
    flex: 1,
  },
  detailsScrollDesktop: {
    flex: 1,
    backgroundColor: '#F0F4F8',
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
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  ctaBtnFlex: {
    flex: 1,
    borderRadius: 14,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Buy card (Direction A) ─────────────────────────────────────────
  buyCard: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  buyPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  buyPrice: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  buyOldPrice: {
    fontSize: 16,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  buyTax: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  trustRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trustPill: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    borderWidth: 1,
    borderColor: '#e8ecf2',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  trustN: { fontSize: 13, fontWeight: '800', color: Colors.text },
  trustNGold: { color: '#d98a12' },
  trustS: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  buyBtnMain: { borderRadius: 12 },
  buyBtnAlt: { borderRadius: 12 },
  buyHelper: { fontSize: 11.5, color: Colors.textSecondary, textAlign: 'center' },
  buyOff: { fontSize: 14, fontWeight: '800', color: '#ef4444' },
  buySave: { fontSize: 13, fontWeight: '700', color: '#10b981', marginTop: 4 },

  // ─── Breadcrumb ─────────────────────────────────────────────────────
  crumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  crumbItem: { fontSize: 12.5, color: Colors.textSecondary, fontWeight: '600' },
  crumbSep: { fontSize: 12.5, color: '#cbd5e1' },
  crumbCur: { fontSize: 12.5, color: Colors.text, fontWeight: '700', flexShrink: 1 },

  // ─── Image off-badge ────────────────────────────────────────────────
  offBadgeDesk: { position: 'absolute', top: 20, left: 72, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  offBadgeDeskT: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },

  // ─── Merchant trust card ────────────────────────────────────────────
  mcard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 14, padding: 14, marginBottom: 12 },
  mlogo: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#232f3e', alignItems: 'center', justifyContent: 'center' },
  mlogoT: { color: '#ff9900', fontWeight: '800', fontSize: 17 },
  m1: { fontSize: 13.5, fontWeight: '800', color: Colors.text },
  m2: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },

  // ─── Trust badges ───────────────────────────────────────────────────
  trust3: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tb: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 11, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  tbIc: { fontSize: 15 },
  tbLb: { fontSize: 10.5, fontWeight: '700', color: Colors.text, marginTop: 3, textAlign: 'center', lineHeight: 13 },

  // ─── Highlights ─────────────────────────────────────────────────────
  hlH: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  hlRow: { flexDirection: 'row', gap: 9, marginBottom: 8, alignItems: 'flex-start' },
  hlTick: { color: Colors.primary, fontWeight: '800', fontSize: 13, lineHeight: 19 },
  hlT: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  // ─── Review summary + bars ──────────────────────────────────────────
  reviewSummary: { flexDirection: 'row', gap: 24, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' },
  reviewScore: { alignItems: 'center', minWidth: 90 },
  reviewScoreN: { fontSize: 42, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, lineHeight: 46 },
  reviewScoreStar: { color: '#f59e0b', fontSize: 14, letterSpacing: 1 },
  reviewScoreC: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reviewBarsWrap: { flex: 1, minWidth: 240, maxWidth: 380 },
  reviewNote: { fontSize: 11, color: Colors.textSecondary, marginTop: 6 },

  // ─── You may also like ──────────────────────────────────────────────
  simWrap: { paddingHorizontal: 28, paddingBottom: 44, backgroundColor: '#F0F4F8' },
  simTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 14 },
  simGrid: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  simCard: { width: 180, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf5', borderRadius: 14, overflow: 'hidden' },
  simImg: { width: '100%', height: 150, backgroundColor: '#e8ecf0', alignItems: 'center', justifyContent: 'center' },
  simBody: { padding: 12 },
  simName: { fontSize: 13, fontWeight: '700', color: Colors.text, lineHeight: 17, minHeight: 34 },
  simDesc: { fontSize: 11.5, color: Colors.textSecondary, lineHeight: 15, marginTop: 4, minHeight: 30 },
  simPriceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  simPrice: { fontSize: 15, fontWeight: '800', color: Colors.text },
  simWas: { fontSize: 11.5, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  simOff: { fontSize: 11, fontWeight: '800', color: '#ef4444' },

  // ─── Reviews ────────────────────────────────────────────────────────
  reviewsSection: {
    marginTop: 28,
  },
  reviewsSectionDesktop: {
    marginTop: 12,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewsCount: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  writeReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    paddingRight: 4,
  },
  reviewsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
});
