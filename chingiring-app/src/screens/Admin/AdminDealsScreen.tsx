import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Dimensions, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Search, SlidersHorizontal } from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { categoriesAPI } from '../../api/deals';
import { ImageUploader } from '../../components/ImageUploader';

// ─── Add/Edit Deal Modal ────────────────────────────────────────────────────

export function DealFormModal({ visible, onClose, deal, categories }: {
  visible: boolean;
  onClose: () => void;
  deal?: any;
  categories: any[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!deal;

  const [form, setForm] = useState({
    title: deal?.title || '',
    brand: deal?.brand || '',
    category: deal?.category?._id || deal?.category || '',
    cashbackType: deal?.cashbackType || 'percentage',
    cashbackPercent: deal?.cashbackPercent?.toString() || '',
    flatCashback: deal?.flatCashback?.toString() || '',
    expiresAt: deal?.expiresAt ? new Date(deal.expiresAt).toISOString().split('T')[0] : '',
    affiliateUrl: deal?.affiliateUrl || '',
    description: deal?.description || '',
    imageUrl: deal?.imageUrl || '',
    lockPeriodDays: deal?.lockPeriodDays?.toString() || '30',
    coinsReward: deal?.coinsReward?.toString() || '',
    tags: deal?.tags?.join(', ') || '',
    termsAndConditions: deal?.termsAndConditions || '',
    isFeatured: deal?.isFeatured || false,
    isTrending: deal?.isTrending || false,
    viaCuelinks: deal?.viaCuelinks || false,
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) return adminAPI.updateDeal(deal._id, data);
      return adminAPI.createDeal(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deals'] });
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to save deal');
    },
  });

  const handleSubmit = () => {
    const needsCashbackPercent = form.cashbackType === 'percentage' && !form.cashbackPercent;
    const needsFlatCashback = form.cashbackType === 'flat' && !form.flatCashback;
    if (!form.title || !form.brand || needsCashbackPercent || needsFlatCashback || !form.affiliateUrl || !form.expiresAt) {
      Alert.alert('Validation', 'Please fill all required fields');
      return;
    }
    mutation.mutate({
      ...form,
      cashbackType: form.cashbackType,
      cashbackPercent: form.cashbackType === 'percentage' ? parseFloat(form.cashbackPercent) : 0,
      flatCashback: form.cashbackType === 'flat' ? parseFloat(form.flatCashback) : 0,
      lockPeriodDays: parseInt(form.lockPeriodDays) || 30,
      coinsReward: form.coinsReward ? parseInt(form.coinsReward, 10) : 0,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      category: form.category || undefined,
    });
  };

  const screenWidth = Dimensions.get('window').width;
  const modalWidth = screenWidth >= 768 ? 520 : screenWidth - 40;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: modalWidth }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Deal' : 'Add New Deal'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Deal Title */}
            <Text style={styles.fieldLabel}>Deal Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Myntra Fashion Sale - Up to 70% Off"
              placeholderTextColor="#94a3b8"
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
            />

            {/* Merchant + Category row */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Merchant *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Myntra"
                  placeholderTextColor="#94a3b8"
                  value={form.brand}
                  onChangeText={(v) => setForm({ ...form, brand: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Category</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text style={{ fontSize: 14, color: form.category ? Colors.text : '#94a3b8' }}>
                    {form.category
                      ? categories.find((c: any) => c._id === form.category)?.name || 'Select category'
                      : 'Select category'}
                  </Text>
                </TouchableOpacity>
                {showCategoryPicker && categories.length > 0 && (
                  <View style={styles.dropdown}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => { setForm({ ...form, category: '' }); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.dropdownText, { color: '#94a3b8' }]}>None</Text>
                    </TouchableOpacity>
                    {categories.map((cat: any) => (
                      <TouchableOpacity
                        key={cat._id}
                        style={[
                          styles.dropdownItem,
                          form.category === cat._id && styles.dropdownItemActive,
                        ]}
                        onPress={() => { setForm({ ...form, category: cat._id }); setShowCategoryPicker(false); }}
                      >
                        <Text style={[
                          styles.dropdownText,
                          form.category === cat._id && { color: Colors.primary, fontWeight: '600' },
                        ]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Cashback Type */}
            <Text style={styles.fieldLabel}>Cashback Type *</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, form.cashbackType === 'percentage' && styles.segmentBtnActive]}
                onPress={() => setForm({ ...form, cashbackType: 'percentage' })}
              >
                <Text style={[styles.segmentText, form.cashbackType === 'percentage' && styles.segmentTextActive]}>
                  Percentage (%)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, form.cashbackType === 'flat' && styles.segmentBtnActive]}
                onPress={() => setForm({ ...form, cashbackType: 'flat' })}
              >
                <Text style={[styles.segmentText, form.cashbackType === 'flat' && styles.segmentTextActive]}>
                  Flat Amount ({'\u20B9'})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cashback Value + Expiry row */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                {form.cashbackType === 'percentage' ? (
                  <>
                    <Text style={styles.fieldLabel}>Cashback % *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="8"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={form.cashbackPercent}
                      onChangeText={(v) => setForm({ ...form, cashbackPercent: v })}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Flat Cashback ({'\u20B9'}) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="100"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={form.flatCashback}
                      onChangeText={(v) => setForm({ ...form, flatCashback: v })}
                    />
                  </>
                )}
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Expiry Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={form.expiresAt}
                  onChangeText={(v) => setForm({ ...form, expiresAt: v })}
                />
              </View>
            </View>

            {/* Affiliate Link */}
            <Text style={styles.fieldLabel}>Affiliate Link *</Text>
            <TextInput
              style={styles.input}
              placeholder="https://admitad.com/..."
              placeholderTextColor="#94a3b8"
              value={form.affiliateUrl}
              onChangeText={(v) => setForm({ ...form, affiliateUrl: v })}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Deal description..."
              placeholderTextColor="#94a3b8"
              multiline
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
            />

            {/* Image — Cloudinary upload (web), URL fallback */}
            <Text style={styles.fieldLabel}>Image</Text>
            <ImageUploader
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              folder="chingiringi/deals"
            />

            {/* Coins Reward — coins the user earns per purchase via this deal. */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Coins Reward (per purchase)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 50"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.coinsReward}
                  onChangeText={(v) => setForm({ ...form, coinsReward: v.replace(/[^0-9]/g, '') })}
                />
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Leave blank to fall back to system rate (commission × 10).
                </Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Lock Period (days)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.lockPeriodDays}
                  onChangeText={(v) => setForm({ ...form, lockPeriodDays: v })}
                />
              </View>
            </View>

            {/* Tags row (kept separate) */}
            <View style={styles.fieldRow}>
              <View style={[styles.fieldHalf, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Tags (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="fashion, sale"
                  placeholderTextColor="#94a3b8"
                  value={form.tags}
                  onChangeText={(v) => setForm({ ...form, tags: v })}
                />
              </View>
            </View>

            {/* Terms */}
            <Text style={styles.fieldLabel}>Terms & Conditions</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Terms..."
              placeholderTextColor="#94a3b8"
              multiline
              value={form.termsAndConditions}
              onChangeText={(v) => setForm({ ...form, termsAndConditions: v })}
            />

            {/* Featured toggle */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForm({ ...form, isFeatured: !form.isFeatured })}
            >
              <View style={[styles.toggle, form.isFeatured && styles.toggleActive]}>
                <View style={[styles.toggleDot, form.isFeatured && styles.toggleDotActive]} />
              </View>
              <Text style={styles.toggleLabel}>Featured Deal</Text>
            </TouchableOpacity>

            {/* Trending toggle — surfaces this deal in the "Trending Now" row
                on the user Deals page (plan C). Independent of Featured. */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForm({ ...form, isTrending: !form.isTrending })}
            >
              <View style={[styles.toggle, form.isTrending && styles.toggleActive]}>
                <View style={[styles.toggleDot, form.isTrending && styles.toggleDotActive]} />
              </View>
              <Text style={styles.toggleLabel}>Mark as Trending</Text>
            </TouchableOpacity>

            {/* Cuelinks toggle — at click time backend wraps the raw merchant
                URL in linksredirect.com using our Cuelinks publisher ID.
                Turn ON for Myntra, Flipkart, Meesho, Ajio, Nykaa. Leave OFF
                for direct Amazon deals. */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForm({ ...form, viaCuelinks: !form.viaCuelinks })}
            >
              <View style={[styles.toggle, form.viaCuelinks && styles.toggleActive]}>
                <View style={[styles.toggleDot, form.viaCuelinks && styles.toggleDotActive]} />
              </View>
              <Text style={styles.toggleLabel}>Route via Cuelinks</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{isEdit ? 'Update Deal' : 'Create Deal'}</Text>
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

// ─── Deals List Screen ──────────────────────────────────────────────────────

export function AdminDealsScreen() {
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState<any>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deals'],
    queryFn: () => adminAPI.getDeals({ limit: 50 }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getCategories(),
  });

  const categories = categoriesData?.data?.categories || categoriesData?.data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteDeal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'deals'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateDeal(id, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'deals'] }),
  });

  const deals = data?.data?.deals || [];
  const filteredDeals = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d: any) =>
      (d.title?.toLowerCase().includes(q)) ||
      (d.brand?.toLowerCase().includes(q)) ||
      (d.category?.name?.toLowerCase().includes(q)),
    );
  }, [deals, search]);

  const screenWidth = Dimensions.get('window').width;
  const isDesktop = screenWidth >= 768;

  const handleDelete = (id: string, title: string) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${title}"?`)) deleteMutation.mutate(id);
    } else {
      Alert.alert('Delete Deal', `Delete "${title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Deals</Text>
          <Text style={styles.pageSubtitle}>Manage cashback deals and promotions</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditDeal(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add New Deal</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Search size={16} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search deals by title, brand or category..."
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

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Deals</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>
            {data?.data?.total ?? deals.length}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Deals</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>
            {deals.filter((d: any) => d.isActive).length}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Clicks</Text>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>
            {deals.reduce((s: number, d: any) => s + (d.clicks ?? 0), 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Conversions</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>
            {deals.reduce((s: number, d: any) => s + (d.conversions ?? 0), 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Table */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView>
          <View style={styles.tableContainer}>
            {/* Table Header */}
            {isDesktop && (
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Deal</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Brand</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Cashback</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Performance</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Expires</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Actions</Text>
              </View>
            )}

            {filteredDeals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {search.trim()
                    ? `No deals match "${search}".`
                    : 'No deals yet. Click "Add New Deal" to create one.'}
                </Text>
              </View>
            ) : (
              filteredDeals.map((deal: any, idx: number) => (
                <View
                  key={deal._id}
                  style={[
                    styles.tableRow,
                    idx === filteredDeals.length - 1 && styles.tableRowLast,
                    !deal.isActive && styles.tableRowInactive,
                  ]}
                >
                <View style={isDesktop ? { flex: 3 } : { flex: 1 }}>
                  <Text style={styles.dealTitle} numberOfLines={1}>{deal.title}</Text>
                  {!isDesktop && (
                    <Text style={styles.dealSubtext}>
                      {deal.brand} | {deal.cashbackType === 'flat' ? `\u20B9${deal.flatCashback}` : `${deal.cashbackPercent}%`} | {deal.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  )}
                </View>
                {isDesktop && (
                  <>
                    <Text style={[styles.cellText, { flex: 1.5 }]}>{deal.brand}</Text>
                    <Text style={[styles.cellText, { flex: 1 }]}>
                      {deal.cashbackType === 'flat' ? `\u20B9${deal.flatCashback}` : `${deal.cashbackPercent}%`}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.statusBadge, deal.isActive ? styles.statusActive : styles.statusInactive]}>
                        <Text style={[styles.statusText, deal.isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                          {deal.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1.6 }}>
                      <Text style={styles.perfLine}>
                        <Text style={[styles.perfNumber, { color: '#3b82f6' }]}>
                          {(deal.clicks ?? 0).toLocaleString()}
                        </Text>
                        <Text style={styles.perfLabel}> clicks</Text>
                      </Text>
                      <Text style={styles.perfLine}>
                        <Text style={[styles.perfNumber, { color: '#7c3aed' }]}>
                          {(deal.conversions ?? 0).toLocaleString()}
                        </Text>
                        <Text style={styles.perfLabel}> conversions</Text>
                      </Text>
                    </View>
                    <Text style={[styles.cellText, { flex: 1.5 }]}>
                      {deal.expiresAt ? new Date(deal.expiresAt).toLocaleDateString() : '—'}
                    </Text>
                  </>
                )}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => toggleMutation.mutate({ id: deal._id, isActive: deal.isActive })}
                  >
                    {deal.isActive ? <EyeOff size={16} color="#f59e0b" /> : <Eye size={16} color="#10b981" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => { setEditDeal(deal); setShowForm(true); }}
                  >
                    <Edit2 size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(deal._id, deal.title)}
                  >
                    <Trash2 size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <DealFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditDeal(null); }}
        deal={editDeal}
        categories={categories}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FF', padding: Spacing.lg },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  pageTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtnWrap: { borderRadius: 10, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
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

  // Stats cards
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },

  // Table
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F5F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#e8ecf2',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowInactive: { opacity: 0.6 },
  perfLine: { fontSize: 13, lineHeight: 18 },
  perfNumber: { fontWeight: '700' },
  perfLabel: { color: Colors.textSecondary, fontSize: 12 },
  dealTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dealSubtext: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cellText: { fontSize: 13, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start' },
  statusActive: { backgroundColor: '#dcfce7' },
  statusInactive: { backgroundColor: '#fef2f2' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusActiveText: { color: '#16a34a' },
  statusInactiveText: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, borderRadius: 6, backgroundColor: '#F5F8FF' },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.text, fontWeight: '500', fontSize: 14 },

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 4, marginTop: 12 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },
  // Dropdown
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownText: { fontSize: 14, color: Colors.text },

  // Segment control
  segmentRow: { flexDirection: 'row', gap: 0, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  segmentTextActive: { color: '#fff', fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 8 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 14, color: Colors.text },
});
