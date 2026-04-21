import React, { useState, useMemo, useEffect } from 'react';
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
  Link2,
  MapPin,
  MonitorPlay,
  X,
  SlidersHorizontal,
  Hash,
  Calendar,
  ExternalLink,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../api/admin';
import { Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';

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

type LinkType = 'deal' | 'category' | 'url';
type Position = 'hero' | 'sidebar' | 'inline';

interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: LinkType;
  linkValue: string;
  position: Position;
  isActive: boolean;
  sortOrder?: number;
  startsAt?: string;
  expiresAt?: string;
}

// ─── Fallback ───────────────────────────────────────────────────────

const FALLBACK: Banner[] = [
  {
    _id: '1',
    title: 'Mega Sale — Up to 50% Off',
    subtitle: 'Shop top brands and earn cashback',
    imageUrl: '',
    linkType: 'category',
    linkValue: 'electronics',
    position: 'hero',
    isActive: true,
    sortOrder: 1,
  },
  {
    _id: '2',
    title: 'Refer & Earn ₹500',
    subtitle: 'Invite friends and grow your wallet',
    imageUrl: '',
    linkType: 'url',
    linkValue: '/referral',
    position: 'inline',
    isActive: true,
    sortOrder: 2,
  },
  {
    _id: '3',
    title: 'New Arrivals in Fashion',
    subtitle: 'Latest trends with 10% cashback',
    imageUrl: '',
    linkType: 'category',
    linkValue: 'fashion',
    position: 'sidebar',
    isActive: false,
    sortOrder: 3,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

const POSITION_COLOR: Record<Position, { bg: string; text: string }> = {
  hero:    { bg: '#eff6ff', text: '#3b82f6' },
  inline:  { bg: '#f0fdf4', text: '#16a34a' },
  sidebar: { bg: '#faf5ff', text: '#7c3aed' },
};

const LINK_LABEL: Record<LinkType, string> = {
  deal: 'Deal',
  category: 'Category',
  url: 'URL',
};

// ─── Banner Card ─────────────────────────────────────────────────────

function BannerCard({
  banner,
  onToggle,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pos = POSITION_COLOR[banner.position];

  return (
    <View style={s.card}>
      {/* Image preview */}
      <View style={s.cardImageArea}>
        {banner.imageUrl ? (
          <Image source={{ uri: banner.imageUrl }} style={s.cardImage} resizeMode="cover" />
        ) : (
          <View style={s.cardImagePlaceholder}>
            <MonitorPlay size={36} color="#475569" strokeWidth={1.5} />
            <Text style={s.placeholderTxt}>No image uploaded</Text>
          </View>
        )}
        {/* Status badge overlaid */}
        <View style={[s.overlayBadge, banner.isActive ? s.overlayActive : s.overlayInactive]}>
          <Text style={[s.overlayBadgeText, banner.isActive ? s.overlayActiveText : s.overlayInactiveText]}>
            {banner.isActive ? '● Active' : '◉ Inactive'}
          </Text>
        </View>
        {/* Sort order */}
        {banner.sortOrder !== undefined && (
          <View style={s.sortBadge}>
            <Text style={s.sortBadgeText}>#{banner.sortOrder}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{banner.title}</Text>
        <Text style={s.cardSubtitle} numberOfLines={1}>{banner.subtitle}</Text>

        {/* Pills */}
        <View style={s.tagsRow}>
          <View style={[s.pill, { backgroundColor: pos.bg }]}>
            <MapPin size={10} color={pos.text} strokeWidth={2} />
            <Text style={[s.pillText, { color: pos.text }]}>
              {banner.position.charAt(0).toUpperCase() + banner.position.slice(1)}
            </Text>
          </View>
          <View style={s.pillNeutral}>
            <Link2 size={10} color="#64748b" strokeWidth={2} />
            <Text style={s.pillNeutralText} numberOfLines={1}>
              {LINK_LABEL[banner.linkType]}: {banner.linkValue}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.toggleBtn} onPress={onToggle} activeOpacity={0.8}>
            <Text style={s.toggleBtnText}>{banner.isActive ? 'Deactivate' : 'Activate'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={onEdit}>
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

// ─── Banner Form Modal ───────────────────────────────────────────────

interface BannerFormState {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: LinkType;
  linkValue: string;
  position: Position;
  sortOrder: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: BannerFormState = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkType: 'url',
  linkValue: '',
  position: 'hero',
  sortOrder: '',
  startsAt: '',
  expiresAt: '',
  isActive: true,
};

function BannerModal({
  visible,
  onClose,
  onSubmit,
  submitting,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Banner, '_id'>) => void;
  submitting: boolean;
  initialData?: Banner | null;
}) {
  const isEdit = !!initialData;
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setForm({
        title: initialData.title ?? '',
        subtitle: initialData.subtitle ?? '',
        imageUrl: initialData.imageUrl ?? '',
        linkType: initialData.linkType ?? 'url',
        linkValue: initialData.linkValue ?? '',
        position: initialData.position ?? 'hero',
        sortOrder: initialData.sortOrder != null ? String(initialData.sortOrder) : '',
        startsAt: initialData.startsAt ? initialData.startsAt.slice(0, 10) : '',
        expiresAt: initialData.expiresAt ? initialData.expiresAt.slice(0, 10) : '',
        isActive: !!initialData.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrMsg('');
  }, [visible, initialData]);

  const update = <K extends keyof BannerFormState>(k: K, v: BannerFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) return setErrMsg('Banner title is required');
    setErrMsg('');
    onSubmit({
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      linkType: form.linkType,
      linkValue: form.linkValue.trim(),
      position: form.position,
      sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
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
              <Text style={m.title}>{isEdit ? 'Edit Banner' : 'Add Banner'}</Text>
              <Text style={m.subtitle}>{isEdit ? 'Update this banner' : 'Create a new banner'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={m.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <Text style={m.label}>Banner Title <Text style={m.req}>*</Text></Text>
            <View style={m.inputRow}>
              <MonitorPlay size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="e.g. Mega Sale — Up to 50% Off"
                placeholderTextColor="#9ca3af"
                value={form.title}
                onChangeText={(v) => update('title', v)}
              />
            </View>

            {/* Subtitle */}
            <Text style={m.label}>Subtitle</Text>
            <View style={m.inputRow}>
              <TextInput
                style={m.inputTxt}
                placeholder="Short description shown below title"
                placeholderTextColor="#9ca3af"
                value={form.subtitle}
                onChangeText={(v) => update('subtitle', v)}
              />
            </View>

            {/* Image URL */}
            <Text style={m.label}>Image URL</Text>
            <View style={m.inputRow}>
              <ImageIcon size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="https://..."
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="url"
                value={form.imageUrl}
                onChangeText={(v) => update('imageUrl', v)}
              />
            </View>

            {/* Position */}
            <Text style={m.label}>Position <Text style={m.req}>*</Text></Text>
            <View style={m.threeToggle}>
              {(['hero', 'inline', 'sidebar'] as Position[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[m.typeBtn, form.position === p && m.typeBtnActive]}
                  onPress={() => update('position', p)}
                >
                  <Text style={[m.typeBtnTxt, form.position === p && m.typeBtnTxtActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={m.hint}>Hero = main carousel · Inline = between content · Sidebar = side rail</Text>

            {/* Link Type */}
            <Text style={m.label}>Link Type</Text>
            <View style={m.threeToggle}>
              {(['url', 'category', 'deal'] as LinkType[]).map((lt) => (
                <TouchableOpacity
                  key={lt}
                  style={[m.typeBtn, form.linkType === lt && m.typeBtnActive]}
                  onPress={() => update('linkType', lt)}
                >
                  <Text style={[m.typeBtnTxt, form.linkType === lt && m.typeBtnTxtActive]}>
                    {lt.charAt(0).toUpperCase() + lt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Link Value */}
            <Text style={m.label}>
              Link Value
              <Text style={m.labelHint}>
                {form.linkType === 'url' ? ' (full URL)' : form.linkType === 'category' ? ' (category slug)' : ' (deal ID)'}
              </Text>
            </Text>
            <View style={m.inputRow}>
              <ExternalLink size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder={
                  form.linkType === 'url' ? 'https://...' :
                  form.linkType === 'category' ? 'electronics' : 'deal-id'
                }
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                value={form.linkValue}
                onChangeText={(v) => update('linkValue', v)}
              />
            </View>

            {/* 2-col: Sort order + (spacer) */}
            <View style={m.twoCol}>
              <View style={m.col}>
                <Text style={m.label}>Sort Order</Text>
                <View style={m.inputRow}>
                  <Hash size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="1"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    value={form.sortOrder}
                    onChangeText={(v) => update('sortOrder', v)}
                  />
                </View>
                <Text style={m.hint}>Lower = shown first</Text>
              </View>
              <View style={m.col}>
                <Text style={m.label}>Starts At</Text>
                <View style={m.inputRow}>
                  <Calendar size={16} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={m.inputTxt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={form.startsAt}
                    onChangeText={(v) => update('startsAt', v)}
                  />
                </View>
                <Text style={m.hint}>Blank = now</Text>
              </View>
            </View>

            {/* Expires At */}
            <Text style={m.label}>Expires At</Text>
            <View style={m.inputRow}>
              <Calendar size={16} color="#94a3b8" strokeWidth={2} />
              <TextInput
                style={m.inputTxt}
                placeholder="YYYY-MM-DD (blank = never)"
                placeholderTextColor="#9ca3af"
                value={form.expiresAt}
                onChangeText={(v) => update('expiresAt', v)}
              />
            </View>

            {/* Active toggle */}
            <View style={m.activeRow}>
              <View>
                <Text style={m.activeLabel}>{isEdit ? 'Active' : 'Active on creation'}</Text>
                <Text style={m.activeHint}>Banner will appear to users immediately</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => update('isActive', v)}
                trackColor={{ false: '#e2e8f0', true: '#86efac' }}
                thumbColor={form.isActive ? '#22c55e' : '#f8fafc'}
              />
            </View>

            {errMsg ? <Text style={m.errTxt}>{errMsg}</Text> : null}

            {/* Buttons */}
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.submitBtnWrap, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={Gradient.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={m.submitBtn}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={m.submitTxt}>{isEdit ? 'Update Banner' : 'Add Banner'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminBanners = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // NOTE: banner GET is public at /api/banners — admin manages via same route for now
  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => adminAPI.getBanners(),
  });

  const banners: Banner[] = res?.data?.banners ?? res?.banners ?? res?.data ?? FALLBACK;

  const openCreate = () => { setEditingBanner(null); setModalOpen(true); };
  const openEdit   = (b: Banner) => { setEditingBanner(b); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingBanner(null); };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminAPI.updateBanner(id, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: () => Alert.alert('Error', 'Failed to update banner status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteBanner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
    onError: () => Alert.alert('Error', 'Failed to delete banner.'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Banner, '_id'>) => adminAPI.createBanner(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); closeModal(); },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to create banner.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Banner, '_id'> }) =>
      adminAPI.updateBanner(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); closeModal(); },
    onError: (err: any) => Alert.alert('Error', err.message || 'Failed to update banner.'),
  });

  const handleSubmit = (data: Omit<Banner, '_id'>) => {
    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (banner: Banner) => {
    Alert.alert(
      'Delete Banner',
      `Delete "${banner.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(banner._id) },
      ],
    );
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return banners;
    const q = search.toLowerCase();
    return banners.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.subtitle?.toLowerCase().includes(q) ||
        b.position.toLowerCase().includes(q),
    );
  }, [banners, search]);

  const activeCount = banners.filter((b) => b.isActive).length;
  const heroCount   = banners.filter((b) => b.position === 'hero').length;
  const inlineCount = banners.filter((b) => b.position === 'inline').length;

  if (isLoading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.navScroll}
          contentContainerStyle={s.navContent}
        >
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'AdminBanners';
            return (
              <TouchableOpacity
                key={item.key}
                style={[s.navTab, active && s.navTabActive]}
                onPress={() => { if (!active) nav.navigate(item.key); }}
              >
                <item.icon size={16} color={active ? '#3b82f6' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
                <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.body}>
          {/* Title + Add */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.pageTitle}>Banner Management</Text>
              <Text style={s.pageSub}>Manage homepage and promotional banners</Text>
            </View>
            <TouchableOpacity onPress={openCreate} activeOpacity={0.85} style={s.addBtnWrap}>
              <LinearGradient
                colors={Gradient.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.addBtn}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text style={s.addBtnText}>Add Banner</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search banners by title or position..."
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
              <Text style={s.miniLabel}>Total Banners</Text>
              <Text style={s.miniVal}>{banners.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Active</Text>
              <Text style={[s.miniVal, { color: '#22c55e' }]}>{activeCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Hero Banners</Text>
              <Text style={[s.miniVal, { color: '#3b82f6' }]}>{heroCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Inline Banners</Text>
              <Text style={[s.miniVal, { color: '#7c3aed' }]}>{inlineCount}</Text>
            </View>
          </View>

          {/* Banner cards */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No banners found</Text>
              <Text style={s.emptySub}>
                {search ? 'Try a different search term.' : 'Tap "+ Add Banner" to create your first banner.'}
              </Text>
            </View>
          ) : (
            filtered.map((banner) => (
              <BannerCard
                key={banner._id}
                banner={banner}
                onToggle={() => toggleMutation.mutate({ id: banner._id, isActive: banner.isActive })}
                onEdit={() => openEdit(banner)}
                onDelete={() => handleDelete(banner)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Banner Modal */}
      <BannerModal
        visible={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingBanner}
      />
    </SafeAreaView>
  );
};

// ─── Page Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6fa' },

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

  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontFamily: Fonts.bold },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  pageTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#1e293b' },
  pageSub: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 2 },
  addBtnWrap: { borderRadius: 10, overflow: 'hidden' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: {
    width: '48%' as any, flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  miniLabel: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#1e293b' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cardImageArea: { height: 160, backgroundColor: '#1e293b', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b', gap: 8 },
  placeholderTxt: { fontSize: 12, fontFamily: Fonts.medium, color: '#475569' },

  overlayBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  overlayActive: { backgroundColor: 'rgba(220,252,231,0.92)' },
  overlayInactive: { backgroundColor: 'rgba(241,245,249,0.92)' },
  overlayBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold },
  overlayActiveText: { color: '#16a34a' },
  overlayInactiveText: { color: '#94a3b8' },
  sortBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sortBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },

  cardBody: { padding: 14 },
  cardTitle: { fontSize: 17, fontFamily: Fonts.bold, color: '#1e293b', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', marginBottom: 10 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pillText: { fontSize: 11, fontFamily: Fonts.semiBold },
  pillNeutral: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f1f5f9', flex: 1 },
  pillNeutralText: { fontSize: 11, fontFamily: Fonts.medium, color: '#64748b', flexShrink: 1 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  toggleBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#64748b' },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});

// ─── Modal Styles ────────────────────────────────────────────────────

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '94%' as any,
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
  labelHint: { fontFamily: Fonts.regular, color: '#94a3b8' },
  req: { color: '#ef4444' },
  hint: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8', marginTop: 4 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 12, minHeight: 46,
  },
  inputTxt: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b', paddingVertical: 10 },

  threeToggle: { flexDirection: 'row', gap: 6 },
  typeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeBtnTxt: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#64748b' },
  typeBtnTxtActive: { color: '#fff' },

  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  activeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 16,
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
  submitBtnWrap: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  submitBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  submitTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});
