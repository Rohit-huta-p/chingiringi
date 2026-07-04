import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Image, Dimensions, Linking, Alert, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { dealsAPI } from '../../api/deals';
import { productsAPI } from '../../api/products';
import { clicksAPI } from '../../api/clicks';

const SIZES = ['30', '32', '34', '36'];

// ─── Reviews (placeholder — backend reviews API not yet built) ─────────────
// Mirrors PLACEHOLDER_REVIEWS in MobileProductDetailScreen so both surfaces
// show the same sample data until `backend/src/modules/reviews/` ships.

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

const PLACEHOLDER_REVIEWS: Review[] = [
  {
    _id: 'r1',
    author: 'Rajiv Kumar',
    initial: 'R',
    initialBg: '#fde68a',
    rating: 5,
    title: 'Excellent sound quality!',
    body: 'These headphones are amazing! The noise cancellation works perfectly and the battery life is incredible.',
    productThumb: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=160&q=70',
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
    productThumb: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=160&q=70',
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
    productThumb: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&q=70',
    daysAgo: 9,
  },
];

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
  const route = useRoute<any>();
  const passedDeal = route.params?.deal;
  const dealId = route.params?.dealId;
  const passedProduct = route.params?.product;
  const productId = route.params?.productId;
  const isProductMode = !!(passedProduct || productId);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const { data: fetchedDealResponse } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDeal(dealId),
    enabled: !!dealId && !passedDeal,
  });

  // In product mode, fetch the live product when we only got an id.
  // Skip for "sample"/missing ids — those came from template fallback rows
  // (no real DB entry), so we just render the passed product object.
  const { data: fetchedProductResponse } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsAPI.getProduct(productId),
    enabled: !!productId && !passedProduct && productId !== 'sample',
  });

  const deal = passedDeal || fetchedDealResponse?.data?.deal || fetchedDealResponse?.data;
  const product =
    passedProduct ||
    fetchedProductResponse?.data?.product ||
    fetchedProductResponse?.data;

  const handleShopNow = async () => {
    const url = deal?.affiliateUrl;
    if (!url) return;
    try {
      // Subid-rewritten URL so the merchant report can attribute the sale back
      // to this user. Falls back to raw URL if click logging fails.
      let openUrl = url;
      if (dealId) {
        try {
          const { redirectUrl } = await clicksAPI.log({ dealId, source: 'product_detail_web' });
          if (redirectUrl) openUrl = redirectUrl;
        } catch {
          /* fall through */
        }
      }
      await Linking.openURL(openUrl);
    } catch {
      Alert.alert('Error', 'Could not open the link. Please try again.');
    }
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
  const productImage = product?.productImage || product?.imageUrl;
  const productCategory = product?.category?.name || product?.category || '';
  const productPrice = product?.price ?? 0;
  const productOldPrice = product?.oldPrice ?? 0;
  const productCoins = product?.coins ?? product?.coinsPrice ?? 0;
  const productStock = product?.productStock ?? product?.stock;
  const productDescription = product?.subtitle || product?.description || '';
  const productRating = product?.rating;
  const productRatingCount = product?.ratingCount;
  const productDiscount = product?.discount;
  const stockLabel =
    productStock == null
      ? 'In stock'
      : productStock === 0
        ? 'Out of stock'
        : productStock <= 15
          ? `Only ${productStock} left`
          : 'In stock';

  const priceFmt = (n: number) => `\u20B9${(n || 0).toLocaleString('en-IN')}`;

  // Image + identity used by the shared image panel.
  const imageUrl = isProductMode ? productImage : dealImageUrl;
  const overlayPrimary = isProductMode ? productName : brand;
  const overlaySecondary = isProductMode
    ? productCategory || 'Product'
    : categoryName;
  const overlayLabel = isProductMode ? 'Available at' : 'Shop at';

  // ─── Image Panel ──────────────────────────────────────────────────────
  const imagePanel = isDesktop ? (
    <View style={styles.desktopImageCol}>
      <View style={styles.desktopImageBox}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
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
        <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
          <Text style={styles.shareButtonText}>{'↗'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.desktopBrandCard}>
        <Text style={styles.desktopBrandLabel}>{overlayLabel}</Text>
        <Text style={styles.desktopBrandName}>{overlayPrimary}</Text>
        <Text style={styles.desktopBrandCategory}>{overlaySecondary}</Text>
      </View>
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
      <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
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
      {/* Tags: Category + Stock status */}
      <View style={styles.tagsRow}>
        {productCategory ? (
          <View style={[styles.tagPill, styles.tagBlue]}>
            <Text style={[styles.tagText, styles.tagBlueText]}>
              {'◇'} {productCategory}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.tagPill,
            productStock === 0 ? styles.tagOrange : styles.tagBlue,
          ]}
        >
          <Text
            style={[
              styles.tagText,
              productStock === 0 ? styles.tagOrangeText : styles.tagBlueText,
            ]}
          >
            {'◇'} {stockLabel}
          </Text>
        </View>
      </View>

      {/* Title + description */}
      <Text style={styles.productTitle}>{productName}</Text>
      {productDescription ? (
        <Text style={styles.productSubtitle}>{productDescription}</Text>
      ) : null}

      {/* Stat cards: Price (with old price) + Coins reward */}
      <View style={styles.statCardsRow}>
        <Card style={styles.statCard}>
          <View style={styles.statHeaderRow}>
            <View style={styles.statIconCircle}>
              <Text style={styles.statIconText}>{'₹'}</Text>
            </View>
            <Text style={styles.statLabel}>PRICE</Text>
          </View>
          <Text style={styles.statValue}>{priceFmt(productPrice)}</Text>
          {productOldPrice > 0 && productOldPrice > productPrice ? (
            <Text style={[styles.statSub, { textDecorationLine: 'line-through' }]}>
              {priceFmt(productOldPrice)}
            </Text>
          ) : (
            <Text style={styles.statSub}>Inclusive of taxes</Text>
          )}
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.statHeaderRow}>
            <View style={[styles.statIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={[styles.statIconText, { color: '#b45309' }]}>{'◆'}</Text>
            </View>
            <Text style={styles.statLabel}>COINS</Text>
          </View>
          <Text style={styles.statValue}>
            {productCoins.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.statSub}>Or pay with coins</Text>
        </Card>
      </View>

      {/* Discount / Rating row (when synthetic template fields are present) */}
      {productDiscount || productRating ? (
        <Card style={styles.lockCard}>
          <View style={styles.lockRow}>
            <View style={[styles.lockIconCircle, { backgroundColor: '#fef9c3' }]}>
              <Text style={[styles.lockIconText, { color: '#b45309' }]}>★</Text>
            </View>
            <View style={styles.lockTextContainer}>
              <Text style={styles.lockTitle}>
                {productRating ? `${productRating.toFixed(1)} rating` : 'Top pick'}
                {productRatingCount ? ` (${productRatingCount.toLocaleString('en-IN')} reviews)` : ''}
              </Text>
              <Text style={styles.lockDescription}>
                {productDiscount
                  ? `Save ${productDiscount}% off MRP — limited-time offer.`
                  : 'Customer favourite based on recent orders.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Stock card */}
      <Card style={styles.lockCard}>
        <View style={styles.lockRow}>
          <View style={styles.lockIconCircle}>
            <Text style={styles.lockIconText}>{'✓'}</Text>
          </View>
          <View style={styles.lockTextContainer}>
            <Text style={styles.lockTitle}>{stockLabel}</Text>
            <Text style={styles.lockDescription}>
              {productStock === 0
                ? 'This item is currently sold out. Check back soon.'
                : 'Ships within 24 hours of order confirmation.'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Description card (only when description has more than the subtitle) */}
      {productDescription ? (
        <Card style={styles.card}>
          <View style={styles.termsHeader}>
            <View style={styles.termsIconCircle}>
              <Text style={styles.termsIconText}>i</Text>
            </View>
            <Text style={styles.termsTitle}>About this item</Text>
          </View>
          <Text style={[styles.termText, { marginLeft: 0 }]}>
            {productDescription}
          </Text>
        </Card>
      ) : null}

      {/* CTA */}
      <Button
        title={productStock === 0 ? 'Notify Me When Available' : 'Buy Now ↗'}
        onPress={() => {
          if (productStock === 0) return;
          Alert.alert(
            'Coming soon',
            'Checkout flow is not wired up yet — you reached the product detail screen successfully!'
          );
        }}
        style={styles.ctaButton}
      />
      <Text style={styles.helperText}>
        Earn coins on every purchase · Free shipping over ₹999
      </Text>
    </ScrollView>
  );

  // ─── Reviews block (rendered inside details on mobile; full-width below
  //     the row on desktop — matches Figma 395:1104 layout) ─────────────
  const reviewsBlock = (
    <View style={[styles.reviewsSection, isDesktop && styles.reviewsSectionDesktop]}>
      <View style={styles.reviewsHeader}>
        <Text style={styles.reviewsTitle}>
          Reviews <Text style={styles.reviewsCount}>({PLACEHOLDER_REVIEWS.length})</Text>
        </Text>
        <TouchableOpacity style={styles.writeReviewBtn} activeOpacity={0.85}>
          <Text style={styles.writeReviewText}>{'✎'}  Write Review</Text>
        </TouchableOpacity>
      </View>

      {isDesktop ? (
        <View style={styles.reviewsGrid}>
          {PLACEHOLDER_REVIEWS.map((r) => (
            <ReviewCard key={r._id} review={r} desktop />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reviewsScroll}
        >
          {PLACEHOLDER_REVIEWS.map((r) => (
            <ReviewCard key={r._id} review={r} />
          ))}
        </ScrollView>
      )}
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

      {/* Reviews \u2014 render inline only on mobile. Desktop puts the block
          full-width BELOW both columns (see desktop layout return). */}
      {!isDesktop ? reviewsBlock : null}

    </ScrollView>
  );

  // Pick the panel for the current navigation mode. Product mode renders
  // price/coins/stock; deal mode keeps the existing cashback/lock/terms UI.
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
    backgroundColor: '#F5F8FF',
  },
  // New desktop wrapper: vertical scroll, row at top, reviews below.
  desktopScrollContent: {
    backgroundColor: '#F5F8FF',
  },
  desktopRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F8FF',
    alignItems: 'flex-start', // image col is fixed-height; let details col size naturally
  },
  desktopReviewsWrap: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    backgroundColor: '#F5F8FF',
  },

  // ─── Desktop image col (Figma 395:1104) ─────────────────────────────
  // Image is fixed-height (NOT column-filling). Brand info sits in its own
  // white card BELOW the image.
  desktopImageCol: {
    width: 480,
    padding: 28,
    paddingRight: 14,
    gap: 14,
    backgroundColor: '#F5F8FF',
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

  // ─── Details Panel ──────────────────────────────────────────────────
  detailsScroll: {
    flex: 1,
  },
  detailsScrollDesktop: {
    flex: 1,
    backgroundColor: '#F5F8FF',
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
