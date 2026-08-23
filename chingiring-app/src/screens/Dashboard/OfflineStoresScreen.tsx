/**
 * OfflineStoresScreen — Buyer tab "Stores" (Store List)
 *
 * Mockup: https://claude.ai/code/artifact/d95d61f4-9f60-402e-aea9-97651dbcc8a5
 *         + Follow States: https://claude.ai/code/artifact/1c500789-0ef3-465e-92fb-cf93a18cc2a2
 *         + Empty States:  https://claude.ai/code/artifact/7b76149b-db0c-46d5-ac40-970000927423
 *
 * Mobile header/pills mirror LiveDiscoveryScreen exactly (same components,
 * same navigate('LiveDiscovery')/navigate('Stores') sibling-tab pattern) so
 * the two screens read as one continuous "Live | Stores" surface. The
 * desktop two-pane (list + map) layout below is unchanged.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  MapPin,
  Map as MapIcon,
  List,
  Tag,
  Star,
  Clock,
  SlidersHorizontal,
  Plus,
  Minus,
  Check,
  X,
  MessageCircle,
  Radio,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { StoreMap } from '../../components/StoreMap';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { ShareSheet } from '../../components/ShareSheet';
import { useAuthStore } from '../../store';
import { storesAPI, type Store } from '../../api/stores';
import { sharesAPI } from '../../api/shares';
import { fetchActiveStreams } from '../Buyer/LiveDiscoveryScreen';
import {
  STORE_CATEGORIES,
  type StoreCategory,
} from '../../data/offlineStores';

type SortKey = 'discount' | 'rating';
type ViewMode = 'list' | 'map';
type StoreFilters = { openNow: boolean; minDiscount: number; minRating: number };

const DEFAULT_FILTERS: StoreFilters = { openNow: false, minDiscount: 0, minRating: 0 };
const DISCOUNT_STEPS = [0, 10, 20, 30];
const RATING_STEPS = [0, 4, 4.5];

const PRIMARY = Colors.primary;

// Haversine distance in km between the shopper's GPS fix and a store's pin.
// Pure client-side math over data we already have — no backend change.
function distanceKm(from: { lat: number; lng: number }, toLat: number, toLng: number): number {
  const R = 6371;
  const dLat = ((toLat - from.lat) * Math.PI) / 180;
  const dLng = ((toLng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const OfflineStoresScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  // Match the navigator: desktop two-pane only on web ≥768; native stays mobile.
  const isNarrow = Platform.OS !== 'web' || width < 768;
  const navigation = useNavigation<any>();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<StoreCategory | 'All'>('All');
  const [sort, setSort] = useState<SortKey>('discount');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Bengaluru, Karnataka');

  // Ask for GPS once so "Near" sorts by the shopper's real distance; fall back
  // to the city center (BENGALURU_CENTER) on denial/error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* permission denied or unavailable — keep city-center fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reverse-geocode the GPS fix into a "City, Region" header label (Mapbox — web + native).
  useEffect(() => {
    if (!coords) return;
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (!token) { setLocationLabel('Near you'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?types=place,region&limit=1&access_token=${token}`,
        );
        const json = await res.json();
        const name: string | undefined = json?.features?.[0]?.place_name;
        if (cancelled) return;
        setLocationLabel(name ? name.split(',').slice(0, 2).map((p: string) => p.trim()).join(', ') : 'Near you');
      } catch {
        if (!cancelled) setLocationLabel('Near you');
      }
    })();
    return () => { cancelled = true; };
  }, [coords]);

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesAPI.list({ limit: 50 }),
  });

  // Same queryKey LiveDiscoveryScreen uses — React Query shares the cache
  // instead of double-fetching when both screens are mounted.
  const { data: activeStreams = [] } = useQuery({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const liveStoreIds = useMemo(() => new Set(activeStreams.map((s) => s.storeId)), [activeStreams]);

  // Daily share quota — screen-level (not per-card); same query key the
  // per-store share action invalidates.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const sharesLeft = quotaRes?.data?.remaining;
  const sharesCap = quotaRes?.data?.cap;

  const stores: Store[] = useMemo(() => (data?.data?.stores ?? []) as Store[], [data]);

  const filtered = useMemo(() => {
    let list = [...stores];
    if (activeCategory !== 'All') {
      list = list.filter((s) => s.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q),
      );
    }
    if (filters.openNow) list = list.filter((s) => s.isOpen);
    if (filters.minDiscount > 0) list = list.filter((s) => s.userDiscountPercent >= filters.minDiscount);
    if (filters.minRating > 0) list = list.filter((s) => s.rating >= filters.minRating);
    if (sort === 'discount') list.sort((a, b) => b.userDiscountPercent - a.userDiscountPercent);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [stores, search, activeCategory, sort, filters]);

  // Mobile list only: live stores pinned into their own section up top.
  const liveStores = useMemo(() => filtered.filter((s) => liveStoreIds.has(s._id)), [filtered, liveStoreIds]);
  const otherStores = useMemo(() => filtered.filter((s) => !liveStoreIds.has(s._id)), [filtered, liveStoreIds]);

  const filterCount =
    (filters.openNow ? 1 : 0) + (filters.minDiscount > 0 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0);

  const openCount = filtered.filter((s) => s.isOpen).length;
  const showMap = !isNarrow || viewMode === 'map';
  const showList = !isNarrow || viewMode === 'list';

  const goToLive = () => navigation.navigate('LiveDiscovery');

  return (
    <View
      style={[
        styles.root,
        isNarrow && { paddingHorizontal: 0, paddingVertical: 0 },
      ]}
    >
      {isNarrow ? (
        // ── Mobile: blue gradient header + Live/Stores pills + controls ──
        <>
          <MobileAuthHeader hideBack title="Stores" align="left">
            <View style={styles.mobileSearchBar}>
              <Search size={18} color={Colors.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search stores near you…"
                placeholderTextColor="#9ca3af"
                style={styles.mobileSearchInput}
              />
            </View>
          </MobileAuthHeader>

          {/* Live / Stores toggle pills — mirrors LiveDiscoveryScreen exactly */}
          <View style={styles.pillsRow}>
            <View style={styles.pills}>
              <Pressable onPress={goToLive} style={styles.pill}>
                <View style={styles.liveDot} />
                <Text style={styles.pillText}>Live</Text>
              </Pressable>
              <Pressable style={[styles.pill, styles.pillStoresActive]}>
                <Text style={[styles.pillText, styles.pillTextStoresActive]}>Stores</Text>
              </Pressable>
            </View>
          </View>

          {/* List/Map + Sort pills */}
          <View style={styles.mobileControlsRow}>
            <View style={styles.viewToggle}>
              <Pressable
                onPress={() => setViewMode('list')}
                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              >
                <List size={14} color={viewMode === 'list' ? PRIMARY : Colors.textSecondary} />
                <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('map')}
                style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              >
                <MapIcon size={14} color={viewMode === 'map' ? PRIMARY : Colors.textSecondary} />
                <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortGroup}
            >
              <SortPill label="Discount" icon={Tag} active={sort === 'discount'} onPress={() => setSort('discount')} />
              <SortPill label="Rating" icon={Star} active={sort === 'rating'} onPress={() => setSort('rating')} />
            </ScrollView>
          </View>
        </>
      ) : (
        // ── Desktop: existing horizontal header (unchanged) ─────────────
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Nearby Stores</Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color={Colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search stores, categories..."
              placeholderTextColor={Colors.textSecondary}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.headerRight}>


            <View style={styles.sortGroup}>
              <SortPill label="Discount" icon={Tag} active={sort === 'discount'} onPress={() => setSort('discount')} />
              <SortPill label="Rating" icon={Star} active={sort === 'rating'} onPress={() => setSort('rating')} />
            </View>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>D</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Category chip row ───────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chipRow, isNarrow && { paddingHorizontal: 16 }]}
        style={{ flexGrow: 0 }}
      >
        <CategoryChip
          label="All"
          active={activeCategory === 'All'}
          onPress={() => setActiveCategory('All')}
          isAll
        />
        {STORE_CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            active={activeCategory === c}
            onPress={() => setActiveCategory(c)}
            color={CATEGORY_COLOR[c]}
          />
        ))}
      </ScrollView>

      {/* ── Status row ──────────────────────────────────────────── */}
      <View style={[styles.statusRow, isNarrow && { paddingHorizontal: 16 }]}>
        <View style={styles.statusLeft}>
          <View style={styles.openDot} />
          <Text style={styles.statusText}>
            <Text style={{ fontFamily: Fonts.bold, color: Colors.text }}>{openCount} stores</Text>{' '}
            open now
          </Text>
          <Text style={styles.statusSep}>·</Text>
          <Text style={styles.statusText}>{filtered.length} near you</Text>
        </View>
        <Pressable style={styles.filtersBtn} onPress={() => setFilterOpen(true)}>
          <SlidersHorizontal size={13} color={PRIMARY} />
          <Text style={styles.filtersText}>Filters</Text>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeTxt}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {sharesLeft != null && (
        <Text style={[styles.shareQuotaText, isNarrow && { paddingHorizontal: 16 }]}>
          {sharesLeft}/{sharesCap} shares left today
        </Text>
      )}

      {/* ── Body: map + list ────────────────────────────────────── */}
      <View style={[
        styles.body,
        isNarrow && { flexDirection: 'column', paddingHorizontal: 16 },
      ]}>
        {showMap && (
          <View style={[styles.mapCol, isNarrow && { flex: 1, minHeight: 0, marginBottom: 96 }]}>
            <View style={styles.mapInner}>
              <StoreMap userLocation={coords} stores={filtered} />

              {/* Top-left Stores Nearby badge */}
              <View style={styles.nearbyBadge} pointerEvents="none">
                <View style={styles.nearbyPin}>
                  <MapPin size={10} color="#fff" />
                </View>
                <Text style={styles.nearbyText}>{filtered.length} Stores Nearby</Text>
              </View>

              {/* Legend bottom-left */}
              <View style={styles.legend} pointerEvents="none">
                <LegendRow color={PRIMARY} label="You" />
              </View>

              {/* Custom zoom buttons (visual only on placeholder) */}
              {Platform.OS !== 'web' && (
                <View style={styles.zoomGroup}>
                  <Pressable style={styles.zoomBtn}>
                    <Plus size={14} color={Colors.textSecondary} />
                  </Pressable>
                  <Pressable style={styles.zoomBtn}>
                    <Minus size={14} color={Colors.textSecondary} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {showList && (
          <ScrollView
            style={isNarrow ? styles.listColMobile : styles.listColDesktop}
            contentContainerStyle={[styles.listContent, isNarrow && { paddingBottom: 96, paddingRight: 0 }]}
            showsVerticalScrollIndicator={false}
          >
            {isNarrow ? (
              // ── Mobile: Live Now (pinned) + Nearby Stores sections ──
              <>
                {liveStores.length > 0 && (
                  <>
                    <View style={styles.sectionHead}>
                      <View style={styles.sectionHeadDot} />
                      <Text style={styles.sectionHeadLabelLive}>Live Now</Text>
                      <Text style={styles.sectionHeadCount}>{liveStores.length} store{liveStores.length === 1 ? '' : 's'}</Text>
                      <View style={styles.sectionHeadSepLive} />
                    </View>
                    {liveStores.map((s) => (
                      <StoreCard
                        key={s._id}
                        store={s}
                        isLive
                        distanceKm={coords && s.lat != null && s.lng != null ? distanceKm(coords, s.lat, s.lng) : null}
                        onPress={() => navigation.navigate('StoreDetail', { storeId: s._id, store: s })}
                      />
                    ))}
                    <View style={styles.sectionHead2}>
                      <Text style={styles.sectionHead2Label}>Nearby Stores</Text>
                      <View style={styles.sectionHead2Sep} />
                    </View>
                  </>
                )}
                {otherStores.map((s) => (
                  <StoreCard
                    key={s._id}
                    store={s}
                    isLive={false}
                    distanceKm={coords && s.lat != null && s.lng != null ? distanceKm(coords, s.lat, s.lng) : null}
                    onPress={() => navigation.navigate('StoreDetail', { storeId: s._id, store: s })}
                  />
                ))}
              </>
            ) : (
              filtered.map((s) => (
                <StoreCard
                  key={s._id}
                  store={s}
                  isLive={liveStoreIds.has(s._id)}
                  distanceKm={coords && s.lat != null && s.lng != null ? distanceKm(coords, s.lat, s.lng) : null}
                  onPress={() => navigation.navigate('StoreDetail', { storeId: s._id, store: s })}
                />
              ))
            )}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <EmptyStores onClearFilters={activeCategory !== 'All' || !!search.trim() || filterCount > 0 ? () => {
                    setActiveCategory('All'); setSearch(''); setFilters(DEFAULT_FILTERS);
                  } : undefined} />
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── Filter sheet ──────────────────────────────────────────── */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => { }}>
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <View style={styles.sheetHeadRight}>
                {filterCount > 0 && (
                  <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} hitSlop={8}>
                    <Text style={styles.sheetClear}>Clear all</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setFilterOpen(false)} hitSlop={8} accessibilityLabel="Close">
                  <X size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Open now */}
            <Pressable
              style={styles.toggleRow}
              onPress={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
            >
              <Text style={styles.toggleRowLabel}>Open now</Text>
              <View style={[styles.check, filters.openNow && styles.checkOn]}>
                {filters.openNow && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>
            </Pressable>

            {/* Minimum discount */}
            <Text style={styles.sheetGroupLabel}>Minimum discount</Text>
            <View style={styles.sheetChipWrap}>
              {DISCOUNT_STEPS.map((d) => {
                const active = filters.minDiscount === d;
                return (
                  <Pressable
                    key={d}
                    style={[styles.sheetChip, active && styles.sheetChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, minDiscount: d }))}
                  >
                    <Text style={[styles.sheetChipTxt, active && styles.sheetChipTxtActive]}>
                      {d === 0 ? 'Any' : `${d}%+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Minimum rating */}
            <Text style={[styles.sheetGroupLabel, { marginTop: 18 }]}>Minimum rating</Text>
            <View style={styles.sheetChipWrap}>
              {RATING_STEPS.map((r) => {
                const active = filters.minRating === r;
                return (
                  <Pressable
                    key={r}
                    style={[styles.sheetChip, active && styles.sheetChipActive]}
                    onPress={() => setFilters((f) => ({ ...f, minRating: r }))}
                  >
                    <Text style={[styles.sheetChipTxt, active && styles.sheetChipTxtActive]}>
                      {r === 0 ? 'Any' : `${r}★+`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.sheetDone} onPress={() => setFilterOpen(false)}>
              <Text style={styles.sheetDoneTxt}>Show {filtered.length} stores</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ─── Subcomponents ──────────────────────────────────────────────────────────

const SortPill: React.FC<{
  label: string;
  icon: React.ComponentType<any>;
  active: boolean;
  onPress: () => void;
}> = ({ label, icon: Icon, active, onPress }) => (
  <Pressable onPress={onPress} style={[styles.sortPill, active && styles.sortPillActive]}>
    <Icon size={13} color={active ? PRIMARY : Colors.textSecondary} />
    <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>{label}</Text>
  </Pressable>
);

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

// Deterministic tile color from the store id/name — stable per store, varied across.
const AVATAR_COLORS: [string, string][] = [
  ['#1d4ed8', '#3b82f6'],
  ['#7e22ce', '#a855f7'],
  ['#be185d', '#ec4899'],
  ['#b45309', '#f59e0b'],
  ['#047857', '#10b981'],
  ['#0369a1', '#0ea5e9'],
  ['#b91c1c', '#ef4444'],
  ['#c2410c', '#f97316'],
];
function avatarGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const CategoryChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  isAll?: boolean;
}> = ({ label, active, onPress, color, isAll }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      active && (isAll ? styles.chipActiveDark : { backgroundColor: color, borderColor: color }),
    ]}
  >
    {color && !isAll && (
      <View style={[styles.chipDot, { backgroundColor: active ? '#fff' : color }]} />
    )}
    {isAll && <Plus size={11} color={active ? '#fff' : Colors.text} />}
    <Text
      style={[
        styles.chipText,
        active && { color: '#fff', fontFamily: Fonts.bold },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const LegendRow: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={styles.legendRow}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

// Empty state — matches https://claude.ai/code/artifact/7b76149b (map-pin illustration).
const EmptyStores: React.FC<{ onClearFilters?: () => void }> = ({ onClearFilters }) => (
  <View style={styles.emptyStores}>
    <View style={styles.emptyStoresIconWrap}>
      <MapPin size={44} color={Colors.textSecondary} />
    </View>
    <Text style={styles.emptyStoresTitle}>No stores nearby</Text>
    <Text style={styles.emptyStoresSub}>
      {onClearFilters
        ? "We couldn't find any stores matching your search or filters."
        : "We don't have stores listed in your area yet — check back soon."}
    </Text>
    {onClearFilters && (
      <Pressable onPress={onClearFilters} style={styles.emptyStoresBtn}>
        <Text style={styles.emptyStoresBtnText}>Clear filters</Text>
      </Pressable>
    )}
  </View>
);

const StoreCard: React.FC<{
  store: Store;
  isLive: boolean;
  distanceKm: number | null;
  onPress: () => void;
}> = ({ store, isLive, distanceKm: distKm, onPress }) => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/store/${store._id}?ref=cr_${user?.id ?? ''}`;
  // Same query key the screen-level quota badge and the invalidate call below use.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const initial = (store.shortName || store.name || '?').trim().charAt(0).toUpperCase() || '?';
  const tileGradient = avatarGradient(store._id || store.name || '');

  const openWhatsApp = (e: any) => {
    e.stopPropagation();
    if (!store.phone) return;
    const digits = store.phone.replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
  };

  return (
    <Pressable
      onPress={onPress}
      style={[styles.storeCard, isLive && styles.storeCardLive]}
    >
      {/* Avatar — gradient tile with initial, or logo; pulsing LIVE ring when live */}
      <View style={styles.avaWrap}>
        <View style={[styles.ava, !store.logoUrl && { overflow: 'hidden' }]}>
          {store.logoUrl ? (
            <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={tileGradient} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={styles.avaGradient}>
              <Text style={styles.avaInitial}>{initial}</Text>
            </LinearGradient>
          )}
        </View>
        {isLive && (
          <>
            <View style={styles.liveRing} pointerEvents="none" />
            <View style={styles.liveRingBadge}>
              <Text style={styles.liveRingBadgeText}>LIVE</Text>
            </View>
          </>
        )}
      </View>

      {/* Body */}
      <View style={styles.storeBody}>
        <View style={styles.storeNameRow}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          {store.isVerified && (
            <View style={styles.verifiedBadge}>
              <Check size={9} color={PRIMARY} strokeWidth={3} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          {isLive ? (
            <View style={styles.liveMeta}>
              <Radio size={11} color={Colors.danger} />
              <Text style={styles.liveMetaText}>Live now</Text>
            </View>
          ) : (
            <>
              <View style={[styles.ocDot, { backgroundColor: store.isOpen ? '#0F9D6E' : '#64748B' }]} />
              <Text style={[styles.ocText, { color: store.isOpen ? '#0F9D6E' : '#64748B' }]}>
                {store.isOpen ? 'Open' : 'Closed'}
              </Text>
            </>
          )}
          <Text style={styles.metaSep}>·</Text>
          <Text style={styles.metaText}>{store.category}</Text>
          {distKm != null ? (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{distKm < 10 ? distKm.toFixed(1) : Math.round(distKm)} km</Text>
            </>
          ) : store.area ? (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText} numberOfLines={1}>{store.area}</Text>
            </>
          ) : null}
        </View>

        {!!store.description && (
          <Text style={styles.storeDesc} numberOfLines={1}>{store.description}</Text>
        )}

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            setShareOpen(true);
          }}
          hitSlop={8}
          style={styles.shareBtn}
        >
          <Text style={styles.shareCta}>Share &amp; Earn {quotaRes?.data?.coinsPerShare ?? 50} CR</Text>
        </Pressable>
      </View>

      {/* WhatsApp quick-tap — verified businesses only, matches Follow States legend */}
      {store.isVerified && !!store.phone && (
        <Pressable onPress={openWhatsApp} hitSlop={8} style={styles.waBtn}>
          <MessageCircle size={17} color="#fff" />
        </Pressable>
      )}

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
    </Pressable>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  // Mobile search pill — mirrors the Home search bar (white, rounded, 44px).
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 44,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    height: 44,
    outlineStyle: 'none' as any,
  },

  // Live / Stores toggle pills — identical component to LiveDiscoveryScreen.
  pillsRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  pills: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    alignSelf: 'flex-start',
    gap: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  pillStoresActive: { backgroundColor: Colors.primaryLight10 },
  pillText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  pillTextStoresActive: { color: Colors.primary },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },

  // Mobile control rows that sit below the gradient header
  mobileControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },

  // Header (desktop)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  headerLeft: { gap: 4 },
  title: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: Colors.textSecondary },

  searchWrap: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    outlineStyle: 'none' as any,
  },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  toggleBtnActive: { backgroundColor: Colors.primaryLight10 },
  toggleText: { fontSize: 12, color: Colors.textSecondary, fontFamily: Fonts.semiBold },
  toggleTextActive: { color: PRIMARY },

  sortGroup: { flexDirection: 'row', gap: 6 },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortPillActive: { backgroundColor: Colors.primaryLight10, borderColor: PRIMARY },
  sortPillText: { fontSize: 12, color: Colors.textSecondary, fontFamily: Fonts.semiBold },
  sortPillTextActive: { color: PRIMARY },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: Fonts.bold, fontSize: 13 },

  // Chip row
  chipRow: { gap: 8, paddingVertical: 4, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActiveDark: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusText: { fontSize: 12, color: Colors.textSecondary },
  statusSep: { color: Colors.textSecondary, fontSize: 12 },
  filtersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filtersText: { fontSize: 12, color: PRIMARY, fontFamily: Fonts.bold },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  filterBadgeTxt: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  shareQuotaText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },

  // Filter bottom-sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text },
  sheetHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetClear: { fontSize: 13, fontFamily: Fonts.semiBold, color: PRIMARY },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  toggleRowLabel: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sheetGroupLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  sheetChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sheetChipTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  sheetChipTxtActive: { color: '#fff' },
  sheetDone: {
    marginTop: 22,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetDoneTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },

  // Body
  // desktop: list on the left, map on the right (mobile overrides to column)
  body: { flex: 1, flexDirection: 'row-reverse', gap: 14 },
  mapCol: { flex: 1, minHeight: 400 },
  mapInner: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F4F8F6',
    position: 'relative',
  },
  // Desktop: fixed-width left list (RN-Web ScrollView won't grow reliably with flex).
  listColDesktop: { width: 420, flexGrow: 0, flexShrink: 0 },
  listColMobile: { flex: 1, width: '100%' },
  listContent: { paddingRight: 4, paddingBottom: 30, gap: 10 },

  // Live Now / Nearby Stores section headers (mobile)
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 2 },
  sectionHeadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.danger },
  sectionHeadLabelLive: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.danger, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHeadCount: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.medium },
  sectionHeadSepLive: { flex: 1, height: 1, backgroundColor: 'rgba(239,68,68,0.2)' },
  sectionHead2: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 6, paddingHorizontal: 2 },
  sectionHead2Label: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHead2Sep: { flex: 1, height: 1, backgroundColor: Colors.border },

  // Map overlays
  nearbyBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  nearbyPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyText: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.text },
  legend: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.text, fontFamily: Fonts.medium },
  zoomGroup: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Store card
  storeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  storeCardLive: { borderColor: 'rgba(220,38,38,0.25)' },

  avaWrap: { position: 'relative', flexShrink: 0, width: 52, height: 52 },
  ava: { width: 52, height: 52, borderRadius: 26 },
  avaGradient: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avaInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontFamily: Fonts.extraBold },
  liveRing: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 29, borderWidth: 2.5, borderColor: Colors.danger,
  },
  liveRingBadge: {
    position: 'absolute', bottom: -5, left: 0, right: 0, alignItems: 'center',
  },
  liveRingBadgeText: {
    backgroundColor: Colors.danger, color: '#fff', fontSize: 9, fontFamily: Fonts.bold,
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1.5, borderWidth: 1.5, borderColor: '#fff',
    overflow: 'hidden',
  },

  storeBody: { flex: 1, gap: 3, minWidth: 0 },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text, flexShrink: 1 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.primaryLight10, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, flexShrink: 0,
  },
  verifiedBadgeText: { fontSize: 10, fontFamily: Fonts.bold, color: PRIMARY },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  liveMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveMetaText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.danger },
  ocDot: { width: 6, height: 6, borderRadius: 3 },
  ocText: { fontSize: 12, fontFamily: Fonts.semiBold },
  metaSep: { color: Colors.textSecondary, fontSize: 12 },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  storeDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  hotBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: Colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hotBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },

  shareBtn: { alignSelf: 'flex-start', marginTop: 5 },
  shareCta: { fontSize: 11, fontFamily: Fonts.bold, color: PRIMARY },

  waBtn: {
    flexShrink: 0,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },

  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty stores — matches mockup 7b76149b
  emptyStores: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  emptyStoresIconWrap: {
    width: 96, height: 96, borderRadius: 26, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyStoresTitle: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 6 },
  emptyStoresSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyStoresBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 22 },
  emptyStoresBtnText: { color: '#fff', fontSize: 13, fontFamily: Fonts.bold },
});

export default OfflineStoresScreen;
