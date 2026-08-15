import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  Inbox,
  LayoutDashboard,
  Tag,
  CreditCard,
  Users,
  Package,
  Image as ImageIcon,
  Ticket,
  Grid3X3,
  X,
  Check,
  Upload,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { adminAPI } from '../../api/admin';
import { ProductFormModal, ProductFormValues } from '../../components/ProductFormModal';
import { BulkImportModal } from '../../components/BulkImportModal';

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ─── Shared Admin Nav ───────────────────────────────────────────────

const NAV_ITEMS = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'AdminDeals', label: 'Deals', icon: Tag },
  { key: 'AdminWithdrawals', label: 'Payouts', icon: CreditCard },
  { key: 'AdminUsers', label: 'Users', icon: Users },
  { key: 'AdminAllProducts', label: 'Products', icon: Package },
  { key: 'AdminBanners', label: 'Banners', icon: ImageIcon },
  { key: 'AdminCoupons', label: 'Coupons', icon: Ticket },
];

// ─── Types ──────────────────────────────────────────────────────────

interface Product {
  _id: string;
  name: string;
  description: string;
  category?: string;
  price: number;
  coinsPrice: number;
  imageUrl: string;
  sold: number;
  isActive: boolean;
  createdAt?: string;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toLocaleString();

// ─── Sort + filter chip ─────────────────────────────────────────────

type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'sold' | 'name';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'priceAsc', label: 'Price: low to high' },
  { key: 'priceDesc', label: 'Price: high to low' },
  { key: 'sold', label: 'Most sold' },
  { key: 'name', label: 'Name: A–Z' },
];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.fchip, active && s.fchipActive]}>
      <Text style={[s.fchipText, active && s.fchipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Product Card ───────────────────────────────────────────────────

function ProductCard({
  item, width, onToggle, onEdit, onDelete,
}: {
  item: Product;
  width: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[s.card, { width }]}>
      {/* Image (square, fits card width perfectly) */}
      <View style={s.cardImage}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.cardImg} resizeMode="cover" />
        ) : (
          <View style={s.cardImgPlaceholder}>
            <Text style={s.cardImgLetter}>{item.name[0]}</Text>
          </View>
        )}
        {/* Status pip in corner — frees up title-row space for product name */}
        <View style={[s.statusDot, item.isActive ? s.statusDotActive : s.statusDotInactive]} />
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.cardDesc} numberOfLines={1}>{item.description || ' '}</Text>

        {/* Price */}
        <Text style={s.price}>₹{item.price.toLocaleString()}</Text>
        <Text style={s.coinsPrice} numberOfLines={1}>{item.coinsPrice.toLocaleString()} coins</Text>

        {/* Sold */}
        <Text style={s.stockText} numberOfLines={1}>Sold: {item.sold}</Text>

        {/* Actions — icon-only, compact */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.toggleBtn, item.isActive ? s.toggleBtnActive : s.toggleBtnInactive]}
            onPress={onToggle}
          >
            <Text style={[s.toggleBtnText, item.isActive ? s.toggleBtnTextActive : s.toggleBtnTextInactive]}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtnEdit} onPress={onEdit}>
            <Pencil size={14} color="#3b82f6" strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtnDelete} onPress={onDelete}>
            <Trash2 size={14} color="#ef4444" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminProducts = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const { width: winW } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const qc = useQueryClient();

  // Grid sizing: body has 16px horizontal padding, 10px gutter between cards.
  const GRID_PAD = 16;
  const GRID_GAP = 10;
  const cardWidth = (winW - GRID_PAD * 2 - GRID_GAP) / 2;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => adminAPI.getProducts({ limit: 200 }),
    staleTime: 30_000,
  });
  const products: Product[] = data?.data?.products ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'products'] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateProduct(id, { isActive }),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteProduct(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to delete product'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ProductFormValues) => adminAPI.createProduct(payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductFormValues }) =>
      adminAPI.updateProduct(id, payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to update product'),
  });

  const handleSave = async (values: ProductFormValues) => {
    if (editProduct) {
      await updateMutation.mutateAsync({ id: editProduct._id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => (p.category ?? '').trim()).filter(Boolean))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    let list = products;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    if (filterCategory !== 'all') list = list.filter((p) => (p.category ?? '') === filterCategory);
    if (filterStatus !== 'all') list = list.filter((p) => (filterStatus === 'active' ? p.isActive : !p.isActive));
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);
    if (!Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    if (!Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    const sorted = [...list];
    switch (sortBy) {
      case 'priceAsc': sorted.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': sorted.sort((a, b) => b.price - a.price); break;
      case 'sold': sorted.sort((a, b) => b.sold - a.sold); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: sorted.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    }
    return sorted;
  }, [products, search, filterCategory, filterStatus, priceMin, priceMax, sortBy]);

  const activeFilterCount =
    (filterCategory !== 'all' ? 1 : 0) +
    (filterStatus !== 'all' ? 1 : 0) +
    (priceMin.trim() ? 1 : 0) +
    (priceMax.trim() ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterStatus('all');
    setPriceMin('');
    setPriceMax('');
    setSortBy('newest');
  };

  const activeCount = products.filter((p) => p.isActive).length;
  const totalSold = products.reduce((sum, p) => sum + p.sold, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.price * p.sold, 0);

  const handleToggle = (p: Product) => {
    toggleMutation.mutate({ id: p._id, isActive: !p.isActive });
  };

  const handleDelete = (p: Product) => {
    Alert.alert('Delete Product', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(p._id) },
    ]);
  };

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Shared admin header + section nav */}
        <MobileAdminNav active={''} />

        <View style={s.body}>
          {/* Title */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle} numberOfLines={1}>Products </Text>
              <Text style={s.pageSub}>Manage store products</Text>
            </View>
            <TouchableOpacity
              style={s.importBtn}
              onPress={() => setShowBulk(true)}
              activeOpacity={0.85}
            >
              <Upload size={17} color="#4784E2" strokeWidth={2.4} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => { setEditProduct(null); setShowForm(true); }}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Add Product</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput style={s.searchInput} placeholder="Search products..." placeholderTextColor="#94a3b8"
              value={search} onChangeText={setSearch} />
            <TouchableOpacity onPress={() => setShowFilters(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SlidersHorizontal size={18} color={activeFilterCount > 0 ? '#3b82f6' : '#94a3b8'} strokeWidth={2} />
              {activeFilterCount > 0 ? (
                <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeFilterCount}</Text></View>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Total Products</Text>
              <Text style={s.miniVal}>{products.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Active</Text>
              <Text style={[s.miniVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Total Sold</Text>
              <Text style={[s.miniVal, { color: '#3b82f6' }]}>{totalSold}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Revenue</Text>
              <Text style={[s.miniVal, { color: '#8b5cf6' }]}>₹{fmt(totalRevenue)}</Text>
            </View>
          </View>

          {/* Product cards — 2-col grid */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No products found</Text>
              <Text style={s.emptySub}>{search ? 'Try a different search.' : 'Tap "+ Add Product" to add your first product.'}</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {filtered.map((p) => (
                <ProductCard
                  key={p._id}
                  item={p}
                  width={cardWidth}
                  onToggle={() => handleToggle(p)}
                  onEdit={() => { setEditProduct(p); setShowForm(true); }}
                  onDelete={() => handleDelete(p)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Filter bottom sheet ─────────────────────────────── */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={s.fmOverlay}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setShowFilters(false)} />
          <View style={s.fmSheet}>
            <View style={s.fmGrab} />
            <View style={s.fmHeader}>
              <Text style={s.fmTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color="#64748b" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={s.fmBody}>
              {categories.length > 0 ? (
                <View style={s.fmGroup}>
                  <Text style={s.fmLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <FilterChip label="All" active={filterCategory === 'all'} onPress={() => setFilterCategory('all')} />
                    {categories.map((c) => (
                      <FilterChip key={c} label={c} active={filterCategory === c} onPress={() => setFilterCategory(c)} />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={s.fmGroup}>
                <Text style={s.fmLabel}>Status</Text>
                <View style={s.segment}>
                  {(['all', 'active', 'inactive'] as const).map((st_, i) => (
                    <TouchableOpacity
                      key={st_}
                      activeOpacity={0.85}
                      onPress={() => setFilterStatus(st_)}
                      style={[s.segmentBtn, i > 0 && s.segmentDivider, filterStatus === st_ && s.segmentBtnActive]}
                    >
                      <Text style={[s.segmentText, filterStatus === st_ && s.segmentTextActive]}>
                        {st_ === 'all' ? 'All' : st_ === 'active' ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.fmGroup}>
                <Text style={s.fmLabel}>Price range</Text>
                <View style={s.priceRow}>
                  <View style={s.priceField}>
                    <Text style={s.pricePrefix}>₹</Text>
                    <TextInput
                      style={s.priceFieldInput}
                      placeholder="Min"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={priceMin}
                      onChangeText={(v) => setPriceMin(v.replace(/[^0-9]/g, ''))}
                    />
                  </View>
                  <Text style={s.priceDash}>–</Text>
                  <View style={s.priceField}>
                    <Text style={s.pricePrefix}>₹</Text>
                    <TextInput
                      style={s.priceFieldInput}
                      placeholder="Max"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={priceMax}
                      onChangeText={(v) => setPriceMax(v.replace(/[^0-9]/g, ''))}
                    />
                  </View>
                </View>
              </View>

              <View style={s.fmGroup}>
                <Text style={s.fmLabel}>Sort by</Text>
                <View style={s.sortList}>
                  {SORT_OPTIONS.map((o, i) => (
                    <TouchableOpacity
                      key={o.key}
                      activeOpacity={0.7}
                      onPress={() => setSortBy(o.key)}
                      style={[s.sortRow, i > 0 && s.sortRowBorder]}
                    >
                      <Text style={[s.sortRowText, sortBy === o.key && s.sortRowTextActive]}>{o.label}</Text>
                      {sortBy === o.key ? <Check size={17} color="#3b82f6" strokeWidth={2.6} /> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={s.fmFooter}>
              <TouchableOpacity onPress={clearFilters} disabled={activeFilterCount === 0} style={s.fmClearBtn} activeOpacity={0.7}>
                <Text style={[s.fmClearText, activeFilterCount === 0 && { opacity: 0.4 }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowFilters(false)} activeOpacity={0.9} style={s.fmApply}>
                <Text style={s.fmApplyText}>
                  Show {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ProductFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
        onSubmit={handleSave}
      />

      <BulkImportModal
        visible={showBulk}
        onClose={() => setShowBulk(false)}
        onImported={invalidate}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontWeight: '700' },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  importBtn: { justifyContent: 'center', alignItems: 'center', width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#4784E2', backgroundColor: '#eff6ff', flexShrink: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 0 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: { width: '48%' as any, flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  miniLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  // ── 2-col grid ──────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Product card (compact, 2-col)
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1, // perfect square — image fills card width 1:1
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  cardImg: { width: '100%', height: '100%' },
  cardImgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155' },
  cardImgLetter: { fontSize: 40, fontWeight: '800', color: '#475569' },

  // Status pip overlay on image corner (replaces inline badge — saves room)
  statusDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusDotActive: { backgroundColor: '#22c55e' },
  statusDotInactive: { backgroundColor: '#94a3b8' },

  cardInfo: { padding: 10 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#16a34a' },
  statusTextInactive: { color: '#94a3b8' },
  cardDesc: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  price: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  coinsPrice: { fontSize: 11, fontWeight: '600', color: '#22c55e', marginBottom: 6 },
  stockText: { fontSize: 10, color: '#94a3b8', marginBottom: 8 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  toggleBtnInactive: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  toggleBtnText: { fontSize: 10, fontWeight: '700' },
  toggleBtnTextActive: { color: '#16a34a' },
  toggleBtnTextInactive: { color: '#94a3b8' },
  iconBtnEdit: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  iconBtnDelete: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },

  // ── Filter badge (search-row icon) ──
  filterBadge: {
    position: 'absolute', top: -6, right: -8, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // ── Filter chip ──
  fchip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
  },
  fchipActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  fchipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  fchipTextActive: { color: '#3b82f6' },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },

  // ── Filter bottom sheet ──
  fmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  fmSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, maxHeight: '88%',
  },
  fmGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', marginBottom: 8 },
  fmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, marginBottom: 4 },
  fmTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  fmBody: { gap: 18, paddingVertical: 8 },
  fmGroup: { gap: 10 },
  fmLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Segmented status
  segment: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    overflow: 'hidden', backgroundColor: '#f8fafc',
  },
  segmentBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' },
  segmentBtnActive: { backgroundColor: '#eff6ff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentTextActive: { color: '#3b82f6', fontWeight: '700' },

  // Price fields
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fff',
  },
  pricePrefix: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  priceFieldInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  priceDash: { color: '#94a3b8', fontSize: 14 },

  // Sort list
  sortList: { borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, overflow: 'hidden' },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, backgroundColor: '#fff',
  },
  sortRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sortRowText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  sortRowTextActive: { color: '#3b82f6', fontWeight: '700' },

  // Footer
  fmFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: '#eef2f7',
  },
  fmClearBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  fmClearText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  fmApply: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  fmApplyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
