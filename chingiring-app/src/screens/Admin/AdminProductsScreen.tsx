import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Platform, Image, useWindowDimensions,
  ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus, X, Edit2, Trash2, Search, Package, Circle, SlidersHorizontal, Check,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { ProductFormModal, ProductFormValues } from '../../components/ProductFormModal';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Product Card ───────────────────────────────────────────────────────────

function ProductCard({
  product, cardWidth, onToggle, onEdit, onDelete,
}: {
  product: Product;
  cardWidth: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { width: cardWidth }]}>
      {/* Image */}
      <View style={styles.cardImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Package size={40} color="#cbd5e1" strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text>

        {/* Price + Sold row */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceText}>{'\u20B9'}{product.price.toLocaleString()}</Text>
            <Text style={styles.coinsText}>{product.coinsPrice.toLocaleString()} coins</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaText}>Sold: {product.sold}</Text>
          </View>
        </View>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.statusPill, product.isActive ? styles.statusPillActive : styles.statusPillInactive]}
            onPress={onToggle}
          >
            <Circle
              size={10}
              color={product.isActive ? '#16a34a' : '#94a3b8'}
              fill={product.isActive ? '#16a34a' : '#94a3b8'}
            />
            <Text style={[styles.statusPillText, product.isActive ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnEdit} onPress={onEdit}>
            <Edit2 size={16} color="#3b82f6" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnDelete} onPress={onDelete}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'sold' | 'name';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',    label: 'Newest first' },
  { key: 'priceAsc',  label: 'Price: low to high' },
  { key: 'priceDesc', label: 'Price: high to low' },
  { key: 'sold',      label: 'Most sold' },
  { key: 'name',      label: 'Name: A–Z' },
];

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.fchip, active && styles.fchipActive]}>
      <Text style={[styles.fchipText, active && styles.fchipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AdminProductsScreen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const { width: viewportWidth } = useWindowDimensions();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => adminAPI.getProducts({ limit: 200 }),
    staleTime: 30_000,
  });

  const products: Product[] = data?.data?.products ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'products'] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => adminAPI.createProduct(payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      adminAPI.updateProduct(id, payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteProduct(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to delete product'),
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => (p.category ?? '').trim()).filter(Boolean))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    let list = products;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filterCategory !== 'all') list = list.filter((p) => (p.category ?? '').trim() === filterCategory);
    if (filterStatus !== 'all') list = list.filter((p) => (filterStatus === 'active' ? p.isActive : !p.isActive));
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (priceMin.trim() && !Number.isNaN(min)) list = list.filter((p) => p.price >= min);
    if (priceMax.trim() && !Number.isNaN(max)) list = list.filter((p) => p.price <= max);
    const sorted = [...list];
    switch (sortBy) {
      case 'priceAsc':  sorted.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': sorted.sort((a, b) => b.price - a.price); break;
      case 'sold':      sorted.sort((a, b) => b.sold - a.sold); break;
      case 'name':      sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      default:          sorted.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
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
  const totalSold = products.reduce((s, p) => s + p.sold, 0);
  const totalRevenue = products.reduce((s, p) => s + p.price * p.sold, 0);

  // Grid sizing — the desktop admin has a permanent 250px sidebar, so subtract it
  // (plus page padding) for the real content width, capped so cards don't grow
  // huge. Columns follow the viewport (tailwind ref): lg (≥1024)→4, md (≥768)→3.
  const gap = 16;
  const contentWidth = Math.min(viewportWidth - 250 - Spacing.lg * 2, 1400);
  const cols = viewportWidth >= 1024 ? 4 : viewportWidth >= 768 ? 3 : viewportWidth >= 600 ? 2 : 1;
  const cardWidth = (contentWidth - gap * (cols - 1)) / cols;

  // Called by <ProductFormModal>. Returns a Promise so the modal can show
  // its inline spinner and close only after the mutation succeeds.
  const handleSave = async (values: ProductFormValues) => {
    if (editProduct) {
      await updateMutation.mutateAsync({ id: editProduct._id, payload: values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const handleToggle = (p: Product) => {
    updateMutation.mutate({ id: p._id, payload: { isActive: !p.isActive } });
  };

  const handleDelete = (id: string, name: string) => {
    const remove = () => deleteMutation.mutate(id);
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${name}"?`)) remove();
    } else {
      Alert.alert('Delete Product', `Delete "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Product Management</Text>
          <Text style={styles.pageSubtitle}>Manage store products</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditProduct(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Product</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Products</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>{products.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#16a34a' }]}>Active</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{activeCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#3b82f6' }]}>Total Sold</Text>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{totalSold.toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#7c3aed' }]}>Revenue</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>
            {'\u20B9'}{totalRevenue.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Search + filter toggle */}
      <View style={styles.searchRow}>
        <Search size={18} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color="#64748b" strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setShowFilters((v) => !v)}
          style={styles.filterBtn}
          activeOpacity={0.8}
        >
          <SlidersHorizontal
            size={18}
            color={activeFilterCount > 0 || showFilters ? Colors.primary : '#94a3b8'}
            strokeWidth={2}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter modal */}
      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <View style={styles.fmOverlay}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setShowFilters(false)} />
          <View style={styles.fmCard}>
            {/* Header */}
            <View style={styles.fmHeader}>
              <View style={styles.fmHeaderLeft}>
                <View style={styles.fmHeaderIcon}>
                  <SlidersHorizontal size={15} color="#fff" strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={styles.fmTitle}>Filters</Text>
                  <Text style={styles.fmSubtitle}>Narrow down the product list</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={styles.fmClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={Colors.textSecondary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={styles.fmBody} contentContainerStyle={styles.fmBodyContent} showsVerticalScrollIndicator={false}>
              {categories.length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>Category</Text>
                  <View style={styles.chipRow}>
                    <FilterChip label="All" active={filterCategory === 'all'} onPress={() => setFilterCategory('all')} />
                    {categories.map((c) => (
                      <FilterChip key={c} label={c} active={filterCategory === c} onPress={() => setFilterCategory(c)} />
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.segment}>
                  {(['all', 'active', 'inactive'] as const).map((s, i) => (
                    <TouchableOpacity
                      key={s}
                      activeOpacity={0.85}
                      onPress={() => setFilterStatus(s)}
                      style={[styles.segmentBtn, i > 0 && styles.segmentDivider, filterStatus === s && styles.segmentBtnActive]}
                    >
                      <Text style={[styles.segmentText, filterStatus === s && styles.segmentTextActive]}>
                        {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Price range</Text>
                <View style={styles.priceRangeRow}>
                  <View style={styles.priceField}>
                    <Text style={styles.pricePrefix}>{'₹'}</Text>
                    <TextInput
                      style={styles.priceFieldInput}
                      placeholder="Min"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={priceMin}
                      onChangeText={(v) => setPriceMin(v.replace(/[^0-9]/g, ''))}
                    />
                  </View>
                  <Text style={styles.priceDash}>{'–'}</Text>
                  <View style={styles.priceField}>
                    <Text style={styles.pricePrefix}>{'₹'}</Text>
                    <TextInput
                      style={styles.priceFieldInput}
                      placeholder="Max"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={priceMax}
                      onChangeText={(v) => setPriceMax(v.replace(/[^0-9]/g, ''))}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Sort by</Text>
                <View style={styles.sortList}>
                  {SORT_OPTIONS.map((o, i) => (
                    <TouchableOpacity
                      key={o.key}
                      activeOpacity={0.7}
                      onPress={() => setSortBy(o.key)}
                      style={[styles.sortRow, i > 0 && styles.sortRowBorder]}
                    >
                      <Text style={[styles.sortRowText, sortBy === o.key && styles.sortRowTextActive]}>{o.label}</Text>
                      {sortBy === o.key ? <Check size={17} color={Colors.primary} strokeWidth={2.6} /> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.fmFooter}>
              <TouchableOpacity onPress={clearFilters} disabled={activeFilterCount === 0} style={styles.fmClearBtn} activeOpacity={0.7}>
                <Text style={[styles.fmClearText, activeFilterCount === 0 && { opacity: 0.4 }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowFilters(false)} activeOpacity={0.9} style={styles.fmApplyWrap}>
                <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fmApply}>
                  <Text style={styles.fmApplyText}>
                    Show {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product grid */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyText}>Loading products…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Package size={48} color="#ef4444" strokeWidth={1.5} />
          <Text style={styles.emptyText}>Failed to load products. Try again.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={48} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            {search.trim() || activeFilterCount > 0
              ? 'No products match your search / filters.'
              : 'No products yet. Click "+ Add Product" to create one.'}
          </Text>
        </View>
      ) : (
        <View style={[styles.grid, { gap }]}>
          {filtered.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              cardWidth={cardWidth}
              onToggle={() => handleToggle(p)}
              onEdit={() => { setEditProduct(p); setShowForm(true); }}
              onDelete={() => handleDelete(p._id, p.name)}
            />
          ))}
        </View>
      )}

      <ProductFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
        onSubmit={handleSave}
      />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  containerContent: { padding: Spacing.lg, paddingBottom: 60 },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Stats cards
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: Spacing.lg },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  statLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  cardImageWrap: {
    height: 192,
    backgroundColor: '#f1f5f9',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cardBody: { padding: 16 },

  productName: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  productDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  priceText: { fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  coinsText: { fontSize: 12, color: '#f59e0b', fontWeight: '600', marginTop: 2 },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillActive: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusPillInactive: { backgroundColor: '#F0F4F8', borderColor: '#e2e8f0' },
  statusPillText: { fontSize: 13, fontWeight: '600' },
  statusPillTextActive: { color: '#16a34a' },
  statusPillTextInactive: { color: '#64748b' },

  iconBtnEdit: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Filter toggle (in the search row)
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#e8ecf2',
    height: 24,
  },
  filterCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Filter modal ──
  fmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fmCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
  fmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  fmHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fmHeaderIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  fmTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },
  fmSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  fmClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  fmBody: { flexShrink: 1 },
  fmBodyContent: { padding: 20, gap: 20 },

  filterGroup: { gap: 10 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fchip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  fchipActive: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  fchipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  fchipTextActive: { color: Colors.primary },

  // Segmented status
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' },
  segmentBtnActive: { backgroundColor: '#eff6ff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentTextActive: { color: Colors.primary, fontWeight: '700' },

  // Price fields
  priceRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  pricePrefix: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  priceFieldInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  priceDash: { color: '#94a3b8', fontSize: 14 },

  // Sort list
  sortList: { borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, overflow: 'hidden' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  sortRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sortRowText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  sortRowTextActive: { color: Colors.primary, fontWeight: '700' },

  // Footer
  fmFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  fmClearBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  fmClearText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  fmApplyWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  fmApply: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fmApplyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
