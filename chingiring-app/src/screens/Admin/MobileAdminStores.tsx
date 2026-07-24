import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal, Plus, Pencil, Trash2, MapPin, Inbox } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { StoreFormModal } from './AdminStoresScreen';

// ─── Store Card ─────────────────────────────────────────────────────

function StoreCard({ store, onToggle, onEdit, onDelete }: {
  store: any;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.name} numberOfLines={1}>{store.name}</Text>
        <View style={[s.statusBadge, store.isActive ? s.statusActive : s.statusInactive]}>
          <Text style={[s.statusText, store.isActive ? s.statusTextActive : s.statusTextInactive]}>
            {store.isActive ? '● Active' : '◉ Inactive'}
          </Text>
        </View>
      </View>

      <View style={s.tagsRow}>
        <View style={s.categoryPill}>
          <Text style={s.categoryText}>{store.category}</Text>
        </View>
        <Text style={s.discountText}>{store.userDiscountPercent}% off</Text>
        {store.isFeatured && <Text style={s.featuredText}>★ Featured</Text>}
      </View>

      <View style={s.addrRow}>
        <MapPin size={12} color="#94a3b8" strokeWidth={2} />
        <Text style={s.addrText} numberOfLines={1}>{store.address}</Text>
      </View>

      <View style={s.actionsRow}>
        <TouchableOpacity style={s.toggleBtn} onPress={onToggle}>
          <Text style={s.toggleBtnText}>{store.isActive ? 'Deactivate' : 'Activate'}</Text>
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

export const MobileAdminStores = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<any>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin', 'stores'],
    queryFn: () => adminAPI.getStores({ limit: 50 }),
  });

  const stores: any[] = res?.data?.stores ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateStore(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stores'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteStore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'stores'] }),
  });

  const handleDelete = (store: any) => {
    Alert.alert('Delete Store', `Delete "${store.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(store._id) },
    ]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter((st) =>
      st.name?.toLowerCase().includes(q) ||
      st.address?.toLowerCase().includes(q) ||
      st.category?.toLowerCase().includes(q));
  }, [stores, search]);

  const activeCount = stores.filter((st) => st.isActive).length;
  const featuredCount = stores.filter((st) => st.isFeatured).length;

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <MobileAdminNav active="AdminStores" />

        <View style={s.body}>
          <View style={s.titleRow}>
            <View>
              <Text style={s.pageTitle}>Store Management</Text>
              <Text style={s.pageSub}>Manage partner stores &amp; deal terms</Text>
            </View>
            <TouchableOpacity style={s.addBtn} activeOpacity={0.8} onPress={() => { setEditStore(null); setShowForm(true); }}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Add Store</Text>
            </TouchableOpacity>
          </View>

          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search stores by name, area..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity>
              <SlidersHorizontal size={18} color="#94a3b8" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Total Stores</Text>
              <Text style={s.miniStatVal}>{stores.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Active</Text>
              <Text style={[s.miniStatVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniStatLabel}>Featured</Text>
              <Text style={[s.miniStatVal, { color: '#f59e0b' }]}>{featuredCount}</Text>
            </View>
          </View>

          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No stores found</Text>
              <Text style={s.emptySub}>
                {search ? 'Try a different search term.' : 'Tap "+ Add Store" to create your first store.'}
              </Text>
            </View>
          ) : (
            filtered.map((store) => (
              <StoreCard
                key={store._id}
                store={store}
                onToggle={() => toggleMutation.mutate({ id: store._id, isActive: store.isActive })}
                onEdit={() => { setEditStore(store); setShowForm(true); }}
                onDelete={() => handleDelete(store)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <StoreFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditStore(null); }}
        store={editStore}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: {
    width: '31%' as any, flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  miniStatLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniStatVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#16a34a' },
  statusTextInactive: { color: '#94a3b8' },

  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  categoryPill: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
  discountText: { fontSize: 12, fontWeight: '700', color: '#22c55e' },
  featuredText: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },

  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  addrText: { fontSize: 12, color: '#94a3b8', flex: 1 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});

export default MobileAdminStores;
