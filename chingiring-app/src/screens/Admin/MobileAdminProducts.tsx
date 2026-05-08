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
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { adminAPI } from '../../api/admin';

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

function ProductCard({ item, onToggle, onDelete }: { item: Product; onToggle: () => void; onDelete: () => void }) {
  return (
    <View style={s.card}>
      {/* Image */}
      <View style={s.cardImage}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.cardImg} resizeMode="cover" />
        ) : (
          <View style={s.cardImgPlaceholder}>
            <Text style={s.cardImgLetter}>{item.name[0]}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardInfo}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={[s.statusBadge, item.isActive ? s.statusActive : s.statusInactive]}>
            <Text style={[s.statusText, item.isActive ? s.statusTextActive : s.statusTextInactive]}>
              {item.isActive ? '● Active' : '◉ Inactive'}
            </Text>
          </View>
        </View>
        <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text>

        {/* Price row */}
        <View style={s.priceRow}>
          <Text style={s.price}>₹{item.price.toLocaleString()}</Text>
          <Text style={s.coinsPrice}>{item.coinsPrice.toLocaleString()} coins</Text>
        </View>

        {/* Stock / Sold */}
        <Text style={s.stockText}>Stock: {item.stock}  ·  Sold: {item.sold}</Text>

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.toggleBtn} onPress={onToggle}>
            <Text style={s.toggleBtnText}>{item.isActive ? 'Deactivate' : 'Activate'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Pencil size={16} color="#eab308" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onDelete}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2} />
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
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoCircle}><Text style={s.logoTxt}>C</Text></View>
            <View>
              <Text style={s.headerTitle}>Admin Panel</Text>
              <Text style={s.headerSub}>Super Admin</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.avatarCircle}
            onPress={() => nav.navigate('AdminProfile')}
            activeOpacity={0.7}
          >
            <Text style={s.avatarTxt}>{userInitials(userName)}</Text>
          </TouchableOpacity>
        </View>

        {/* Nav */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.navScroll} contentContainerStyle={s.navContent}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'AdminAllProducts';
            return (
              <TouchableOpacity key={item.key} style={[s.navTab, active && s.navTabActive]}
                onPress={() => { if (!active) nav.navigate(item.key); }}>
                <item.icon size={16} color={active ? '#3b82f6' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
                <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.body}>
          {/* Title */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.pageTitle}>Product Management</Text>
              <Text style={s.pageSub}>Manage store products</Text>
            </View>
            <TouchableOpacity style={s.addBtn}>
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

          {/* Product cards */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No products found</Text>
              <Text style={s.emptySub}>{search ? 'Try a different search.' : 'Tap "+ Add Product" to add your first product.'}</Text>
            </View>
          ) : (
            filtered.map((p) => (
              <ProductCard key={p._id} item={p} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },

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

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: { width: '48%' as any, flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  miniLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  // Product card
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardImage: { height: 180, backgroundColor: '#1e293b' },
  cardImg: { width: '100%', height: '100%' },
  cardImgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#334155' },
  cardImgLetter: { fontSize: 48, fontWeight: '800', color: '#475569' },
  cardInfo: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#16a34a' },
  statusTextInactive: { color: '#94a3b8' },
  cardDesc: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  price: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  coinsPrice: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
  stockText: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});
