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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  MapPin,
  List,
  Radio,
  Tag,
  Star,
  Clock,
  SlidersHorizontal,
  Plus,
  Check,
  X,
  Bell,
  MessageCircle,
} from 'lucide-react-native';
import { fetchActiveStreams, type LiveStream } from '../Buyer/LiveDiscoveryScreen';
import * as Location from 'expo-location';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { ShareSheet } from '../../components/ShareSheet';
import { useAuthStore } from '../../store';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { getUnreadTotal } from '../../api/chat';
import { storesAPI, type Store } from '../../api/stores';
import { sharesAPI } from '../../api/shares';
import {
  STORE_CATEGORIES,
  type StoreCategory,
} from '../../data/offlineStores';
import { LiveCard } from '../../components/LiveCard';
import { CategoryTiles } from '../../components/CategoryTiles';
import { CATEGORY_COLOR, getCategoryColor } from '../../constants/categories';

type SortKey = 'discount' | 'rating';
type ViewMode = 'live' | 'stores';
type StoreFilters = { openNow: boolean; minDiscount: number; minRating: number };

const DEFAULT_FILTERS: StoreFilters = { openNow: false, minDiscount: 0, minRating: 0 };
const DISCOUNT_STEPS = [0, 10, 20, 30];
const RATING_STEPS = [0, 4, 4.5];

const PRIMARY = Colors.primary;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const OfflineStoresScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  // Match the navigator: desktop two-pane only on web ≥768; native stays mobile.
  const isNarrow = Platform.OS !== 'web' || width < 768;
  const navigation = useNavigation<any>();

  // Header identity mirrors the Home screen: greeting + message/bell icons.
  const user = useAuthStore((s) => s.user);
  const unreadCount = useUnreadCount();
  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: getUnreadTotal,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<StoreCategory | 'All'>('All');
  const [sort, setSort] = useState<SortKey>('discount');
  // Mobile opens on the Live tab; desktop keeps its Stores-first default.
  const [viewMode, setViewMode] = useState<ViewMode>(isNarrow ? 'live' : 'stores');
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Bengaluru, Karnataka');
  // Measured width of the live grid pane (updated on layout so the column
  // math is correct inside the desktop drawer, not just at window width).
  const [liveGridW, setLiveGridW] = useState(0);

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

  // Live streams filtered by the shared category selector (mobile Live tab).
  const filteredLive = useMemo(
    () => (activeCategory === 'All' ? liveStreams : liveStreams.filter((s) => s.category === activeCategory)),
    [liveStreams, activeCategory],
  );

  const filterCount =
    (filters.openNow ? 1 : 0) + (filters.minDiscount > 0 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0);

  const openCount = filtered.filter((s) => s.isOpen).length;
  // Toggle is active on desktop only — only the selected panel renders.
  const showStores = viewMode === 'stores';
  const showLive   = viewMode === 'live';

  // Live grid (desktop): 2 / 3 / 4 columns for sm / md / lg. Card width is
  // derived from the measured pane width so columns stay flush.
  const LIVE_GAP = isNarrow ? 12 : 16;
  const liveCols = width < 768 ? 2 : width < 1200 ? 3 : 4;
  const liveScrollbar = Platform.OS === 'web' && !isNarrow ? 16 : 0; // reserve web scrollbar
  const liveCardW = Math.floor(
    (liveGridW - liveScrollbar - LIVE_GAP * (liveCols - 1)) / liveCols,
  );

  // ── Filters bottom-sheet — shared by mobile + desktop; also hosts sort ──
  const renderFilters = () => (
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

          {/* Sort by */}
          <Text style={styles.sheetGroupLabel}>Sort by</Text>
          <View style={styles.sheetChipWrap}>
            {(['discount', 'rating'] as SortKey[]).map((k) => {
              const active = sort === k;
              return (
                <Pressable
                  key={k}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  onPress={() => setSort(k)}
                >
                  <Text style={[styles.sheetChipTxt, active && styles.sheetChipTxtActive]}>
                    {k === 'discount' ? 'Discount' : 'Rating'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Open now */}
          <Pressable
            style={[styles.toggleRow, { marginTop: 18 }]}
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
  );

  // ── Mobile: Header + Categories + [Live | Stores] tabs (native + narrow web) ─
  if (isNarrow) {
    const mLiveCardW = Math.floor((width - 32 - 12) / 2); // 2-col grid: 16px gutters, 12px gap
    return (
      <View style={[styles.root, { paddingHorizontal: 0, paddingVertical: 0 }]}>
        {/* Blue gradient header (matches other screens): greeting + icons + search inside */}
        <LinearGradient
          colors={['#1E3A8A', '#4784E2', '#91BDFF']}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mHeaderGrad}
        >
          <View style={styles.mHeaderRow}>
            <View style={styles.mGreetWrap}>
              <Text style={styles.mGreetLabel}>{greeting()},</Text>
              <Text style={styles.mGreetName} numberOfLines={1}>{user?.name || 'Welcome'}</Text>
            </View>
            <View style={styles.mHeaderIcons}>
              <Pressable
                style={styles.mHeaderIconBtn}
                onPress={() => navigation.navigate('Messages')}
                accessibilityRole="button"
                accessibilityLabel="Messages"
              >
                <MessageCircle size={20} color="#fff" strokeWidth={2.2} />
                {chatUnread > 0 ? (
                  <View style={styles.mHeaderBadge}><Text style={styles.mHeaderBadgeText}>{chatUnread > 9 ? '9+' : chatUnread}</Text></View>
                ) : null}
              </Pressable>
              <Pressable
                style={styles.mHeaderIconBtn}
                onPress={() => navigation.navigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Bell size={20} color="#fff" strokeWidth={2.2} />
                {unreadCount > 0 ? (
                  <View style={styles.mHeaderBadge}><Text style={styles.mHeaderBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
                ) : null}
              </Pressable>
            </View>
          </View>
          <View style={styles.mHeaderSearch}>
            <Search size={18} color={Colors.primary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search stores, categories..."
              placeholderTextColor="#9ca3af"
              style={styles.mSearchInput}
            />
          </View>
        </LinearGradient>

        {/* Categories — shared filter, applies to both tabs */}
        <View style={styles.mCatWrap}>
          <CategoryTiles
            active={activeCategory}
            onSelect={(c) => setActiveCategory(c as StoreCategory | 'All')}
            contentStyle={{ paddingHorizontal: 16 }}
          />
        </View>

        {/* Live | Stores tabs */}
        <View style={styles.mTabs}>
          <Pressable
            style={[styles.mTab, showLive && styles.mTabActive]}
            onPress={() => setViewMode('live')}
            accessibilityRole="tab"
            accessibilityState={{ selected: showLive }}
          >
            <View style={[styles.mTabDot, { backgroundColor: showLive ? '#F2685E' : Colors.textSecondary }]} />
            <Text style={[styles.mTabText, showLive && styles.mTabTextActive]}>Live</Text>
            {filteredLive.length > 0 && (
              <View style={[styles.mTabCount, showLive && styles.mTabCountActive]}>
                <Text style={[styles.mTabCountText, showLive && styles.mTabCountTextActive]}>{filteredLive.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.mTab, showStores && styles.mTabActive]}
            onPress={() => setViewMode('stores')}
            accessibilityRole="tab"
            accessibilityState={{ selected: showStores }}
          >
            <List size={15} color={showStores ? PRIMARY : Colors.textSecondary} strokeWidth={2.2} />
            <Text style={[styles.mTabText, showStores && styles.mTabTextActive]}>Stores</Text>
          </Pressable>
        </View>

        {showLive ? (
          /* ── Live tab — 2-col grid of live streams (category-filtered) ── */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.mLiveScroll}
            showsVerticalScrollIndicator={false}
          >
            {liveLoading ? (
              <View style={styles.mRailLoading}><ActivityIndicator color={Colors.primary} /></View>
            ) : filteredLive.length === 0 ? (
              <View style={styles.mLiveEmptyBig}>
                <Radio size={34} color={Colors.border} />
                <Text style={styles.mLiveEmptyBigText}>
                  {activeCategory === 'All' ? 'No one is live right now' : `No live ${activeCategory} stores right now`}
                </Text>
                <Text style={styles.mLiveEmptySub}>We&apos;ll notify you when a store goes live.</Text>
              </View>
            ) : (
              <View style={styles.mLiveGrid}>
                {filteredLive.map((item) => (
                  <LiveCard
                    key={item._id}
                    stream={item}
                    width={mLiveCardW}
                    onPress={() =>
                      navigation.navigate('ViewerScreen', {
                        streamId: item._id,
                        storeId: item.storeId,
                        storeName: item.storeName,
                        storeLogoUrl: item.storeLogoUrl,
                        streamTitle: item.title,
                      })
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          /* ── Stores tab — nearby stores list (category-filtered) ── */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.mStoreScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.mStatusRow, { justifyContent: 'space-between' }]}>
              <View style={[styles.statusLeft, { flexShrink: 1 }]}>
                <View style={styles.openDot} />
                <Text style={styles.statusText}>
                  <Text style={{ fontWeight: '700', color: Colors.text }}>{openCount} stores</Text>{' '}
                  open now
                </Text>
                <Text style={styles.statusSep}>·</Text>
                <Text style={styles.statusText}>{filtered.length} near you</Text>
              </View>
              <Pressable style={styles.filtersBtn} onPress={() => setFilterOpen(true)}>
                <SlidersHorizontal size={16} color={PRIMARY} />
                <Text style={[styles.filtersText, { fontSize: 13.5 }]}>Filters</Text>
                {filterCount > 0 && (
                  <View style={styles.filterBadge}><Text style={styles.filterBadgeTxt}>{filterCount}</Text></View>
                )}
              </Pressable>
            </View>
            {sharesLeft != null && (
              <Text style={[styles.shareQuotaText, { paddingHorizontal: 16, marginBottom: 2 }]}>
                {sharesLeft}/{sharesCap} shares left today
              </Text>
            )}
            <View style={styles.mStoreList}>
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
            </View>
          </ScrollView>
        )}

        {renderFilters()}
      </View>
    );
  }

  // ── Desktop (web ≥768): existing two-pane layout, unchanged ──────────────
  return (
    <View style={styles.root}>
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
          {/* Live | Stores toggle */}
          <View style={styles.viewToggle}>
            <Pressable
              onPress={() => setViewMode('live')}
              style={[styles.toggleBtn, viewMode === 'live' && styles.toggleBtnActive]}
            >
              <Radio size={14} color={viewMode === 'live' ? PRIMARY : Colors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'live' && styles.toggleTextActive]}>Live</Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('stores')}
              style={[styles.toggleBtn, viewMode === 'stores' && styles.toggleBtnActive]}
            >
              <List size={14} color={viewMode === 'stores' ? PRIMARY : Colors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'stores' && styles.toggleTextActive]}>Stores</Text>
            </Pressable>
          </View>

          <View style={styles.sortGroup}>
            <SortPill label="Discount" icon={Tag} active={sort === 'discount'} onPress={() => setSort('discount')} />
            <SortPill label="Rating" icon={Star} active={sort === 'rating'} onPress={() => setSort('rating')} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
        </View>
      </View>

      {/* ── Category chip row ───────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
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
      <View style={styles.statusRow}>
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
        <Text style={styles.shareQuotaText}>
          {sharesLeft}/{sharesCap} shares left today
        </Text>
      )}

      {/* ── Body: list / live grid ──────────────────────────────── */}
      <View style={styles.body}>
        {showStores && (
          <ScrollView
            style={styles.listColDesktop}
            contentContainerStyle={styles.listContent}
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

        {showLive && (
          <View
            style={styles.liveWrap}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w && Math.abs(w - liveGridW) > 1) setLiveGridW(w);
            }}
          >
            {liveLoading || liveGridW === 0 ? (
              <View style={[styles.liveWrap, styles.emptyState]}>
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : liveStreams.length === 0 ? (
              <View style={[styles.liveWrap, styles.emptyState]}>
                <Radio size={40} color={Colors.border} />
                <Text style={styles.emptyText}>No one is live right now</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.liveWrap}
                contentContainerStyle={[styles.liveGridContent, { gap: LIVE_GAP }]}
                showsVerticalScrollIndicator={false}
              >
                {liveStreams.map((item) => (
                  <LiveCard
                    key={item._id}
                    stream={item}
                    width={liveCardW}
                    onPress={() =>
                      navigation.navigate('ViewerScreen', {
                        streamId: item._id,
                        storeId: item.storeId,
                        storeName: item.storeName,
                        storeLogoUrl: item.storeLogoUrl,
                        streamTitle: item.title,
                      })
                    }
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {renderFilters()}
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
            { backgroundColor: `${getCategoryColor(store.category)}1A` },
          ]}
        >
          <Text style={[styles.categoryPillText, { color: getCategoryColor(store.category) }]}>
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

  // ── Mobile: Live-First feed ─────────────────────────────────────────────
  // Blue gradient header (greeting + icons + search inside, rounded bottom)
  mHeaderGrad: {
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  mHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mGreetWrap: { flex: 1, alignItems: 'flex-start' },
  mGreetLabel: { fontSize: 12.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.9)' },
  mGreetName: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff', maxWidth: 220, marginTop: 1 },
  mHeaderIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mHeaderIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mHeaderBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  mHeaderSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#fff',
    borderRadius: 13,
    height: 44,
    paddingHorizontal: 13,
    marginTop: 12,
  },
  mHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  mLoc: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mLocLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: Fonts.medium },
  mLocValRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  mLocVal: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text, maxWidth: 180 },
  mIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mBadge: {
    position: 'absolute',
    top: 6,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  mSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.surface,
    borderRadius: 13,
    height: 44,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    height: 44,
    outlineStyle: 'none' as any,
  },
  // Categories wrapper (below header, above tabs)
  mCatWrap: { paddingTop: 14, paddingBottom: 2 },

  // Segmented Live | Stores tabs
  mTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#EEF2F7',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  mTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mTabDot: { width: 8, height: 8, borderRadius: 4 },
  mTabText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  mTabTextActive: { color: Colors.text, fontFamily: Fonts.bold },
  mTabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(242,104,94,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mTabCountActive: { backgroundColor: '#F2685E' },
  mTabCountText: { fontSize: 11, fontFamily: Fonts.bold, color: '#F2685E' },
  mTabCountTextActive: { color: '#fff' },

  // Live tab (grid + empty state)
  mLiveScroll: { paddingTop: 14, paddingBottom: 96 },
  mLiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  mLiveEmptyBig: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 40, gap: 10 },
  mLiveEmptyBigText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  mLiveEmptySub: { fontSize: 12.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Stores tab
  mStoreScroll: { paddingTop: 6, paddingBottom: 96 },
  mRailLoading: { paddingVertical: 40, alignItems: 'center' },
  mStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
  },
  mStoreList: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  // ── Live stream grid (desktop live view) ────────────────────────────────
  liveWrap: { flex: 1, width: '100%' },
  liveGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingBottom: 30,
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

  // Chip row (desktop)
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

  // Body (desktop)
  body: { flex: 1, flexDirection: 'row-reverse', gap: 14 },
  listColDesktop: { width: 420, flexGrow: 0, flexShrink: 0 },
  listContent: { paddingRight: 4, paddingBottom: 30, gap: 12 },

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
