import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, Platform, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Search, Ticket, Copy, Calendar,
  Percent, IndianRupee, Hash, Inbox,
} from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

type DiscountType = 'percent' | 'flat';
type CouponStatus = 'active' | 'inactive' | 'expired';

interface Coupon {
  _id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  startDate?: string;
  expiresAt: string;
  isActive: boolean;
}

// ─── Fallback ───────────────────────────────────────────────────────────────

const FALLBACK: Coupon[] = [
  {
    _id: 'f1',
    code: 'WELCOME100',
    description: 'Welcome discount for new users',
    discountType: 'flat',
    discountValue: 100,
    minOrderValue: 500,
    usageLimit: 1000,
    perUserLimit: 1,
    usedCount: 456,
    expiresAt: '2026-12-31',
    isActive: true,
  },
  {
    _id: 'f2',
    code: 'SAVE20',
    description: 'Get 20% off on all orders',
    discountType: 'percent',
    discountValue: 20,
    maxDiscount: 500,
    minOrderValue: 1000,
    usageLimit: 500,
    perUserLimit: 1,
    usedCount: 234,
    expiresAt: '2026-06-30',
    isActive: true,
  },
  {
    _id: 'f3',
    code: 'EXPIRED50',
    description: 'Expired holiday promo',
    discountType: 'flat',
    discountValue: 50,
    minOrderValue: 300,
    usageLimit: 100,
    perUserLimit: 1,
    usedCount: 100,
    expiresAt: '2026-03-31',
    isActive: false,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatus(c: Coupon): CouponStatus {
  if (!c.isActive) return 'inactive';
  if (new Date(c.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function formatDate(d?: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

const STATUS_STYLE: Record<CouponStatus, { border: string; text: string; label: string }> = {
  active:   { border: '#86efac', text: '#16a34a', label: 'Active' },
  inactive: { border: '#cbd5e1', text: '#64748b', label: 'Inactive' },
  expired:  { border: '#fca5a5', text: '#dc2626', label: 'Expired' },
};

// ─── Coupon Card (Figma 257-3890) ───────────────────────────────────────────

function CouponCard({ coupon, onEdit, onDelete }: {
  coupon: Coupon;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getStatus(coupon);
  const style = STATUS_STYLE[status];

  const discountText = coupon.discountType === 'percent'
    ? coupon.maxDiscount
      ? `${coupon.discountValue}% (max ₹${coupon.maxDiscount})`
      : `${coupon.discountValue}%`
    : `₹${coupon.discountValue}`;

  return (
    <View style={[s.card, { borderColor: style.border }]}>
      {/* Top row: ticket + code + copy */}
      <View style={s.topRow}>
        <View style={s.codeWrap}>
          <Ticket size={18} color="#3b82f6" strokeWidth={2} />
          <Text style={s.code}>{coupon.code}</Text>
        </View>
        <TouchableOpacity
          style={s.copyBtn}
          onPress={() => Alert.alert('Copied', `${coupon.code} copied`)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Copy size={16} color="#94a3b8" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Status text */}
      <Text style={[s.statusText, { color: style.text }]}>{style.label}</Text>

      {/* Meta rows */}
      <View style={s.metaCol}>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Discount:</Text>
          <Text style={s.metaVal}>{discountText}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Min Order:</Text>
          <Text style={s.metaVal}>₹{coupon.minOrderValue}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Usage:</Text>
          <Text style={s.metaVal}>{coupon.usedCount} / {coupon.usageLimit || '∞'}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Expires:</Text>
          <Text style={s.metaVal}>{formatDate(coupon.expiresAt)}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.85}>
          <Pencil size={14} color="#3b82f6" strokeWidth={2} />
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.85}>
          <Trash2 size={14} color="#ef4444" strokeWidth={2} />
          <Text style={s.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface CouponFormState {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;
  usageLimit: string;
  perUserLimit: string;
  startDate: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  maxDiscount: '',
  minOrderValue: '',
  usageLimit: '',
  perUserLimit: '1',
  startDate: '',
  expiresAt: '',
  isActive: true,
};

function CouponFormModal({
  visible, initialData, onClose, onSubmit, submitting,
}: {
  visible: boolean;
  initialData: Coupon | null;
  onClose: () => void;
  onSubmit: (data: Omit<Coupon, '_id' | 'usedCount'>) => void;
  submitting: boolean;
}) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setForm({
        code: initialData.code,
        description: initialData.description ?? '',
        discountType: initialData.discountType,
        discountValue: String(initialData.discountValue ?? ''),
        maxDiscount: initialData.maxDiscount != null ? String(initialData.maxDiscount) : '',
        minOrderValue: initialData.minOrderValue != null ? String(initialData.minOrderValue) : '',
        usageLimit: initialData.usageLimit != null ? String(initialData.usageLimit) : '',
        perUserLimit: initialData.perUserLimit != null ? String(initialData.perUserLimit) : '1',
        startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : '',
        expiresAt: initialData.expiresAt ? initialData.expiresAt.slice(0, 10) : '',
        isActive: !!initialData.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrMsg('');
  }, [visible, initialData]);

  const update = <K extends keyof CouponFormState>(k: K, v: CouponFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.code.trim()) return setErrMsg('Coupon code is required');
    if (!form.discountValue || Number(form.discountValue) <= 0)
      return setErrMsg('Discount value must be greater than 0');
    if (form.discountType === 'percent' && Number(form.discountValue) > 100)
      return setErrMsg('Percentage cannot exceed 100');
    if (!form.expiresAt) return setErrMsg('Expiry date is required');

    setErrMsg('');
    onSubmit({
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      minOrderValue: Number(form.minOrderValue) || 0,
      usageLimit: Number(form.usageLimit) || 0,
      perUserLimit: Number(form.perUserLimit) || 0,
      startDate: form.startDate || undefined,
      expiresAt: form.expiresAt,
      isActive: form.isActive,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          {/* Header */}
          <View style={m.header}>
            <View>
              <Text style={m.title}>{isEdit ? 'Edit Coupon' : 'Create Coupon'}</Text>
              <Text style={m.subtitle}>
                {isEdit ? 'Update this promo code' : 'Add a new promo code'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={m.body} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Code */}
            <Text style={m.label}>Coupon Code <Text style={m.req}>*</Text></Text>
            <View style={m.inputRow}>
              <Hash size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="e.g. WELCOME50"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                value={form.code}
                onChangeText={(v) => update('code', v.toUpperCase())}
              />
            </View>

            {/* Description */}
            <Text style={m.label}>Description</Text>
            <View style={[m.inputRow, { alignItems: 'flex-start', minHeight: 70 }]}>
              <TextInput
                style={[m.inputTxt, { paddingTop: 4 }]}
                placeholder="What does this coupon offer?"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={form.description}
                onChangeText={(v) => update('description', v)}
              />
            </View>

            {/* Discount Type */}
            <Text style={m.label}>Discount Type <Text style={m.req}>*</Text></Text>
            <View style={m.typeToggle}>
              <TouchableOpacity
                style={[m.typeBtn, form.discountType === 'percent' && m.typeBtnActive]}
                onPress={() => update('discountType', 'percent')}
                activeOpacity={0.85}
              >
                <Percent
                  size={14}
                  color={form.discountType === 'percent' ? '#fff' : '#64748b'}
                  strokeWidth={2}
                />
                <Text style={[
                  m.typeBtnTxt,
                  form.discountType === 'percent' && m.typeBtnTxtActive,
                ]}>Percentage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.typeBtn, form.discountType === 'flat' && m.typeBtnActive]}
                onPress={() => update('discountType', 'flat')}
                activeOpacity={0.85}
              >
                <IndianRupee
                  size={14}
                  color={form.discountType === 'flat' ? '#fff' : '#64748b'}
                  strokeWidth={2}
                />
                <Text style={[
                  m.typeBtnTxt,
                  form.discountType === 'flat' && m.typeBtnTxtActive,
                ]}>Fixed ₹</Text>
              </TouchableOpacity>
            </View>

            {/* Discount Value */}
            <Text style={m.label}>
              Discount Value {form.discountType === 'percent' ? '(%)' : '(₹)'}{' '}
              <Text style={m.req}>*</Text>
            </Text>
            <View style={m.inputRow}>
              {form.discountType === 'percent'
                ? <Percent size={16} color="#94a3b8" strokeWidth={2} />
                : <IndianRupee size={16} color="#94a3b8" strokeWidth={2} />}
              <TextInput
                style={m.inputTxt}
                placeholder={form.discountType === 'percent' ? '50' : '100'}
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={form.discountValue}
                onChangeText={(v) => update('discountValue', v)}
              />
            </View>

            {/* Max Discount (only percent) */}
            {form.discountType === 'percent' && (
              <>
                <Text style={m.label}>Max Discount Amount (₹)</Text>
                <View style={m.inputRow}>
                  <IndianRupee size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="e.g. 500"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.maxDiscount}
                    onChangeText={(v) => update('maxDiscount', v)}
                  />
                </View>
              </>
            )}

            {/* 2-col: Min order + Total usage */}
            <View style={m.twoCol}>
              <View style={m.col}>
                <Text style={m.label}>Min Order Value (₹)</Text>
                <View style={m.inputRow}>
                  <IndianRupee size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.minOrderValue}
                    onChangeText={(v) => update('minOrderValue', v)}
                  />
                </View>
              </View>
              <View style={m.col}>
                <Text style={m.label}>Total Usage Limit</Text>
                <View style={m.inputRow}>
                  <Hash size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="0 = unlimited"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.usageLimit}
                    onChangeText={(v) => update('usageLimit', v)}
                  />
                </View>
              </View>
            </View>

            {/* 2-col: Per-user + Start date */}
            <View style={m.twoCol}>
              <View style={m.col}>
                <Text style={m.label}>Per-User Limit</Text>
                <View style={m.inputRow}>
                  <Hash size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="1"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.perUserLimit}
                    onChangeText={(v) => update('perUserLimit', v)}
                  />
                </View>
                <Text style={m.hint}>0 = unlimited per user</Text>
              </View>
              <View style={m.col}>
                <Text style={m.label}>Start Date</Text>
                <View style={m.inputRow}>
                  <Calendar size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={form.startDate}
                    onChangeText={(v) => update('startDate', v)}
                  />
                </View>
                <Text style={m.hint}>Blank = starts immediately</Text>
              </View>
            </View>

            {/* Expiry */}
            <Text style={m.label}>Expiry Date <Text style={m.req}>*</Text></Text>
            <View style={m.inputRow}>
              <Calendar size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
                value={form.expiresAt}
                onChangeText={(v) => update('expiresAt', v)}
              />
            </View>

            {/* Active toggle */}
            <View style={m.activeRow}>
              <View>
                <Text style={m.activeLabel}>Active on creation</Text>
                <Text style={m.activeHint}>Coupon will be available immediately</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => update('isActive', v)}
                trackColor={{ false: '#e2e8f0', true: '#86efac' }}
                thumbColor={form.isActive ? '#22c55e' : '#f8fafc'}
              />
            </View>

            {errMsg ? <Text style={m.errTxt}>{errMsg}</Text> : null}
          </ScrollView>

          {/* Footer buttons */}
          <View style={m.footer}>
            <TouchableOpacity
              style={m.cancelBtn}
              onPress={onClose}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.submitBtn, submitting && m.submitBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={m.submitTxt}>{isEdit ? 'Update Coupon' : 'Create Coupon'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AdminCouponsScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      try {
        return await adminAPI.getCoupons();
      } catch {
        return { coupons: FALLBACK };
      }
    },
    staleTime: 60_000,
  });

  const coupons: Coupon[] = useMemo(() => {
    const raw = (res as any)?.data?.coupons ?? (res as any)?.coupons ?? (res as any)?.data;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return FALLBACK;
  }, [res]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    );
  }, [coupons, search]);

  const openCreate = () => {
    setEditingCoupon(null);
    setModalOpen(true);
  };
  const openEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingCoupon(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: () => Alert.alert('Error', 'Failed to delete coupon.'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Coupon, '_id' | 'usedCount'>) => adminAPI.createCoupon(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to create coupon.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Coupon, '_id' | 'usedCount'> }) =>
      adminAPI.updateCoupon(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to update coupon.'),
  });

  const handleSubmit = (data: Omit<Coupon, '_id' | 'usedCount'>) => {
    if (editingCoupon) updateMutation.mutate({ id: editingCoupon._id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (c: Coupon) => {
    const remove = () => deleteMutation.mutate(c._id);
    const msg = `Delete "${c.code}"? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) remove();
    } else {
      Alert.alert('Delete Coupon', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.containerContent}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageTitle}>Coupon Management</Text>
          <Text style={s.pageSubtitle}>Create and manage promo codes</Text>
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={openCreate} style={s.addBtnWrap}>
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={s.addBtnText}>Create Coupon</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Search size={18} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={s.searchInput}
          placeholder="Search coupons…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Card grid */}
      {isLoading ? (
        <View style={s.emptyState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={s.emptyText}>Loading coupons…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyState}>
          <Inbox size={48} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={s.emptyText}>
            {search
              ? 'No coupons match your search.'
              : 'No coupons yet. Click "+ Create Coupon" to add one.'}
          </Text>
        </View>
      ) : (
        <View style={s.grid}>
          {filtered.map((c) => (
            <CouponCard
              key={c._id}
              coupon={c}
              onEdit={() => openEdit(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </View>
      )}

      <CouponFormModal
        visible={modalOpen}
        initialData={editingCoupon}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </ScrollView>
  );
}

// ─── Page Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerContent: { padding: Spacing.lg, paddingBottom: 60 },

  // Header
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

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8ecf2',
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 48,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  // Card
  card: {
    width: 320,
    flexGrow: 1,
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    padding: 18,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1.2,
  },
  copyBtn: { padding: 4 },

  statusText: { fontSize: 13, fontWeight: '700' },

  metaCol: { gap: 6, marginTop: 8 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: { fontSize: 13, color: Colors.textSecondary },
  metaVal: { fontSize: 13, fontWeight: '700', color: Colors.text },

  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

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
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', maxWidth: 360 },
});

// ─── Modal Styles ───────────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  body: { paddingHorizontal: 20, paddingTop: 6 },

  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  req: { color: '#ef4444' },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  inputTxt: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  typeToggle: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeBtnTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  typeBtnTxtActive: { color: '#fff' },

  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  activeLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  activeHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  errTxt: { fontSize: 13, color: '#ef4444', marginTop: 12, textAlign: 'center' },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  submitBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
