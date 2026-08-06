import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Linking, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, BadgeCheck, Star, MapPin, Navigation, Clock, Phone, Share2,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { storesAPI, type Store } from '../../api/stores';
import { sharesAPI } from '../../api/shares';
import { ShareSheet } from '../../components/ShareSheet';
import { useAuthStore } from '../../store';
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

// Deal gradient — matches the approved mockup (deep indigo → periwinkle).
const DEAL_GRADIENT = ['#26307F', '#3E5BC8', '#5B84F0'] as const;
const DEAL_LOCATIONS = [0, 0.46, 1] as const;

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
  const [shareOpen, setShareOpen] = useState(false);

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
  const store: Store | undefined = fetched
    ? { ...fetched, distanceKm: fetched.distanceKm ?? passed?.distanceKm }
    : passed;

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
  const heroImg = store.images?.[0];              // real photo only (logo isn't a good hero)
  const photos = (store.images ?? []).slice(0, 8);
  const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app'}/store/${store._id}?ref=cr_${user?.id ?? ''}`;

  const openDirections = () => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`).catch(() => {});
  };
  const callStore = () => {
    if (store.phone) Linking.openURL(`tel:${store.phone.replace(/\s+/g, '')}`).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero: full-bleed photo (or brand gradient), name overlaid ── */}
        <View style={[styles.hero, { height: isWide ? 300 : 236 }]}>
          {heroImg ? (
            <Image source={{ uri: heroImg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={DEAL_GRADIENT} locations={DEAL_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(8,12,22,0.15)', 'rgba(8,12,22,0.75)']}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backFab, { top: insets.top + 10 }]}
          >
            <ChevronLeft size={22} color="#fff" />
          </Pressable>

          <View style={styles.heroText}>
            <Text style={[styles.heroName, isWide && { fontSize: 32 }]} numberOfLines={2}>{store.name}</Text>
            <View style={styles.heroMeta}>
              <View style={styles.catPillOnPhoto}>
                <Text style={styles.catPillTextOnPhoto}>{store.category}</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Star size={13} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.heroMetaText}>{store.rating} <Text style={{ opacity: 0.8 }}>({store.reviewsCount})</Text></Text>
              </View>
              {store.isVerified && (
                <View style={styles.heroMetaItem}>
                  <BadgeCheck size={14} color="#fff" />
                  <Text style={styles.heroMetaText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Deal band ── */}
        <LinearGradient
          colors={DEAL_GRADIENT}
          locations={DEAL_LOCATIONS}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.band, isWide ? styles.bandRow : styles.bandCol]}
        >
          <View style={isWide ? { flex: 1 } : undefined}>
            <View style={styles.bandOff}>
              <Text style={[styles.bandBig, isWide && { fontSize: 40 }]}>{store.userDiscountPercent}%</Text>
              <Text style={styles.bandOffSm}> OFF</Text>
            </View>
            <Text style={styles.bandText}>on every bill — pay through the app, no coupon needed</Text>
          </View>
          <View style={styles.bandActions}>
            {!!store.phone && (
              <Pressable onPress={callStore} style={[styles.btn, styles.btnGhost]}>
                <Phone size={16} color="#fff" />
                <Text style={styles.btnGhostText}>Call</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setShareOpen(true)} style={[styles.btn, styles.btnShare, !isWide && { flex: 1 }]}>
              <Share2 size={16} color={Colors.primary} />
              <Text style={styles.btnShareText}>Share &amp; Earn 100 CR</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ── Content — flowing, single column ── */}
        <View style={[styles.content, isWide && styles.contentWide]}>
          {!!store.description && (
            <View style={styles.sec}>
              <Text style={styles.eye}>About</Text>
              <Text style={styles.about}>{store.description}</Text>
            </View>
          )}

          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {photos.map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          )}

          <View style={styles.rule} />
          <View style={styles.sec}>
            <Text style={styles.eye}>Hours</Text>
            <View style={styles.infoline}>
              <Clock size={16} color={Colors.primary} />
              <Text style={styles.infoText}>
                <Text style={{ color: store.isOpen ? '#0a7a58' : Colors.textSecondary, fontFamily: Fonts.bold }}>
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
            <Pressable onPress={openDirections} style={styles.dirLink}>
              <Navigation size={15} color={Colors.primary} />
              <Text style={styles.dirLinkText}>Get directions</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={store.name}
        url={shareUrl}
        onShared={async () => {
          try {
            const { data: res } = await sharesAPI.postShare('store', store._id);
            qc.invalidateQueries({ queryKey: ['wallet'] });
            qc.invalidateQueries({ queryKey: ['walletSummary'] });
            qc.invalidateQueries({ queryKey: ['shareQuota'] });
            Alert.alert(
              res.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
              res.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
            );
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
  hero: { width: '100%', justifyContent: 'flex-end', overflow: 'hidden' },
  backFab: {
    position: 'absolute', left: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  heroText: { padding: 20 },
  heroName: { fontSize: 26, fontFamily: Fonts.extraBold, color: '#fff', letterSpacing: -0.3 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9, flexWrap: 'wrap' },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold },
  catPillOnPhoto: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  catPillTextOnPhoto: { color: '#fff', fontSize: 11, fontFamily: Fonts.bold },

  // Deal band
  band: { paddingHorizontal: 20, paddingVertical: 16 },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  bandCol: { flexDirection: 'column', gap: 14 },
  bandOff: { flexDirection: 'row', alignItems: 'baseline' },
  bandBig: { color: '#fff', fontSize: 34, fontFamily: Fonts.extraBold, lineHeight: 38 },
  bandOffSm: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },
  bandText: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold, opacity: 0.95, marginTop: 2 },
  bandActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12 },
  btnGhost: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'transparent' },
  btnGhostText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  btnShare: { backgroundColor: '#fff' },
  btnShareText: { color: Colors.primary, fontSize: 14.5, fontFamily: Fonts.bold },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },
  contentWide: { maxWidth: 820, width: '100%', alignSelf: 'center', paddingHorizontal: 24, paddingTop: 26 },
  sec: { gap: 10 },
  eye: { fontSize: 11, fontFamily: Fonts.extraBold, color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  about: { fontSize: 14, fontFamily: Fonts.regular, color: '#475569', lineHeight: 21 },
  rule: { height: 1, backgroundColor: Colors.border },

  photoStrip: { gap: 8, paddingVertical: 2 },
  photo: { width: 150, height: 110, borderRadius: 12, backgroundColor: '#F1F5F9' },

  infoline: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  infoSub: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  dirLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2, alignSelf: 'flex-start' },
  dirLinkText: { color: Colors.primary, fontSize: 13.5, fontFamily: Fonts.bold },
});

export default StoreDetailScreen;
