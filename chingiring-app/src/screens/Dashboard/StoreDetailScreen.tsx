import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  Linking, Platform, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, BadgeCheck, Star, MapPin, Navigation, Clock, Phone, Wallet,
} from 'lucide-react-native';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { storesAPI, type Store } from '../../api/stores';
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

// "HH:mm" (24h) → "h:mm AM/PM". Empty string if malformed. (Client mirror of
// the backend storeHours.formatTime — the API sends opensAt but not a closes-at.)
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

const comingSoon = () => {
  const title = 'Coming soon';
  const msg = 'Paying your bill in the app — with your discount applied instantly — is coming soon.';
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export const StoreDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

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
  // distanceKm is computed client-side in the list, so the refetched copy lacks
  // it — carry it over from the passed object so it doesn't flicker away.
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
  const hours = `${fmt12(store.openTime)} – ${fmt12(store.closeTime)}`;
  const photos = (store.images?.length ? store.images : store.logoUrl ? [store.logoUrl] : []).slice(0, 6);

  const openDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
    Linking.openURL(url).catch(() => {});
  };
  const callStore = () => {
    if (store.phone) Linking.openURL(`tel:${store.phone.replace(/\s+/g, '')}`).catch(() => {});
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{store.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Deal hero — the headline ── */}
        <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>YOU SAVE</Text>
          <Text style={styles.heroBig}>
            {store.userDiscountPercent}%<Text style={styles.heroBigSm}> OFF</Text>
          </Text>
          <Text style={styles.heroSub}>on your total bill — every visit</Text>
          <View style={styles.heroPill}>
            <BadgeCheck size={13} color="#fff" />
            <Text style={styles.heroPillText}>Pay through the app · no coupon needed</Text>
          </View>
        </LinearGradient>

        {/* ── Identity ── */}
        <View style={styles.card}>
          <View style={styles.idRow}>
            {store.logoUrl ? (
              <Image source={{ uri: store.logoUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, { backgroundColor: cat, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={styles.logoInitial}>{(store.shortName || store.name)[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={2}>{store.name}</Text>
                {store.isVerified && <BadgeCheck size={16} color={Colors.primary} />}
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.catPill, { backgroundColor: `${cat}1A` }]}>
                  <Text style={[styles.catPillText, { color: cat }]}>{store.category}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.metaText}>{store.rating} <Text style={styles.metaMuted}>({store.reviewsCount})</Text></Text>
                </View>
                <View style={styles.metaItem}>
                  <Navigation size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{store.distanceKm ?? '—'} km</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Photos (only if the store has any) ── */}
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
            {photos.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        {/* ── About ── */}
        {!!store.description && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.about}>{store.description}</Text>
          </View>
        )}

        {/* ── Hours ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Hours</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><Clock size={16} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoStatus, { color: store.isOpen ? '#0a7a58' : Colors.textSecondary }]}>
                {store.isOpen ? 'Open now' : 'Closed'}
              </Text>
              {!!hours.trim().replace('–', '').trim() && <Text style={styles.infoSub}>{hours}</Text>}
            </View>
          </View>
        </View>

        {/* ── Location ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><MapPin size={16} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoStatus}>{store.address}</Text>
              {!!(store.area || store.city) && (
                <Text style={styles.infoSub}>{[store.area, store.city].filter(Boolean).join(', ')}</Text>
              )}
            </View>
          </View>
          <Pressable onPress={openDirections} style={styles.dirBtn}>
            <Navigation size={15} color={Colors.primary} />
            <Text style={styles.dirBtnText}>Get directions</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Sticky actions ── */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {!!store.phone && (
          <Pressable onPress={callStore} style={[styles.actionBtn, styles.actionGhost]}>
            <Phone size={17} color={Colors.text} />
            <Text style={styles.actionGhostText}>Call</Text>
          </Pressable>
        )}
        <Pressable onPress={comingSoon} style={[styles.actionBtn, styles.actionPrimary]}>
          <Wallet size={17} color="#fff" />
          <Text style={styles.actionPrimaryText}>Pay &amp; save</Text>
          <View style={styles.soon}><Text style={styles.soonText}>SOON</Text></View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 24, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },

  body: { padding: 16, paddingBottom: 24, gap: 14 },
  bodyWide: { maxWidth: 520, width: '100%', alignSelf: 'center' },

  // Hero
  hero: { borderRadius: 18, padding: 20 },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1.2 },
  heroBig: { color: '#fff', fontSize: 52, fontFamily: Fonts.extraBold, lineHeight: 56, marginTop: 2 },
  heroBigSm: { fontSize: 20, fontFamily: Fonts.bold },
  heroSub: { color: '#fff', fontSize: 14, fontFamily: Fonts.semiBold, marginTop: 6, opacity: 0.96 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 14, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9,
  },
  heroPillText: { color: '#fff', fontSize: 11.5, fontFamily: Fonts.semiBold },

  // Card
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 13 },
  idRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  logo: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#F1F5F9' },
  logoInitial: { color: '#fff', fontSize: 20, fontFamily: Fonts.extraBold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catPillText: { fontSize: 10, fontFamily: Fonts.bold },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: Colors.text, fontFamily: Fonts.semiBold },
  metaMuted: { color: Colors.textSecondary, fontFamily: Fonts.regular },

  // Photos
  photoStrip: { gap: 8, paddingVertical: 2 },
  photo: { width: 132, height: 96, borderRadius: 12, backgroundColor: '#F1F5F9' },

  // Sections
  section: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  sectionLabel: { fontSize: 11, fontFamily: Fonts.extraBold, color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  about: { fontSize: 13, fontFamily: Fonts.regular, color: '#475569', lineHeight: 20 },

  infoRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  infoIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.primaryLight10, alignItems: 'center', justifyContent: 'center' },
  infoStatus: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.text },
  infoSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  dirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 12, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primaryLight10,
  },
  dirBtnText: { color: Colors.primary, fontSize: 13.5, fontFamily: Fonts.bold },

  // Actions
  actionBar: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 13 },
  actionGhost: { flex: 0, paddingHorizontal: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  actionGhostText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  actionPrimary: { flex: 1, backgroundColor: Colors.primary },
  actionPrimaryText: { fontSize: 14.5, fontFamily: Fonts.bold, color: '#fff' },
  soon: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 2 },
  soonText: { fontSize: 9, fontFamily: Fonts.extraBold, color: '#fff', letterSpacing: 0.5 },
});

export default StoreDetailScreen;
