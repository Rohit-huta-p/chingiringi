import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Search,
  MapPin,
  Map as MapIcon,
  List,
  Tag,
  Star,
  Navigation,
  Clock,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  Minus,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import { StoreMap } from '../../components/StoreMap';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { ShareSheet } from '../../components/ShareSheet';
import { useAuthStore } from '../../store';
import { storesAPI, type Store } from '../../api/stores';
import { sharesAPI } from '../../api/shares';
import { haversineKm } from '../../utils/geo';
import {
  BENGALURU_CENTER,
  STORE_CATEGORIES,
  type StoreCategory,
} from '../../data/offlineStores';

type SortKey = 'near' | 'discount' | 'rating';
type ViewMode = 'list' | 'map';

const PRIMARY = Colors.primary;

export const OfflineStoresScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isNarrow = width < 1100;
  const user = useAuthStore((st) => st.user);
  const navigation = useNavigation<any>();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<StoreCategory | 'All'>('All');
  const [sort, setSort] = useState<SortKey>('near');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesAPI.list({ limit: 50 }),
  });

  // Daily share quota — screen-level (not per-card); same query key the
  // per-store share action invalidates.
  const { data: quotaRes } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });
  const sharesLeft = quotaRes?.data?.remaining;
  const sharesCap = quotaRes?.data?.cap;

  const stores: Store[] = useMemo(() => {
    const list = (data?.data?.stores ?? []) as Store[];
    return list.map((s) => ({
      ...s,
      distanceKm: haversineKm(BENGALURU_CENTER, { lat: s.lat, lng: s.lng }),
    }));
  }, [data]);

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
    if (sort === 'near') list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    if (sort === 'discount') list.sort((a, b) => b.userDiscountPercent - a.userDiscountPercent);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [stores, search, activeCategory, sort]);

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
          <MobileAuthHeader
            hideBack
            title="Offline Stores"
            subtitle="Bengaluru, Karnataka"
            align="left"
            rightSlot={
              <View style={styles.headerAvatarMobile}>
                {user?.avatarUrl ? (
                  <View style={styles.headerAvatarImgWrap}>
                    {/* Image deferred — using initials fallback to keep
                        bundle import small here. */}
                    <Text style={styles.headerAvatarTxt}>
                      {(user?.name?.[0] ?? 'D').toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.headerAvatarTxt}>
                    {(user?.name?.[0] ?? 'D').toUpperCase()}
                  </Text>
                )}
              </View>
            }
          />

          {/* Search bar */}
          <View style={styles.mobileSearchRow}>
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
              <SortPill label="Near"     icon={Navigation} active={sort === 'near'}     onPress={() => setSort('near')} />
              <SortPill label="Discount" icon={Tag}        active={sort === 'discount'} onPress={() => setSort('discount')} />
              <SortPill label="Rating"   icon={Star}       active={sort === 'rating'}   onPress={() => setSort('rating')} />
            </ScrollView>
          </View>
        </>
      ) : (
        // ── Desktop: existing horizontal header (unchanged) ─────────────
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Offline Stores</Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.locationText}>Bengaluru, Karnataka</Text>
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

            <View style={styles.sortGroup}>
              <SortPill label="Near" icon={Navigation} active={sort === 'near'} onPress={() => setSort('near')} />
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
        <Pressable style={styles.filtersBtn}>
          <SlidersHorizontal size={13} color={PRIMARY} />
          <Text style={styles.filtersText}>Filters</Text>
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
          <View style={[styles.mapCol, isNarrow && { flex: 0, height: 360 }]}>
            <View style={styles.mapInner}>
              <StoreMap
                stores={filtered}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />

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
                <LegendRow color="#10B981" label="Open" />
                <LegendRow color="#94A3B8" label="Closed" />
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
            style={[styles.listCol, isNarrow && { flex: 0 }]}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((s) => (
              <StoreCard
                key={s._id}
                store={s}
                isSelected={s._id === selectedId}
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
  isSelected: boolean;
  onPress: () => void;
}> = ({ store, isSelected, onPress }) => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = `${process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiring.app'}/store/${store._id}?ref=cr_${user?.id ?? ''}`;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.storeCard, isSelected && styles.storeCardSelected]}
    >
      {/* Image placeholder */}
      <View style={styles.storeImage}>
        {/* coin badge top-left */}
        <View style={styles.coinBadge}>
          <Tag size={11} color="#fff" />
          <Text style={styles.coinBadgeText}>{store.userDiscountPercent}% OFF</Text>
        </View>
        {/* open/closed badge top-right */}
        <View style={[styles.statusBadge, !store.isOpen && styles.statusBadgeClosed]}>
          <Text style={styles.statusBadgeText}>{store.isOpen ? 'Open' : 'Closed'}</Text>
        </View>
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
          <ChevronRight size={16} color={Colors.textSecondary} />
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
            <Navigation size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{store.distanceKm} km</Text>
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
          <Text style={styles.shareCta}>Share &amp; Earn 100 CR</Text>
        </Pressable>
      </View>
      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title={store.name}
        url={shareUrl}
        onShared={async () => {
          try {
            const { data } = await sharesAPI.postShare('store', store._id);
            qc.invalidateQueries({ queryKey: ['wallet'] });
            qc.invalidateQueries({ queryKey: ['walletSummary'] });
            qc.invalidateQueries({ queryKey: ['shareQuota'] });
            Alert.alert(
              data.coinsAwarded > 0 ? 'You earned 100 CR ✨' : 'Shared!',
              data.coinsAwarded > 0 ? 'Coins added to your wallet.' : "You've already earned for this today.",
            );
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

  // Mobile-only header avatar (inside MobileAuthHeader's rightSlot)
  headerAvatarMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImgWrap: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  headerAvatarTxt: { fontSize: 15, fontFamily: Fonts.extraBold, color: '#fff' },

  // Mobile control rows that sit below the gradient header
  mobileSearchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  mobileControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
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
  shareQuotaText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },

  // Body
  body: { flex: 1, flexDirection: 'row', gap: 14 },
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
  listCol: { flex: 1, maxWidth: 460 },
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
  statusBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeClosed: { backgroundColor: '#94A3B8' },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
