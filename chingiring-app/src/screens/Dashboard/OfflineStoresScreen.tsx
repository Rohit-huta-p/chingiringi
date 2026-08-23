import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  Pressable,
  Image,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
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
  Radio,
  Users,
} from 'lucide-react-native';
import { fetchActiveStreams, type LiveStream } from '../Buyer/LiveDiscoveryScreen';
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

export const OfflineStoresScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  // Match the navigator: desktop two-pane only on web ≥768; native stays mobile.
  const isNarrow = Platform.OS !== 'web' || width < 768;
  const navigation = useNavigation<any>();

  // Live | Stores sub-tab toggle
  const [storeTab, setStoreTab] = useState<'live' | 'stores'>('live');

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

  // Active live streams — shared query key with LiveDiscoveryScreen so React Query dedupes
  const { data: liveStreams = [], isLoading: liveLoading } = useQuery<LiveStream[]>({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

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

  const filterCount =
    (filters.openNow ? 1 : 0) + (filters.minDiscount > 0 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0);

  const openCount = filtered.filter((s) => s.isOpen).length;
  const showMap = !isNarrow || viewMode === 'map';
  const showList = !isNarrow || viewMode === 'list';

  return (
    <View
      style={[
        styles.root,
        isNarrow && { paddingHorizontal: 0, paddingVertical: 0 },
      ]}
    >
      {isNarrow ? (
        // ── Mobile: blue gradient header + stacked controls ─────────────
        <>
          {/* Live | Stores sub-tab toggle */}
          <View style={styles.subTabRow}>
            <Pressable
              onPress={() => setStoreTab('live')}
              style={[styles.subTab, storeTab === 'live' && styles.subTabActive]}
            >
              <Radio size={14} color={storeTab === 'live' ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.subTabText, storeTab === 'live' && styles.subTabTextActive]}>Live</Text>
            </Pressable>
            <Pressable
              onPress={() => setStoreTab('stores')}
              style={[styles.subTab, storeTab === 'stores' && styles.subTabActive]}
            >
              <Text style={[styles.subTabText, storeTab === 'stores' && styles.subTabTextActive]}>Stores</Text>
            </Pressable>
          </View>

          {/* ── Live sub-tab ── */}
          {storeTab === 'live' && (
            <View style={{ flex: 1, backgroundColor: Colors.background }}>
              {liveLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
              ) : liveStreams.length === 0 ? (
                <View style={styles.liveEmpty}>
                  <Radio size={44} color={Colors.border} />
                  <Text style={styles.liveEmptyTitle}>No one is live right now</Text>
                  <Text style={styles.liveEmptySub}>Check back soon — stores go live throughout the day.</Text>
                </View>
              ) : (
                <FlatList
                  data={liveStreams}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.liveCard, pressed && { opacity: 0.85 }]}
                      onPress={() => navigation.navigate('ViewerScreen', { streamId: item._id, storeId: item.storeId })}
                    >
                      <View style={styles.liveCardAvatar}>
                        {item.storeLogoUrl ? (
                          <Image source={{ uri: item.storeLogoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <Text style={styles.liveCardAvatarText}>{item.storeName[0]?.toUpperCase()}</Text>
                        )}
                        <View style={styles.liveBadge}>
                          <Radio size={8} color="#fff" />
                          <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                      </View>
                      <View style={styles.liveCardInfo}>
                        <Text style={styles.liveCardStore} numberOfLines={1}>{item.storeName}</Text>
                        <Text style={styles.liveCardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={styles.liveCardViewers}>
                          <Users size={12} color={Colors.textSecondary} />
                          <Text style={styles.liveCardViewerText}>{item.viewerCount.toLocaleString('en-IN')} watching</Text>
                        </View>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </View>
          )}

          {/* ── Stores sub-tab (existing content) ── */}
          {storeTab === 'stores' && <>
          <MobileAuthHeader
            hideBack
            title="Nearby Stores"
            align="left"
          >
            {/* Search bar inside the header — matches the Home search pill */}
            <View style={styles.mobileSearchBar}>
              <Search size={18} color={Colors.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search stores, categories..."
                placeholderTextColor="#9ca3af"
                style={styles.mobileSearchInput}
              />
            </View>
          </MobileAuthHeader>

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
          </>}
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
            <Text style={{ fontWeight: '700', color: Colors.text }}>{openCount} stores</Text>{' '}
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
            {filtered.map((s) => (
              <StoreCard
                key={s._id}
                store={s}
                onPress={() => navigation.navigate('StoreDetail', { storeId: s._id, store: s })}
              />
            ))}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.emptyText}>No stores match your filters.</Text>
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
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#EF4444', '#F97316'];
function avatarColor(seed: string): string {
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
        active && { color: '#fff', fontWeight: '700' },
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

const StoreCard: React.FC<{
  store: Store;
  onPress: () => void;
}> = ({ store, onPress }) => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com'}/s/store/${store._id}?ref=cr_${user?.id ?? ''}`;
  // Same query key the screen-level quota badge and the invalidate call below use.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const initial = (store.shortName || store.name || '?').trim().charAt(0).toUpperCase() || '?';
  const tileColor = avatarColor(store._id || store.name || '');

  return (
    <Pressable
      onPress={onPress}
      style={styles.storeCard}
    >
      {/* Logo, or a colored tile with the store initial */}
      <View style={[styles.storeImage, !store.logoUrl && { backgroundColor: tileColor }]}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.storeInitialWrap}>
            <Text style={styles.storeInitial}>{initial}</Text>
          </View>
        )}
        {/* coin badge top-left */}
        {/* <View style={styles.coinBadge}>
          <Tag size={11} color="#fff" />
          <Text style={styles.coinBadgeText}>{store.userDiscountPercent}% OFF</Text>
        </View> */}
        {/* hottest badge */}
        {store.isFeatured && (
          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>Hottest</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.storeBody}>
        <View style={styles.storeNameRow}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          <View style={[styles.ocPill, store.isOpen ? styles.ocOpen : styles.ocClosed]}>
            <View style={[styles.ocDot, { backgroundColor: store.isOpen ? '#0F9D6E' : '#64748B' }]} />
            <Text style={[styles.ocText, { color: store.isOpen ? '#0F9D6E' : '#64748B' }]}>
              {store.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.categoryPill,
            { backgroundColor: `${CATEGORY_COLOR[store.category]}1A` },
          ]}
        >
          <Text style={[styles.categoryPillText, { color: CATEGORY_COLOR[store.category] }]}>
            {store.category}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.metaText}>
              {store.rating} <Text style={styles.metaMuted}>({store.reviewsCount})</Text>
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{store.opensAt}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <MapPin size={11} color="#10B981" />
          <Text style={styles.addressText} numberOfLines={1}>
            {store.address}
          </Text>
        </View>

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

  // ── Live | Stores sub-tab toggle ────────────────────────────────────────
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    gap: 4,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 6,
  },
  subTabActive: {
    backgroundColor: Colors.primary,
  },
  subTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  subTabTextActive: {
    color: '#fff',
    fontFamily: Fonts.semiBold,
  },

  // ── Live stream cards ────────────────────────────────────────────────────
  liveCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  liveCardAvatar: {
    width: 80,
    height: 80,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveCardAvatarText: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.danger,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  liveCardInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
    gap: 3,
  },
  liveCardStore: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.text,
  },
  liveCardTitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  liveCardViewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  liveCardViewerText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  liveEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  liveEmptyTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.text,
  },
  liveEmptySub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
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

  // Mobile control rows that sit below the gradient header
  mobileControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
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
    fontWeight: '800',
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
  toggleBtnActive: { backgroundColor: '#E9F4FF' },
  toggleText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
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
  sortPillActive: { backgroundColor: '#E9F4FF', borderColor: PRIMARY },
  sortPillText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  sortPillTextActive: { color: PRIMARY },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.text },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  statusText: { fontSize: 12, color: Colors.textSecondary },
  statusSep: { color: Colors.textSecondary, fontSize: 12 },
  filtersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filtersText: { fontSize: 12, color: PRIMARY, fontWeight: '700' },
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
  filterBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
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
  listContent: { paddingRight: 4, paddingBottom: 30, gap: 12 },

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
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyText: { fontSize: 12, fontWeight: '700', color: Colors.text },
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
  legendText: { fontSize: 11, color: Colors.text, fontWeight: '500' },
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  storeCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#F5FAFF',
  },
  storeImage: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },
  storeInitialWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  storeInitial: { color: '#fff', fontSize: 30, fontFamily: Fonts.extraBold },
  coinBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PRIMARY,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  coinBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  ocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  ocOpen: { backgroundColor: 'rgba(16,185,129,0.12)' },
  ocClosed: { backgroundColor: 'rgba(148,163,184,0.16)' },
  ocDot: { width: 6, height: 6, borderRadius: 3 },
  ocText: { fontSize: 10.5, fontWeight: '700' },
  hotBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hotBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  storeBody: { flex: 1, gap: 4, justifyContent: 'center' },
  storeNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeName: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  categoryPillText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
  metaMuted: { color: Colors.textSecondary, fontWeight: '400' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addressText: { fontSize: 11, color: Colors.textSecondary, flex: 1 },
  shareBtn: { alignSelf: 'flex-start', marginTop: 6 },
  shareCta: { fontSize: 11, fontFamily: Fonts.bold, color: PRIMARY },

  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: Colors.textSecondary, fontSize: 13 },
});

export default OfflineStoresScreen;
