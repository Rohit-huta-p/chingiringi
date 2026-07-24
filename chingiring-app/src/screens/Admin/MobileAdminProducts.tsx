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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { adminAPI } from '../../api/admin';
import { ProductFormModal, ProductFormValues } from '../../components/ProductFormModal';

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
  price: number;
  coinsPrice: number;
  imageUrl: string;
  stock: number;
  sold: number;
  isActive: boolean;
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toLocaleString();

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

        {/* Stock | Sold */}
        <Text style={s.stockText} numberOfLines={1}>Stock: {item.stock} · Sold: {item.sold}</Text>

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
  const [editProduct, setEditProduct] = useState<Product | null>(null);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [products, search]);

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
        <MobileAdminNav active="AdminAllProducts" />

        <View style={s.body}>
          {/* Title */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle} numberOfLines={1}>Product Management</Text>
              <Text style={s.pageSub}>Manage store products</Text>
            </View>
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
            <SlidersHorizontal size={18} color="#94a3b8" strokeWidth={2} />
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

      <ProductFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
        onSubmit={handleSave}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

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
  statusDotActive:   { backgroundColor: '#22c55e' },
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
  cardDesc:   { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  price:      { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  coinsPrice: { fontSize: 11, fontWeight: '600', color: '#22c55e', marginBottom: 6 },
  stockText:  { fontSize: 10, color: '#94a3b8', marginBottom: 8 },

  actionsRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleBtn:   {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive:   { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  toggleBtnInactive: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  toggleBtnText:           { fontSize: 10, fontWeight: '700' },
  toggleBtnTextActive:     { color: '#16a34a' },
  toggleBtnTextInactive:   { color: '#94a3b8' },
  iconBtnEdit:   { width: 26, height: 26, borderRadius: 6, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  iconBtnDelete: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});
