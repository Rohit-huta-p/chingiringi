import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Dimensions, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Search, SlidersHorizontal } from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { ImageUploader } from '../../components/ImageUploader';
import { MultiImageUploader } from '../../components/MultiImageUploader';
import { STORE_CATEGORIES } from '../../data/offlineStores';

// ─── Add/Edit Store Modal ────────────────────────────────────────────────────

export function StoreFormModal({ visible, onClose, store }: {
  visible: boolean;
  onClose: () => void;
  store?: any;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!store;

  const buildInitial = (s: any) => ({
    name: s?.name || '',
    shortName: s?.shortName || '',
    category: s?.category || 'Fashion',
    description: s?.description || '',
    phone: s?.phone || '',
    address: s?.address || '',
    area: s?.area || '',
    city: s?.city || 'Bengaluru',
    openTime: s?.openTime || '10:00',
    closeTime: s?.closeTime || '22:00',
    logoUrl: s?.logoUrl || '',
    images: Array.isArray(s?.images) ? s.images : [],
    userDiscountPercent: s?.userDiscountPercent?.toString() || '',
    platformCommissionPercent: s?.platformCommissionPercent?.toString() || '',
    maxDiscountCap: s?.maxDiscountCap?.toString() || '',
    minBillAmount: s?.minBillAmount?.toString() || '',
    settlementCycle: s?.settlementCycle || 'monthly',
    isActive: s?.isActive ?? true,
    isFeatured: s?.isFeatured || false,
    isVerified: s?.isVerified || false,
    rating: s?.rating != null ? String(s.rating) : '',
    reviewsCount: s?.reviewsCount != null ? String(s.reviewsCount) : '',
  });

  const [form, setForm] = useState(() => buildInitial(store));

  // The modal stays mounted and is reused; re-sync from the store prop each
  // time it opens or the target changes (useState initialiser runs only once).
  useEffect(() => {
    if (visible) setForm(buildInitial(store));
  }, [visible, store]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) return adminAPI.updateStore(store._id, data);
      return adminAPI.createStore(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] }); // refresh shopper list too
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to save store');
    },
  });

  const handleSubmit = () => {
    if (!form.name || !form.shortName || !form.address
        || !form.userDiscountPercent || !form.platformCommissionPercent) {
      Alert.alert('Validation', 'Please fill all required fields (name, short name, address, discount %, commission %)');
      return;
    }
    if (form.rating && (Number.isNaN(parseFloat(form.rating)) || parseFloat(form.rating) < 0 || parseFloat(form.rating) > 5)) {
      Alert.alert('Validation', 'Rating must be a number between 0 and 5.');
      return;
    }
    mutation.mutate({
      name: form.name,
      shortName: form.shortName,
      category: form.category,
      description: form.description,
      phone: form.phone,
      address: form.address,
      area: form.area,
      city: form.city,
      openTime: form.openTime,
      closeTime: form.closeTime,
      logoUrl: form.logoUrl,
      images: form.images,
      userDiscountPercent: parseFloat(form.userDiscountPercent),
      platformCommissionPercent: parseFloat(form.platformCommissionPercent),
      maxDiscountCap: form.maxDiscountCap ? parseFloat(form.maxDiscountCap) : 0,
      minBillAmount: form.minBillAmount ? parseFloat(form.minBillAmount) : 0,
      settlementCycle: form.settlementCycle,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      isVerified: form.isVerified,
      rating: form.rating ? parseFloat(form.rating) : 0,
      reviewsCount: form.reviewsCount ? parseInt(form.reviewsCount, 10) : 0,
    });
  };

  const screenWidth = Dimensions.get('window').width;
  const modalWidth = screenWidth >= 768 ? 540 : screenWidth - 40;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: modalWidth }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Store' : 'Add New Store'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* ── Profile ── */}
            <Text style={styles.groupLabel}>Profile</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Store Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Lifestyle Mega Store"
                  placeholderTextColor="#94a3b8"
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Short Name (map pill) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Lifestyle"
                  placeholderTextColor="#94a3b8"
                  value={form.shortName}
                  onChangeText={(v) => setForm({ ...form, shortName: v })}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.catWrap}>
              {STORE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catPill, form.category === c && styles.catPillActive]}
                  onPress={() => setForm({ ...form, category: c })}
                >
                  <Text style={[styles.catPillText, form.category === c && styles.catPillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 80 4000 1234"
                  placeholderTextColor="#94a3b8"
                  value={form.phone}
                  onChangeText={(v) => setForm({ ...form, phone: v })}
                />
              </View>
              <View style={styles.fieldHalf} />
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Short description..."
              placeholderTextColor="#94a3b8"
              multiline
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
            />

            <Text style={styles.fieldLabel}>Logo / Image</Text>
            <ImageUploader
              value={form.logoUrl}
              onChange={(url) => setForm({ ...form, logoUrl: url })}
              folder="chingiringi/stores"
            />

            <Text style={styles.fieldLabel}>Photos (hero &amp; gallery)</Text>
            <MultiImageUploader
              value={form.images}
              onChange={(urls) => setForm({ ...form, images: urls })}
              folder="chingiringi/stores"
              aspect={16 / 9}
              thumbWidth={150}
              coverLabel="Hero"
            />
            <Text style={styles.note}>
              Landscape 16:9 works best — ≈1600×900 (min 1200×675). The Hero photo is the full-width
              banner on the store detail page; the rest fill the gallery strip.
            </Text>

            {/* ── Location ── */}
            <Text style={styles.groupLabel}>Location</Text>
            <Text style={styles.fieldLabel}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ground Floor, Phoenix MarketCity, Whitefield"
              placeholderTextColor="#94a3b8"
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
            />
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Area</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Whitefield"
                  placeholderTextColor="#94a3b8"
                  value={form.area}
                  onChangeText={(v) => setForm({ ...form, area: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Bengaluru"
                  placeholderTextColor="#94a3b8"
                  value={form.city}
                  onChangeText={(v) => setForm({ ...form, city: v })}
                />
              </View>
            </View>
            {/* ── Hours ── */}
            <Text style={styles.groupLabel}>Hours (24h, HH:mm)</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Opens</Text>
                <TextInput
                  style={styles.input}
                  placeholder="10:00"
                  placeholderTextColor="#94a3b8"
                  value={form.openTime}
                  onChangeText={(v) => setForm({ ...form, openTime: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Closes</Text>
                <TextInput
                  style={styles.input}
                  placeholder="22:00"
                  placeholderTextColor="#94a3b8"
                  value={form.closeTime}
                  onChangeText={(v) => setForm({ ...form, closeTime: v })}
                />
              </View>
            </View>

            {/* ── Deal terms ── */}
            <Text style={styles.groupLabel}>Deal terms</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>User Discount % *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.userDiscountPercent}
                  onChangeText={(v) => setForm({ ...form, userDiscountPercent: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Commission % *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.platformCommissionPercent}
                  onChangeText={(v) => setForm({ ...form, platformCommissionPercent: v })}
                />
              </View>
            </View>
            <Text style={styles.note}>Commission is admin-only — never shown to shoppers.</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Max Discount Cap (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0 = no cap"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.maxDiscountCap}
                  onChangeText={(v) => setForm({ ...form, maxDiscountCap: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Min Bill (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.minBillAmount}
                  onChangeText={(v) => setForm({ ...form, minBillAmount: v })}
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Settlement Cycle</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, form.settlementCycle === 'weekly' && styles.segmentBtnActive]}
                onPress={() => setForm({ ...form, settlementCycle: 'weekly' })}
              >
                <Text style={[styles.segmentText, form.settlementCycle === 'weekly' && styles.segmentTextActive]}>Weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, form.settlementCycle === 'monthly' && styles.segmentBtnActive]}
                onPress={() => setForm({ ...form, settlementCycle: 'monthly' })}
              >
                <Text style={[styles.segmentText, form.settlementCycle === 'monthly' && styles.segmentTextActive]}>Monthly</Text>
              </TouchableOpacity>
            </View>

            {/* ── Ratings (shown on the shopper card) ── */}
            <Text style={styles.groupLabel}>Ratings</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Rating (0–5)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4.5"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.rating}
                  onChangeText={(v) => setForm({ ...form, rating: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Reviews (count)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="128"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.reviewsCount}
                  onChangeText={(v) => setForm({ ...form, reviewsCount: v })}
                />
              </View>
            </View>
            <Text style={styles.note}>Manually set until in-app reviews go live.</Text>

            {/* ── Visibility ── */}
            <Text style={styles.groupLabel}>Visibility</Text>
            <ToggleRow label="Active" value={form.isActive} onToggle={() => setForm({ ...form, isActive: !form.isActive })} />
            <ToggleRow label="Featured (Hottest)" value={form.isFeatured} onToggle={() => setForm({ ...form, isFeatured: !form.isFeatured })} />
            <ToggleRow label="Verified" value={form.isVerified} onToggle={() => setForm({ ...form, isVerified: !form.isVerified })} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{isEdit ? 'Update Store' : 'Create Store'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle}>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.toggleDot, value && styles.toggleDotActive]} />
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Stores List Screen ─────────────────────────────────────────────────────

export function AdminStoresScreen() {
  const [showForm, setShowForm] = useState(false);
  const [editStore, setEditStore] = useState<any>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stores'],
    queryFn: () => adminAPI.getStores({ limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateStore(id, { isActive: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const stores = data?.data?.stores || [];
  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter((s: any) =>
      (s.name?.toLowerCase().includes(q)) ||
      (s.address?.toLowerCase().includes(q)) ||
      (s.category?.toLowerCase().includes(q)),
    );
  }, [stores, search]);

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  const handleDelete = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${name}"?`)) deleteMutation.mutate(id);
    } else {
      Alert.alert('Delete Store', `Delete "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Offline Stores</Text>
          <Text style={styles.pageSubtitle}>Manage partner stores &amp; their deal terms</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditStore(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add New Store</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Search size={16} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stores by name, area or category..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color="#64748b" strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <SlidersHorizontal size={16} color="#64748b" strokeWidth={2} />
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Stores</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>{data?.data?.total ?? stores.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{stores.filter((s: any) => s.isActive).length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Featured</Text>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stores.filter((s: any) => s.isFeatured).length}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView>
          <View style={styles.tableContainer}>
            {isDesktop && (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Store</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Category</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Discount</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Commission</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Actions</Text>
              </View>
            )}

            {filteredStores.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {search.trim() ? `No stores match "${search}".` : 'No stores yet. Click "Add New Store" to create one.'}
                </Text>
              </View>
            ) : (
              filteredStores.map((store: any, idx: number) => (
                <View
                  key={store._id}
                  style={[
                    styles.tableRow,
                    idx === filteredStores.length - 1 && styles.tableRowLast,
                    !store.isActive && styles.tableRowInactive,
                  ]}
                >
                  <View style={isDesktop ? { flex: 3 } : { flex: 1 }}>
                    <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                    {isDesktop ? (
                      <Text style={styles.storeSubtext} numberOfLines={1}>{store.address}</Text>
                    ) : (
                      <Text style={styles.storeSubtext}>
                        {store.category} | {store.userDiscountPercent}% off | {store.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    )}
                  </View>
                  {isDesktop && (
                    <>
                      <Text style={[styles.cellText, { flex: 1.4 }]}>{store.category}</Text>
                      <Text style={[styles.cellText, { flex: 1, fontWeight: '700' }]}>{store.userDiscountPercent}%</Text>
                      <Text style={[styles.cellText, { flex: 1, fontWeight: '700', color: Colors.primary }]}>{store.platformCommissionPercent}%</Text>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.statusBadge, store.isActive ? styles.statusActive : styles.statusInactive]}>
                          <Text style={[styles.statusText, store.isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                            {store.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                    </>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => toggleMutation.mutate({ id: store._id, isActive: store.isActive })}
                    >
                      {store.isActive ? <EyeOff size={16} color="#f59e0b" /> : <Eye size={16} color="#10b981" />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditStore(store); setShowForm(true); }}>
                      <Edit2 size={16} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(store._id, store.name)}>
                      <Trash2 size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <StoreFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditStore(null); }}
        store={editStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', padding: Spacing.lg },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  pageTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtnWrap: { borderRadius: 10, overflow: 'hidden' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: '#e8ecf2', marginBottom: Spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },

  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 18, paddingHorizontal: 20, flex: 1, borderWidth: 1, borderColor: '#e8ecf2' },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },

  tableContainer: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e8ecf2', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F0F4F8', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  tableHeaderCell: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowInactive: { opacity: 0.6 },
  storeName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  storeSubtext: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cellText: { fontSize: 13, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#fef2f2' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusActiveText: { color: '#16a34a' },
  statusInactiveText: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 6, backgroundColor: '#F0F4F8' },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20 },
  modalActions: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: Colors.border },
  submitBtn: { flex: 2, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: Colors.text, fontWeight: '500', fontSize: 14 },

  groupLabel: { fontSize: 12, fontWeight: '800', color: Colors.primary, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 4, marginTop: 12 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, backgroundColor: '#fff' },
  note: { fontSize: 11, color: '#94a3b8', marginTop: 6 },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  catPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  catPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  catPillTextActive: { color: '#fff' },

  segmentRow: { flexDirection: 'row', gap: 0, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  segmentTextActive: { color: '#fff', fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 4 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#e2e8f0', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: Colors.primary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotActive: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 14, color: Colors.text },
});

export default AdminStoresScreen;
