import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
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
  Copy,
  X,
  Calendar,
  Percent,
  IndianRupee,
  Hash,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';
import { Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { MobileAdminNav } from '../../components/MobileAdminNav';

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

// ─── Helpers ────────────────────────────────────────────────────────

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n.toLocaleString();

function getStatus(c: Coupon): CouponStatus {
  if (!c.isActive) return 'inactive';
  if (new Date(c.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_STYLE: Record<CouponStatus, { bg: string; text: string; label: string }> = {
  active: { bg: '#dcfce7', text: '#16a34a', label: '● Active' },
  inactive: { bg: '#f1f5f9', text: '#94a3b8', label: '◉ Inactive' },
  expired: { bg: '#fee2e2', text: '#dc2626', label: '◉ Expired' },
};

// ─── Coupon Card ────────────────────────────────────────────────────

function CouponCard({ coupon, onToggle, onEdit, onDelete, onUsage }: {
  coupon: Coupon;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUsage: () => void;
}) {
  const status = getStatus(coupon);
  const style = STATUS_STYLE[status];
  const discountText = coupon.discountType === 'percent'
    ? `${coupon.discountValue}% OFF`
    : `₹${coupon.discountValue} OFF`;
  const usagePct = Math.min(100, Math.round((coupon.usedCount / coupon.usageLimit) * 100));

  return (
    <View style={s.card}>
      {/* Top: code + discount badge */}
      <View style={s.topRow}>
        <View style={s.codeBlock}>
          <Ticket size={16} color="#3b82f6" strokeWidth={2} />
          <Text style={s.codeTxt}>{coupon.code}</Text>
          <TouchableOpacity style={s.copyBtn} onPress={() => Alert.alert('Copied', `${coupon.code} copied`)}>
            <Copy size={13} color="#94a3b8" strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={[s.statusBadge, { backgroundColor: style.bg }]}>
          <Text style={[s.statusTxt, { color: style.text }]}>{style.label}</Text>
        </View>
      </View>

      {/* Discount + description */}
      <Text style={s.discount}>{discountText}</Text>
      <Text style={s.desc} numberOfLines={2}>{coupon.description}</Text>

      {/* Meta row */}
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>Min. order</Text>
          <Text style={s.metaVal}>₹{coupon.minOrderValue}</Text>
        </View>
        {coupon.maxDiscount ? (
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>Max. discount</Text>
            <Text style={s.metaVal}>₹{coupon.maxDiscount}</Text>
          </View>
        ) : null}
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>Expires</Text>
          <Text style={s.metaVal}>{formatDate(coupon.expiresAt)}</Text>
        </View>
      </View>

      {/* Usage progress */}
      <View style={s.usageBlock}>
        <View style={s.usageTop}>
          <Text style={s.usageLabel}>Usage</Text>
          <Text style={s.usageCount}>{coupon.usedCount} / {coupon.usageLimit}</Text>
        </View>
        <View style={s.progressTrack}>
          <LinearGradient
            colors={usagePct >= 100 ? ['#ef4444', '#f87171'] : usagePct >= 75 ? ['#f59e0b', '#fcd34d'] : Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.progressFill, { width: `${usagePct}%` as any }]}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={s.actionsRow}>
        <TouchableOpacity style={s.toggleBtn} onPress={onToggle}>
          <Text style={s.toggleBtnTxt}>{coupon.isActive ? 'Deactivate' : 'Activate'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onUsage}>
          <BarChart3 size={16} color="#3b82f6" strokeWidth={2} />
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

// ─── Create Coupon Modal (Figma 412-3532) ──────────────────────────

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

function CreateCouponModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Coupon, '_id' | 'usedCount'>) => void;
  submitting: boolean;
  initialData?: Coupon | null;
}) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [errMsg, setErrMsg] = useState('');

  // Sync form with initialData whenever modal opens
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

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrMsg('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={m.sheet}>
          {/* Header */}
          <View style={m.header}>
            <View>
              <Text style={m.title}>{isEdit ? 'Edit Coupon' : 'Create Coupon'}</Text>
              <Text style={m.subtitle}>{isEdit ? 'Update this promo code' : 'Add a new promo code'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={m.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">

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
            <View style={[m.inputRow, { alignItems: 'flex-start', minHeight: 72 }]}>
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

            {/* Discount Type toggle */}
            <Text style={m.label}>Discount Type <Text style={m.req}>*</Text></Text>
            <View style={m.typeToggle}>
              <TouchableOpacity
                style={[m.typeBtn, form.discountType === 'percent' && m.typeBtnActive]}
                onPress={() => update('discountType', 'percent')}
              >
                <Percent size={14} color={form.discountType === 'percent' ? '#fff' : '#64748b'} strokeWidth={2} />
                <Text style={[m.typeBtnTxt, form.discountType === 'percent' && m.typeBtnTxtActive]}>Percentage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.typeBtn, form.discountType === 'flat' && m.typeBtnActive]}
                onPress={() => update('discountType', 'flat')}
              >
                <IndianRupee size={14} color={form.discountType === 'flat' ? '#fff' : '#64748b'} strokeWidth={2} />
                <Text style={[m.typeBtnTxt, form.discountType === 'flat' && m.typeBtnTxtActive]}>Fixed ₹</Text>
              </TouchableOpacity>
            </View>

            {/* Discount Value */}
            <Text style={m.label}>
              Discount Value {form.discountType === 'percent' ? '(%)' : '(₹)'} <Text style={m.req}>*</Text>
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

            {/* Max Discount (only for percent) */}
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

            {/* 2-col row: Min order + Total usage limit */}
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

            {/* 2-col row: Per-user limit + Start date */}
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
                thumbColor={form.isActive ? '#22c55e' : '#F0F4F8'}
              />
            </View>

            {errMsg ? <Text style={m.errTxt}>{errMsg}</Text> : null}

            {/* Buttons */}
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.submitBtn, submitting && m.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={m.submitTxt}>{isEdit ? 'Update Coupon' : 'Create Coupon'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminCoupons = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => adminAPI.getCoupons(),
  });

  const coupons: Coupon[] = res?.data?.coupons ?? res?.coupons ?? res?.data ?? [];

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

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateCoupon(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
    onError: () => Alert.alert('Error', 'Failed to update coupon.'),
  });

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
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to create coupon.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Coupon, '_id' | 'usedCount'> }) =>
      adminAPI.updateCoupon(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      closeModal();
    },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to update coupon.'),
  });

  const handleSubmit = (data: Omit<Coupon, '_id' | 'usedCount'>) => {
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (c: Coupon) => {
    Alert.alert('Delete Coupon', `Delete "${c.code}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(c._id) },
    ]);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [coupons, search]);

  // Stats
  const activeCount = coupons.filter((c) => getStatus(c) === 'active').length;
  const expiredCount = coupons.filter((c) => getStatus(c) === 'expired').length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Shared admin header + section nav */}
        <MobileAdminNav active="AdminCoupons" />

        <View style={s.body}>
          {/* Title + Create */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle} numberOfLines={1}>Coupon Management</Text>
              <Text style={s.pageSub}>Create and manage discount codes</Text>
            </View>
            <TouchableOpacity onPress={openCreate} activeOpacity={0.85} style={s.addBtnWrap}>
              <LinearGradient
                colors={Gradient.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.addBtn}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text style={s.addBtnText}>Add</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search coupons by code or description..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SlidersHorizontal size={16} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Total Coupons</Text>
              <Text style={s.miniVal}>{coupons.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Active</Text>
              <Text style={[s.miniVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Expired</Text>
              <Text style={[s.miniVal, { color: '#ef4444' }]}>{expiredCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Redemptions</Text>
              <Text style={[s.miniVal, { color: '#3b82f6' }]}>{fmt(totalRedemptions)}</Text>
            </View>
          </View>

          {/* Coupon cards */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No coupons found</Text>
              <Text style={s.emptySub}>
                {search
                  ? 'Try a different search term.'
                  : 'Tap "+ Create Coupon" to add your first coupon.'}
              </Text>
            </View>
          ) : (
            filtered.map((c) => (
              <CouponCard
                key={c._id}
                coupon={c}
                onToggle={() => toggleMutation.mutate({ id: c._id, isActive: c.isActive })}
                onEdit={() => openEdit(c)}
                onDelete={() => handleDelete(c)}
                onUsage={() => nav.navigate('AdminCouponUsage', { couponId: c._id, couponCode: c.code })}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Coupon Modal */}
      <CreateCouponModal
        visible={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingCoupon}
      />
    </SafeAreaView>
  );
};

// ─── Page Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
  headerSub: { fontSize: 11, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  // Nav
  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontFamily: Fonts.bold },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Title
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#1e293b' },
  pageSub: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },
  addBtnWrap: { borderRadius: 10, overflow: 'hidden', flexShrink: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: {
    width: '48%' as any, flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  miniLabel: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#1e293b' },

  // Coupon card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#dbeafe', borderStyle: 'dashed',
  },
  codeTxt: { fontSize: 14, fontFamily: Fonts.extraBold, color: '#1e40af', letterSpacing: 1.5 },
  copyBtn: { padding: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusTxt: { fontSize: 11, fontFamily: Fonts.semiBold },

  discount: { fontSize: 17, fontFamily: Fonts.bold, color: '#22c55e', marginBottom: 2 },
  desc: { fontSize: 11, fontFamily: Fonts.regular, color: '#64748b', marginBottom: 12 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  metaItem: {},
  metaLabel: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaVal: { fontSize: 13, fontFamily: Fonts.bold, color: '#1e293b' },

  usageBlock: { marginBottom: 12 },
  usageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  usageLabel: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8' },
  usageCount: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#64748b' },
  progressTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: {
    flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center',
  },
  toggleBtnTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});

// ─── Modal Styles ───────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%' as any,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#1e293b' },
  subtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },

  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },

  label: { fontSize: 12, fontFamily: Fonts.bold, color: '#475569', marginBottom: 6, marginTop: 10 },
  req: { color: '#ef4444' },
  hint: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, minHeight: 46,
  },
  inputTxt: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b', paddingVertical: 10 },

  typeToggle: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#F0F4F8',
  },
  typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeBtnTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#64748b' },
  typeBtnTxtActive: { color: '#fff' },

  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  activeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0F4F8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  activeLabel: { fontSize: 13, fontFamily: Fonts.bold, color: '#1e293b' },
  activeHint: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },

  errTxt: { fontSize: 13, fontFamily: Fonts.regular, color: '#ef4444', marginTop: 12, textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff',
  },
  cancelTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#64748b' },
  submitBtn: {
    flex: 1.4, backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});
