/**
 * SellerProfileScreen — Public seller store view for buyers.
 *
 * Navigated to from:
 *   - BuyerProfileScreen (followed stores list)
 *   - LiveDiscoveryScreen (store card tap)
 *
 * Route params: { storeId: string, store?: Store }
 *
 * Shows:
 *   - Store header: logo, name, verification badge, follower count
 *   - Follow / Unfollow button + WhatsApp CTA
 *   - Store info: category, location, rating, hours
 *   - Products grid (GET /api/products?store=:id)
 *   - Aggregate review score from store.rating / store.reviewsCount
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Platform,
  ToastAndroid,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  BadgeCheck,
  Users,
  Star,
  MapPin,
  Clock,
  MessageCircle,
  UserPlus,
  UserCheck,
  Package,
  Phone,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { storesAPI, type Store } from '../../api/stores';
import { productsAPI, type Product } from '../../api/products';
import { useFollow } from '../../hooks/useFollow';
import { useAuthGate } from '../../context/AuthGateContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

function fmt12(hhmm?: string): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ─── Product card (2-column grid) ─────────────────────────────────────────

const ProductCard: React.FC<{
  product: Product;
  onPress: () => void;
}> = ({ product, onPress }) => {
  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
    : 0;

  return (
    <TouchableOpacity style={ps.card} activeOpacity={0.85} onPress={onPress}>
      <View style={ps.imgBox}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, ps.imgFallback]}>
            <Package size={28} color={Colors.border} />
          </View>
        )}
        {hasDiscount ? (
          <View style={ps.discountBadge}>
            <Text style={ps.discountText}>{discountPct}% OFF</Text>
          </View>
        ) : null}
      </View>
      <View style={ps.info}>
        <Text style={ps.productName} numberOfLines={2}>{product.name}</Text>
        <View style={ps.priceRow}>
          <Text style={ps.price}>{inr(product.price)}</Text>
          {hasDiscount ? (
            <Text style={ps.mrp}>{inr(product.mrp!)}</Text>
          ) : null}
        </View>
        {product.rating ? (
          <View style={ps.ratingRow}>
            <Star size={10} color="#f59e0b" fill="#f59e0b" />
            <Text style={ps.ratingText}>{product.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export const SellerProfileScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { requireAuth } = useAuthGate();
  const { follow, unfollow, isFollowing } = useFollow();
  const [followBusy, setFollowBusy] = useState(false);

  const storeId: string | undefined = route.params?.storeId;
  const passedStore: Store | undefined = route.params?.store;

  // Fetch fresh store data; seed with the passed store object for instant paint
  const { data: storeData, isLoading: loadingStore } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => storesAPI.get(storeId as string),
    initialData: passedStore
      ? { status: 'success', data: { store: passedStore } }
      : undefined,
    enabled: !!storeId,
  });
  const store: Store | undefined =
    storeData?.data?.store ?? storeData?.store ?? passedStore;

  // Fetch products assigned to this store via GET /api/products?storeId=:id
  // Products are platform-managed — admin assigns storeId to surface them here.
  // Stores with no assigned products show an empty state.
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['storeProducts', storeId],
    queryFn: async () => {
      try {
        return await productsAPI.getProducts({ storeId, limit: 20 });
      } catch {
        return { data: { products: [] } };
      }
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
  const products: Product[] =
    productsData?.data?.products ??
    productsData?.products ??
    [];

  const following = store ? isFollowing(store._id) : false;

  const showToast = useCallback((msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('', msg, [{ text: 'OK' }], { cancelable: true });
    }
  }, []);

  const handleFollowToggle = useCallback(() => {
    if (!store) return;
    requireAuth(
      async () => {
        setFollowBusy(true);
        try {
          if (following) {
            await unfollow(store._id);
          } else {
            await follow(store._id);
            showToast(`Following ${store.name} — you'll see them first in your feed`);
          }
        } catch {
          showToast('Something went wrong. Please try again.');
        } finally {
          setFollowBusy(false);
        }
      },
      {
        title: 'Sign in to follow stores',
        subtitle: 'See live streams and deals first when you follow a store.',
        icon: 'star',
      },
    );
  }, [store, following, follow, unfollow, requireAuth, showToast]);

  const handleWhatsApp = useCallback(() => {
    if (!store?.phone) {
      showToast('WhatsApp not available for this store.');
      return;
    }
    const cleaned = store.phone.replace(/\D/g, '');
    const number = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    const msg = encodeURIComponent(`Hi, I found ${store.name} on Chingiringi and would like to know more!`);
    Linking.openURL(`https://wa.me/${number}?text=${msg}`).catch(() =>
      showToast("Couldn't open WhatsApp."),
    );
  }, [store, showToast]);

  const handleProductPress = useCallback(
    (product: Product) => nav.navigate('ProductDetail', { productId: product._id, product }),
    [nav],
  );

  if (loadingStore && !store) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={s.loadingContainer}>
        <Text style={s.errorText}>Store not found.</Text>
      </View>
    );
  }

  const openStr = fmt12(store.openTime);
  const closeStr = fmt12(store.closeTime);
  const hasHours = !!(openStr && closeStr);
  const followerCount = (store as any).followerCount as number | undefined;

  return (
    <View style={s.root}>
      {/* Back button — floating over the header */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 8 }]}
        onPress={() => nav.goBack()}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
      >
        {/* ── Store hero header ───────────────────────────────────────── */}
        <LinearGradient
          colors={['#26307F', '#3E5BC8', '#5B84F0']}
          locations={[0, 0.46, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: insets.top + 60 }]}
        >
          {/* Logo */}
          <View style={s.logoRing}>
            {store.logoUrl ? (
              <Image source={{ uri: store.logoUrl }} style={s.logoImg} resizeMode="cover" />
            ) : (
              <Text style={s.logoInitial}>{store.name[0]?.toUpperCase()}</Text>
            )}
          </View>

          {/* Name + verification */}
          <View style={s.heroName}>
            <Text style={s.storeName} numberOfLines={2}>{store.name}</Text>
            {store.isVerified ? (
              <BadgeCheck size={18} color="#60a5fa" strokeWidth={2} />
            ) : null}
          </View>

          {store.category ? (
            <Text style={s.storeCategory}>{store.category}</Text>
          ) : null}

          {/* Follower count */}
          {followerCount != null ? (
            <View style={s.followerRow}>
              <Users size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.followerText}>
                {followerCount.toLocaleString('en-IN')} follower{followerCount !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* ── CTA buttons ─────────────────────────────────────────────── */}
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={[s.ctaBtn, following ? s.ctaBtnActive : s.ctaBtnOutline]}
            onPress={handleFollowToggle}
            disabled={followBusy}
            activeOpacity={0.85}
          >
            {following ? (
              <UserCheck size={16} color={Colors.primary} strokeWidth={2} />
            ) : (
              <UserPlus size={16} color={Colors.primary} strokeWidth={2} />
            )}
            <Text style={[s.ctaBtnText, following && s.ctaBtnTextActive]}>
              {following ? 'Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>

          {store.phone ? (
            <TouchableOpacity
              style={s.ctaBtnWhatsApp}
              onPress={handleWhatsApp}
              activeOpacity={0.85}
            >
              <MessageCircle size={16} color="#fff" strokeWidth={2} />
              <Text style={s.ctaBtnWhatsAppText}>WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Store info cards ─────────────────────────────────────────── */}
        <View style={s.infoSection}>
          {/* Rating */}
          {(store.rating > 0 || store.reviewsCount > 0) ? (
            <View style={s.infoCard}>
              <Star size={15} color="#f59e0b" fill="#f59e0b" />
              <Text style={s.infoText}>
                {store.rating?.toFixed(1) ?? '—'}{' '}
                <Text style={s.infoMuted}>
                  ({store.reviewsCount?.toLocaleString('en-IN') ?? 0} review{store.reviewsCount !== 1 ? 's' : ''})
                </Text>
              </Text>
            </View>
          ) : null}

          {/* Location */}
          {(store.address || store.area || store.city) ? (
            <View style={s.infoCard}>
              <MapPin size={15} color={Colors.primary} strokeWidth={2} />
              <Text style={s.infoText} numberOfLines={2}>
                {[store.address, store.area, store.city].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Hours */}
          {hasHours ? (
            <View style={s.infoCard}>
              <Clock size={15} color={Colors.primary} strokeWidth={2} />
              <Text style={s.infoText}>{openStr} – {closeStr}</Text>
              {store.isOpen != null ? (
                <View style={[s.openBadge, store.isOpen ? s.openBadgeOpen : s.openBadgeClosed]}>
                  <Text style={[s.openBadgeText, store.isOpen ? s.openBadgeTextOpen : s.openBadgeTextClosed]}>
                    {store.isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Phone */}
          {store.phone ? (
            <TouchableOpacity
              style={s.infoCard}
              onPress={() => Linking.openURL(`tel:${store.phone!.replace(/\s+/g, '')}`)}
              activeOpacity={0.85}
            >
              <Phone size={15} color={Colors.primary} strokeWidth={2} />
              <Text style={[s.infoText, { color: Colors.primary }]}>{store.phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Description ─────────────────────────────────────────────── */}
        {store.description ? (
          <View style={s.descSection}>
            <Text style={s.descTitle}>About</Text>
            <Text style={s.descText}>{store.description}</Text>
          </View>
        ) : null}

        {/* ── Products ────────────────────────────────────────────────── */}
        <View style={s.productsSection}>
          <Text style={s.productsTitle}>
            Products{products.length > 0 ? ` (${products.length})` : ''}
          </Text>

          {loadingProducts ? (
            <View style={s.productsLoader}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : products.length === 0 ? (
            <View style={s.productsEmpty}>
              <Package size={36} color={Colors.border} />
              <Text style={s.productsEmptyText}>No products listed yet.</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(p) => p._id}
              numColumns={2}
              columnWrapperStyle={s.productGrid}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <ProductCard product={item} onPress={() => handleProductPress(item)} />
              )}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Main styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary },

  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  logoRing: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  logoImg: { width: '100%', height: '100%' },
  logoInitial: { fontSize: 32, fontFamily: Fonts.extraBold, color: Colors.primary },

  heroName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    textAlign: 'center',
    flexShrink: 1,
  },
  storeCategory: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 8,
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  followerText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.75)',
  },

  // CTA buttons
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ctaBtnOutline: {
    backgroundColor: Colors.primaryLight10,
  },
  ctaBtnActive: {
    backgroundColor: Colors.surface,
  },
  ctaBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  ctaBtnTextActive: {
    color: Colors.primary,
  },
  ctaBtnWhatsApp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#25D366',
  },
  ctaBtnWhatsAppText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#fff',
  },

  // Info cards
  infoSection: {
    marginHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.text,
    lineHeight: 18,
  },
  infoMuted: { color: Colors.textSecondary, fontFamily: Fonts.regular },

  openBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  openBadgeOpen: { backgroundColor: '#dcfce7' },
  openBadgeClosed: { backgroundColor: '#fee2e2' },
  openBadgeText: { fontSize: 11, fontFamily: Fonts.bold },
  openBadgeTextOpen: { color: '#16a34a' },
  openBadgeTextClosed: { color: '#dc2626' },

  // Description
  descSection: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 6 },
  descText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },

  // Products
  productsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  productsTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 12,
  },
  productsLoader: { alignItems: 'center', paddingVertical: 24 },
  productsEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productsEmptyText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  productGrid: { gap: 10, marginBottom: 10 },
});

// ─── Product card styles ──────────────────────────────────────────────────────

const ps = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imgBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundGrey,
    position: 'relative',
  },
  imgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.danger,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  info: { padding: 10, gap: 3 },
  productName: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.text, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  price: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.text },
  mrp: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.textSecondary },
});

export default SellerProfileScreen;
