import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  SlidersHorizontal,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';
import { Deal, categoriesAPI } from '../../api/deals';
import { useAuthStore } from '../../store';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { DealFormModal } from './AdminDealsScreen';

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ─── Helpers ────────────────────────────────────────────────────────

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
};

function formatExpiry(d: string): string {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
}

// ─── Nav Tabs (shared with dashboard) ───────────────────────────────

const NAV_ITEMS = [
  { key: 'AdminDashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'AdminDeals', label: 'Deals', icon: Tag },
  { key: 'AdminWithdrawals', label: 'Payouts', icon: CreditCard },
  { key: 'AdminUsers', label: 'Users', icon: Users },
  { key: 'AdminAllProducts', label: 'Products', icon: Package },
  { key: 'AdminBanners', label: 'Banners', icon: ImageIcon },
  { key: 'AdminCoupons', label: 'Coupons', icon: Ticket },
];

// ─── Deal Card ──────────────────────────────────────────────────────

function DealCard({ deal, onToggle, onEdit, onExternal, onDelete }: {
  deal: Deal;
  onToggle: () => void;
  onEdit: () => void;
  onExternal: () => void;
  onDelete: () => void;
}) {
  const cashback = deal.cashbackType === 'flat'
    ? `₹${deal.flatCashback}`
    : `${deal.cashbackPercent}%`;

  return (
    <View style={s.dealCard}>
      {/* Title + status */}
      <View style={s.dealHeader}>
        <Text style={s.dealTitle} numberOfLines={2}>{deal.title || deal.description}</Text>
        <View style={[s.statusBadge, deal.isActive ? s.statusActive : s.statusInactive]}>
          <Text style={[s.statusText, deal.isActive ? s.statusTextActive : s.statusTextInactive]}>
            {deal.isActive ? '● Active' : '◉ Inactive'}
          </Text>
        </View>
      </View>
      <Text style={s.dealBrand}>{deal.brand}</Text>

      {/* Tags row */}
      <View style={s.tagsRow}>
        <View style={s.categoryPill}>
          <Text style={s.categoryText}>{deal.category?.name || 'General'}</Text>
        </View>
        <Text style={s.cashbackText}>{cashback} cashback</Text>
        <Text style={s.expiryText}>Expires: {formatExpiry(deal.expiresAt)}</Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <TrendingUp size={12} color="#64748b" strokeWidth={2} />
          <Text style={s.statText}>{fmt(deal.clickCount || 0)} clicks</Text>
        </View>
        <View style={s.statItem}>
          <CheckCircle size={12} color="#64748b" strokeWidth={2} />
          <Text style={s.statText}>0 conv.</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.actionsRow}>
        <TouchableOpacity style={s.toggleBtn} onPress={onToggle}>
          <Text style={s.toggleBtnText}>{deal.isActive ? 'Deactivate' : 'Activate'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onExternal}>
          <ExternalLink size={16} color="#3b82f6" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onEdit}>
          <Pencil size={16} color="#eab308" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onDelete}>
          <Trash2 size={16} color="#ef4444" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminDeals = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-deals'],
    queryFn: () => adminAPI.getDeals(),
  });

  // Categories — needed by the DealFormModal's picker.
  const { data: catRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
    staleTime: 5 * 60_000,
  });
  const categories: any[] =
    catRes?.data?.categories ?? catRes?.categories ?? catRes?.data ?? [];

  const deals: Deal[] = res?.data?.deals ?? res?.deals ?? res?.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateDeal(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-deals'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteDeal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-deals'] }),
  });

  const handleDelete = (deal: Deal) => {
    Alert.alert('Delete Deal', `Delete "${deal.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(deal._id) },
    ]);
  };

  const handleExternal = async (deal: Deal) => {
    const url = deal.affiliateUrl;
    if (!url) {
      Alert.alert('No link', 'This deal has no affiliate URL set.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open the link.');
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditDeal(deal);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditDeal(null);
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) =>
      d.title?.toLowerCase().includes(q) ||
      d.brand?.toLowerCase().includes(q) ||
      d.category?.name?.toLowerCase().includes(q)
    );
  }, [deals, search]);

  const activeCount = deals.filter((d) => d.isActive).length;
  const totalClicks = deals.reduce((sum, d) => sum + (d.clickCount || 0), 0);

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Shared admin header + section nav ────────── */}
        <MobileAdminNav active="AdminDeals" />

        <View style={s.body}>
          {/* ── Title + Add Deal ──────────────────────── */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.pageTitle}>Deal Management</Text>
              <Text style={s.pageSub}>Manage cashback deals and affiliate links</Text>
            </View>
            <TouchableOpacity style={s.addBtn} activeOpacity={0.8} onPress={handleAdd}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Add Deal</Text>
            </TouchableOpacity>
          </View>

          {/* ── Search ────────────────────────────────── */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search deals by title, merchant..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity>
              <SlidersHorizontal size={18} color="#94a3b8" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* ── Stats ─────────────────────────────────── */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Total Deals</Text>
              <Text style={s.miniStatVal}>{deals.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Active Deals</Text>
              <Text style={[s.miniStatVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Total Clicks</Text>
              <Text style={[s.miniStatVal, { color: '#3b82f6' }]}>{fmt(totalClicks)}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Total Conversions</Text>
              <Text style={[s.miniStatVal, { color: '#3b82f6' }]}>0</Text>
            </View>
          </View>

          {/* ── Deal cards ────────────────────────────── */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No deals found</Text>
              <Text style={s.emptySub}>
                {search ? 'Try a different search term.' : 'Tap "+ Add Deal" to create your first deal.'}
              </Text>
            </View>
          ) : (
            filtered.map((deal) => (
              <DealCard
                key={deal._id}
                deal={deal}
                onToggle={() => toggleMutation.mutate({ id: deal._id, isActive: deal.isActive })}
                onEdit={() => handleEdit(deal)}
                onExternal={() => handleExternal(deal)}
                onDelete={() => handleDelete(deal)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit deal modal — uses the same DealFormModal as desktop so
          field validation + create/update mutations stay in one place. The
          modal handles its own create/update + cache invalidation; we just
          need to mount it and close it when done. */}
      <DealFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditDeal(null); }}
        deal={editDeal}
        categories={categories}
      />

      {/* React Query key drift: the shared modal invalidates 'admin','deals'
          but this screen uses 'admin-deals'. Bridge the two so updates show
          here without a manual refresh. */}
      <ModalInvalidator open={showForm} qc={qc} />
    </SafeAreaView>
  );
};

// Tiny helper: when the modal opens/closes, refresh the mobile screen's
// cached deals list. Avoids the need to refactor the desktop modal's mutation
// to invalidate multiple keys. Renders nothing.
function ModalInvalidator({ open, qc }: { open: boolean; qc: ReturnType<typeof useQueryClient> }) {
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasOpen.current && !open) {
      qc.invalidateQueries({ queryKey: ['admin-deals'] });
    }
    wasOpen.current = open;
  }, [open, qc]);
  return null;
}

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Header (reused from Dashboard)
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Nav
  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontWeight: '700' },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Title
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: {
    width: '48%' as any, flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  miniStatLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniStatVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  // Deal card
  dealCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  dealTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#16a34a' },
  statusTextInactive: { color: '#94a3b8' },
  dealBrand: { fontSize: 13, color: '#94a3b8', marginBottom: 10 },

  // Tags
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  categoryPill: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
  cashbackText: { fontSize: 12, fontWeight: '700', color: '#22c55e' },
  expiryText: { fontSize: 11, color: '#94a3b8' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#64748b' },

  // Actions
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: {
    flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});
