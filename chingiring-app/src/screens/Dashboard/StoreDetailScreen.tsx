/**
 * StoreDetailScreen — public Store Profile page.
 *
 * Mockup: https://claude.ai/code/artifact/19be7b02-6aa9-4829-a13a-885f13e730b4
 *         + Follow States: https://claude.ai/code/artifact/1c500789-0ef3-465e-92fb-cf93a18cc2a2
 *
 * Hero photo → white identity card (avatar overlapping the seam, name +
 * verified badge, follow/WhatsApp row) → stat cells → Products/About tabs.
 * "LIVE NOW" banner and the Products tab are backed by real endpoints
 * (GET /streams/active cross-referenced by storeId, GET /products?storeId=)
 * — no fabricated fields.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Linking, Alert, ActivityIndicator, useWindowDimensions, ToastAndroid, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, BadgeCheck, Star, MapPin, Clock, Phone, Share2, Navigation,
  MessageCircle, Radio, Package,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { storesAPI, type Store } from '../../api/stores';
import { productsAPI, type Product } from '../../api/products';
import { sharesAPI } from '../../api/shares';
import { ShareSheet } from '../../components/ShareSheet';
import { FollowButton } from '../../components/FollowButton';
import { useAuthStore } from '../../store';
import { useAuthGate } from '../../context/AuthGateContext';
import { useFollow } from '../../hooks/useFollow';
import { fetchActiveStreams } from '../Buyer/LiveDiscoveryScreen';
import type { StoreCategory } from '../../data/offlineStores';

// Category accent colors — mirrors the map/list on OfflineStoresScreen.
const CATEGORY_COLOR: Record<StoreCategory, string> = {
  Fashion: '#F97316',
  Electronics: '#3B82F6',
  Grocery: '#10B981',
  'Food & Cafe': '#F59E0B',
  Health: '#EF4444',
  Jewellery: '#A855F7',
  Sports: '#0EA5E9',
  Beauty: '#EC4899',
};

// Hero gradient fallback when the store has no cover photo.
const HERO_GRADIENT = ['#26307F', '#3E5BC8', '#5B84F0'] as const;
const HERO_LOCATIONS = [0, 0.46, 1] as const;

// "HH:mm" (24h) → "h:mm AM/PM". Empty string if malformed.
function fmt12(hhmm?: string): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12; if (h === 0) h = 12;
  return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

export const StoreDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { requireAuth } = useAuthGate();
  const [shareOpen, setShareOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<'products' | 'about'>('products');
  const { follow, unfollow, isFollowing } = useFollow();

  const storeId: string | undefined = route.params?.storeId;
  const passed: Store | undefined = route.params?.store;

  // Instant paint from the passed object; refetch by id keeps it fresh and
  // supports deep-links (URL with no object param).
  const { data } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => storesAPI.get(storeId as string),
    initialData: passed ? { status: 'success', data: { store: passed } } : undefined,
    enabled: !!storeId,
  });
  const fetched: Store | undefined = data?.data?.store;
  const store: Store | undefined = fetched ?? passed;

  // Daily share quota — same query key the share action invalidates.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });

  // Real products for this store — backs the Products tab and its count.
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'store', storeId],
    queryFn: () => productsAPI.getProducts({ storeId: storeId as string, limit: 50 }),
    enabled: !!storeId,
  });
  const products: Product[] = productsRes?.data?.products ?? productsRes?.products ?? [];

  // Same queryKey LiveDiscoveryScreen/OfflineStoresScreen use — shared cache,
  // no extra network cost. Determines the "LIVE NOW" banner honestly.
  const { data: activeStreams = [] } = useQuery({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const liveStream = useMemo(
    () => activeStreams.find((s) => s.storeId === storeId),
    [activeStreams, storeId],
  );

  if (!store) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const cat = CATEGORY_COLOR[store.category] ?? Colors.primary;
  const openStr = fmt12(store.openTime);
  const closeStr = fmt12(store.closeTime);
  const hasHours = !!(openStr && closeStr);
  const heroImg = store.images?.[0];
  const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/store/${store._id}?ref=cr_${user?.id ?? ''}`;

  const following = isFollowing(store._id);

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('', msg, [{ text: 'OK' }], { cancelable: true });
    }
  };

  const handleFollowToggle = () => {
    requireAuth(async () => {
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
    }, { title: 'Sign in to follow stores', subtitle: 'See live streams and deals first when you follow a store.', icon: 'star' });
  };

  const callStore = () => {
    if (store.phone) Linking.openURL(`tel:${store.phone.replace(/\s+/g, '')}`).catch(() => {});
  };

  const openWhatsApp = () => {
    if (!store.phone) return;
    const digits = store.phone.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
  };

  // Open Google Maps directions to the store — exact coords when we have them
  // (parsed from the admin's Maps link), else fall back to the address text.
  const openDirections = () => {
    const dest =
      store.lat != null && store.lng != null
        ? `${store.lat},${store.lng}`
        : encodeURIComponent([store.address, store.area, store.city].filter(Boolean).join(', '));
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`).catch(() => {});
  };

  const goToLiveStream = () => {
    if (!liveStream) return;
    navigation.navigate('ViewerScreen', {
      streamId: liveStream._id,
      storeName: liveStream.storeName,
      storeLogoUrl: liveStream.storeLogoUrl,
      streamTitle: liveStream.title,
      storeId: liveStream.storeId,
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: photo (or brand gradient) ── */}
        <View style={[styles.hero, { height: isWide ? 260 : 170 }]}>
          {heroImg ? (
            <Image source={{ uri: heroImg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={HERO_GRADIENT} locations={HERO_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backFab, { top: insets.top + 10 }]}
          >
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => requireAuth(() => setShareOpen(true), { title: 'Sign in to share & earn', subtitle: 'Earn CR when friends visit the store via your link.', icon: 'share' })}
            hitSlop={10}
            style={[styles.shareFab, { top: insets.top + 10 }]}
          >
            <Share2 size={18} color="#fff" />
          </Pressable>
        </View>

        {/* ── LIVE NOW banner — real cross-reference against active streams ── */}
        {liveStream && (
          <Pressable onPress={goToLiveStream} style={styles.liveBanner}>
            <Radio size={14} color="#fff" />
            <Text style={styles.liveBannerText}>LIVE NOW — {liveStream.viewerCount.toLocaleString('en-IN')} watching</Text>
          </Pressable>
        )}

        {/* ── Identity card ── */}
        <View style={[styles.identityCard, isWide && styles.identityCardWide]}>
          <View style={styles.identityTop}>
            {store.logoUrl ? (
              <Image source={{ uri: store.logoUrl }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[cat, cat]} style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{(store.shortName || store.name)[0]?.toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                {store.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <BadgeCheck size={12} color={Colors.primary} />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.openDot, { backgroundColor: store.isOpen ? Colors.success : Colors.textSecondary }]} />
                <Text style={[styles.metaOpenText, { color: store.isOpen ? Colors.success : Colors.textSecondary }]}>
                  {store.isOpen ? 'Open' : 'Closed'}
                </Text>
                <Text style={styles.metaSep}>·</Text>
                <Text style={styles.metaText}>{store.category}</Text>
                {!!store.area && (
                  <>
                    <Text style={styles.metaSep}>·</Text>
                    <Text style={styles.metaText} numberOfLines={1}>{store.area}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Follow / WhatsApp row */}
          <View style={styles.actionsRow}>
            <FollowButton
              following={following}
              loading={followBusy}
              onPress={handleFollowToggle}
              style={{ flex: 1 }}
            />
            {!!store.phone && (
              <Pressable onPress={openWhatsApp} style={styles.waBtn} accessibilityRole="button" accessibilityLabel="Message on WhatsApp">
                <MessageCircle size={18} color="#fff" />
              </Pressable>
            )}
            {!!store.phone && (
              <Pressable onPress={callStore} style={styles.callBtn} accessibilityRole="button" accessibilityLabel="Call store">
                <Phone size={18} color={Colors.primary} />
              </Pressable>
            )}
          </View>

          {/* Stats row — only real, fetched numbers (no fabricated followers/products counts) */}
          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{products.length}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <View style={styles.statRatingRow}>
                <Star size={13} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.statNum}>{store.rating}</Text>
              </View>
              <Text style={styles.statLabel}>{store.reviewsCount} reviews</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('products')} style={[styles.tab, tab === 'products' && styles.tabActive]}>
              <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>Products</Text>
            </Pressable>
            <Pressable onPress={() => setTab('about')} style={[styles.tab, tab === 'about' && styles.tabActive]}>
              <Text style={[styles.tabText, tab === 'about' && styles.tabTextActive]}>About</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Tab content ── */}
        <View style={[styles.content, isWide && styles.contentWide]}>
          {tab === 'products' ? (
            productsLoading ? (
              <View style={styles.tabLoading}><ActivityIndicator color={Colors.primary} /></View>
            ) : products.length === 0 ? (
              <View style={styles.emptyProducts}>
                <Package size={36} color={Colors.textSecondary} />
                <Text style={styles.emptyProductsText}>No products listed yet.</Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {products.map((p) => (
                  <Pressable
                    key={p._id}
                    style={styles.productCard}
                    onPress={() => navigation.navigate('ProductDetail', { productId: p._id, product: p })}
                  >
                    <Image
                      source={{ uri: p.mobileImageUrl || p.imageUrl }}
                      style={styles.productImg}
                      resizeMode="cover"
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                      <View style={styles.productPriceRow}>
                        <Text style={styles.productPrice}>₹{p.price.toLocaleString('en-IN')}</Text>
                        {!!p.mrp && p.mrp > p.price && (
                          <Text style={styles.productMrp}>₹{p.mrp.toLocaleString('en-IN')}</Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <>
              <View style={styles.rule} />
              <View style={styles.sec}>
                <Text style={styles.eye}>Hours</Text>
                <View style={styles.infoline}>
                  <Clock size={16} color={Colors.primary} />
                  <Text style={styles.infoText}>
                    <Text style={{ color: store.isOpen ? Colors.success : Colors.textSecondary, fontFamily: Fonts.bold }}>
                      {store.isOpen ? 'Open now' : 'Closed'}
                    </Text>
                    {hasHours ? ` · ${openStr} – ${closeStr}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.rule} />
              <View style={styles.sec}>
                <Text style={styles.eye}>Location</Text>
                <View style={styles.infoline}>
                  <MapPin size={16} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoText}>{store.address}</Text>
                    {!!(store.area || store.city) && (
                      <Text style={styles.infoSub}>{[store.area, store.city].filter(Boolean).join(', ')}</Text>
                    )}
                  </View>
                </View>
                {!!store.phone && (
                  <View style={[styles.infoline, { marginTop: 10 }]}>
                    <Phone size={16} color={Colors.primary} />
                    <Text style={styles.infoText}>{store.phone}</Text>
                  </View>
                )}
                <Pressable
                  onPress={() => requireAuth(openDirections, { title: 'Sign in for directions', subtitle: 'Access store navigation and location details.', icon: 'navigation' })}
                  style={styles.dirBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Get directions"
                >
                  <Navigation size={16} color="#fff" />
                  <Text style={styles.dirBtnText}>Get directions</Text>
                </Pressable>
              </View>

              {!!store.description && (
                <>
                  <View style={styles.rule} />
                  <View style={styles.sec}>
                    <Text style={styles.eye}>About</Text>
                    <Text style={styles.about}>{store.description}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={store.name}
        url={shareUrl}
        onShared={async () => {
          try {
            await sharesAPI.postShare('store', store._id);
            qc.invalidateQueries({ queryKey: ['wallet'] });
            qc.invalidateQueries({ queryKey: ['walletSummary'] });
            qc.invalidateQueries({ queryKey: ['shareQuota'] });
            Alert.alert('Shared!', `${quotaRes?.data?.coinsPerShare ?? 50} CR pending — it unlocks when a friend opens your link.`);
          } catch { /* cap/offline — no credit */ }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero: { width: '100%', overflow: 'hidden' },
  backFab: {
    position: 'absolute', left: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  shareFab: {
    position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center',
  },

  liveBanner: {
    backgroundColor: Colors.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  liveBannerText: { color: '#fff', fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.3 },

  // Identity card
  identityCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 16, paddingTop: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: -2 }, shadowRadius: 8, elevation: 2,
  },
  identityCardWide: { maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  identityTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 12 },
  avatar: {
    width: 72, height: 72, borderRadius: 18,
    marginTop: -36, borderWidth: 3, borderColor: Colors.surface,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 26, fontFamily: Fonts.extraBold },
  identityText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  storeName: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text, flexShrink: 1 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.primaryLight10, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, flexShrink: 0,
  },
  verifiedBadgeText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  metaOpenText: { fontSize: 13, fontFamily: Fonts.semiBold },
  metaSep: { color: Colors.textSecondary, fontSize: 13 },
  metaText: { fontSize: 13, color: Colors.textSecondary },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  waBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  callBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
    marginHorizontal: -16, paddingHorizontal: 16,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 10 },
  statRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.text },
  statLabel: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.textSecondary },

  tabs: { flexDirection: 'row', marginHorizontal: -16, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 14, gap: 18 },
  contentWide: { maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },

  tabLoading: { alignItems: 'center', paddingVertical: 40 },
  emptyProducts: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyProductsText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },

  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productCard: {
    width: '48%',
    backgroundColor: Colors.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  productImg: { width: '100%', aspectRatio: 1, backgroundColor: Colors.backgroundGrey },
  productInfo: { padding: 10, gap: 4 },
  productName: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.text, lineHeight: 16 },
  productPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  productPrice: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  productMrp: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, textDecorationLine: 'line-through' },

  sec: { gap: 10 },
  eye: { fontSize: 11, fontFamily: Fonts.extraBold, color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  about: { fontSize: 14, fontFamily: Fonts.regular, color: '#475569', lineHeight: 21 },
  rule: { height: 1, backgroundColor: Colors.border },

  infoline: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  infoSub: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  dirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'flex-start', marginTop: 12, marginLeft: 26,
    backgroundColor: Colors.primary,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12,
  },
  dirBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});

export default StoreDetailScreen;
