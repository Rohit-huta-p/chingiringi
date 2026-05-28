import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Pencil, Trash2, Folder, Search,
  ArrowUp, ArrowDown, Eye, EyeOff, Power,
  LayoutDashboard, Tag, CreditCard, Users, Package, Image as ImageIcon, Ticket, Grid3X3,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { Category, Deal, dealsAPI } from '../../api/deals';
import { useAuthStore } from '../../store';
import { CategoryFormModal, CategoryDraft } from './AdminCategoriesScreen';

function userInitials(name?: string | null): string {
  if (!name) return 'A';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// Shared admin top-nav — keep parity with the other mobile admin screens.
const NAV_ITEMS = [
  { key: 'AdminDashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { key: 'AdminDeals',       label: 'Deals',      icon: Tag },
  { key: 'AdminCategories',  label: 'Categories', icon: Grid3X3 },
  { key: 'AdminWithdrawals', label: 'Payouts',    icon: CreditCard },
  { key: 'AdminUsers',       label: 'Users',      icon: Users },
  { key: 'AdminAllProducts', label: 'Products',   icon: Package },
  { key: 'AdminBanners',     label: 'Banners',    icon: ImageIcon },
  { key: 'AdminCoupons',     label: 'Coupons',    icon: Ticket },
];

// Same bucketing rules as desktop — kept inline to avoid an extra import.
function bucketCategories(list: Category[]) {
  const shown: Category[] = [];
  const hidden: Category[] = [];
  const inactive: Category[] = [];
  for (const c of list) {
    if (c.isActive === false) inactive.push(c);
    else if (c.showOnDealsPage === false) hidden.push(c);
    else shown.push(c);
  }
  shown.sort((a, b) => {
    const ao = a.dealsPageSortOrder ?? 0;
    const bo = b.dealsPageSortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
  hidden.sort((a, b) => a.name.localeCompare(b.name));
  inactive.sort((a, b) => a.name.localeCompare(b.name));
  return { shown, hidden, inactive };
}

// ─── Card ───────────────────────────────────────────────────────────────────

function CategoryCard({
  category, dealCount, position, onMoveUp, onMoveDown, onToggleVisible, onToggleActive,
  onEdit, onDelete,
}: {
  category: Category;
  dealCount: number;
  position: 'shown' | 'hidden' | 'inactive';
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleVisible: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{category.name}</Text>
          <Text style={s.dealCount}>
            {dealCount} {dealCount === 1 ? 'deal' : 'deals'}
          </Text>
        </View>

        {/* Reorder arrows only in shown section */}
        {position === 'shown' && (
          <View style={s.arrowsCol}>
            <TouchableOpacity
              style={[s.arrowBtn, !onMoveUp && s.arrowBtnDisabled]}
              onPress={onMoveUp}
              disabled={!onMoveUp}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <ArrowUp size={14} color={onMoveUp ? '#3b82f6' : '#cbd5e1'} strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.arrowBtn, !onMoveDown && s.arrowBtnDisabled]}
              onPress={onMoveDown}
              disabled={!onMoveDown}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <ArrowDown size={14} color={onMoveDown ? '#3b82f6' : '#cbd5e1'} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.actionsRow}>
        {position === 'shown' && (
          <TouchableOpacity style={[s.pill, s.pillHide]} onPress={onToggleVisible}>
            <EyeOff size={12} color="#64748b" strokeWidth={2.2} />
            <Text style={[s.pillText, s.pillTextHide]}>Hide</Text>
          </TouchableOpacity>
        )}
        {position === 'hidden' && (
          <TouchableOpacity style={[s.pill, s.pillShow]} onPress={onToggleVisible}>
            <Eye size={12} color="#3b82f6" strokeWidth={2.2} />
            <Text style={[s.pillText, s.pillTextShow]}>Show on deals page</Text>
          </TouchableOpacity>
        )}
        {position === 'inactive' && (
          <TouchableOpacity style={[s.pill, s.pillActivate]} onPress={onToggleActive}>
            <Power size={12} color="#16a34a" strokeWidth={2.2} />
            <Text style={[s.pillText, s.pillTextActivate]}>Activate</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.iconBtnEdit} onPress={onEdit}>
          <Pencil size={14} color="#3b82f6" strokeWidth={2.2} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtnDelete} onPress={onDelete}>
          <Trash2 size={14} color="#ef4444" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({
  title, count, subtitle, accent,
}: {
  title: string;
  count: number;
  subtitle?: string;
  accent: 'green' | 'amber' | 'gray';
}) {
  const bg =
    accent === 'green' ? '#dcfce7' :
    accent === 'amber' ? '#fef3c7' : '#f1f5f9';
  const color =
    accent === 'green' ? '#16a34a' :
    accent === 'amber' ? '#b45309' : '#64748b';
  return (
    <View style={s.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={[s.sectionBadge, { backgroundColor: bg }]}>
          <Text style={[s.sectionBadgeText, { color }]}>{count}</Text>
        </View>
      </View>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export const MobileAdminCategories = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((st) => st.user?.name);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');

  const { data: catRes, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminAPI.getCategories(),
    staleTime: 60_000,
  });
  const { data: dealsRes } = useQuery({
    queryKey: ['admin-deals-for-category-counts'],
    queryFn: () => dealsAPI.getDeals({ limit: 500 }),
    staleTime: 60_000,
  });

  const categories: Category[] = useMemo(() => {
    const raw =
      (catRes as any)?.data?.categories ??
      (catRes as any)?.categories ??
      (catRes as any)?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [catRes]);

  const dealCountByCategoryId: Record<string, number> = useMemo(() => {
    const deals: Deal[] =
      (dealsRes as any)?.data?.deals ??
      (dealsRes as any)?.deals ??
      (dealsRes as any)?.data ?? [];
    const counts: Record<string, number> = {};
    for (const d of deals) {
      const id = (d.category as any)?._id ?? (d.category as any);
      if (!id) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [dealsRes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.slug && c.slug.toLowerCase().includes(q))
    );
  }, [categories, search]);

  const buckets = useMemo(() => bucketCategories(filtered), [filtered]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-categories'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };

  const createMutation = useMutation({
    mutationFn: (draft: CategoryDraft) => adminAPI.createCategory(draft),
    onSuccess: () => { invalidate(); setShowForm(false); setEditCategory(null); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to create'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: any }) =>
      adminAPI.updateCategory(id, draft),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to update'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteCategory(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to delete'),
  });

  const writeShownOrder = (next: Category[]) => {
    next.forEach((c, i) => {
      if ((c.dealsPageSortOrder ?? 0) !== i) {
        updateMutation.mutate({ id: c._id, draft: { dealsPageSortOrder: i } });
      }
    });
  };
  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...buckets.shown];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    writeShownOrder(next);
  };
  const handleMoveDown = (idx: number) => {
    if (idx >= buckets.shown.length - 1) return;
    const next = [...buckets.shown];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    writeShownOrder(next);
  };

  const handleToggleVisible = (c: Category, currentlyShown: boolean) => {
    const maxOrder = buckets.shown.reduce(
      (m, x) => Math.max(m, x.dealsPageSortOrder ?? 0),
      -1,
    );
    updateMutation.mutate({
      id: c._id,
      draft: {
        showOnDealsPage: !currentlyShown,
        ...(currentlyShown ? {} : { dealsPageSortOrder: maxOrder + 1 }),
      },
    });
  };

  const handleToggleActive = (c: Category) => {
    updateMutation.mutate({
      id: c._id,
      draft: { isActive: !(c.isActive !== false) },
    });
  };

  const handleSave = (draft: CategoryDraft) => {
    if (editCategory) updateMutation.mutate({ id: editCategory._id, draft });
    else createMutation.mutate(draft);
  };

  const handleDelete = (c: Category) => {
    const count = dealCountByCategoryId[c._id] ?? 0;
    const warning = count > 0
      ? `\n\n${count} ${count === 1 ? 'deal uses' : 'deals use'} this category.`
      : '';
    Alert.alert('Delete Category', `Delete "${c.name}"?${warning}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(c._id) },
    ]);
  };

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

        {/* Nav tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.navScroll} contentContainerStyle={s.navContent}>
          {NAV_ITEMS.map((item) => {
            const active = item.key === 'AdminCategories';
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
          {/* Title row */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle}>Categories</Text>
              <Text style={s.pageSub}>
                Each row here = a section on the user-facing Deals page.
              </Text>
            </View>
            <TouchableOpacity
              style={s.addBtn}
              activeOpacity={0.8}
              onPress={() => { setEditCategory(null); setShowForm(true); }}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Search size={15} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search categories…"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Empty everything */}
          {categories.length === 0 ? (
            <View style={s.emptyState}>
              <Folder size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No categories yet</Text>
              <Text style={s.emptySub}>Tap "+ Add" to create one.</Text>
            </View>
          ) : (
            <>
              {/* SHOWN */}
              <SectionHeader
                title="On Deals page"
                count={buckets.shown.length}
                subtitle="Tap the arrows to reorder."
                accent="green"
              />
              {buckets.shown.length === 0 ? (
                <View style={s.sectionEmpty}>
                  <Text style={s.sectionEmptyText}>
                    Nothing on the Deals page yet. Show a category below.
                  </Text>
                </View>
              ) : (
                buckets.shown.map((c, i) => (
                  <CategoryCard
                    key={c._id}
                    category={c}
                    dealCount={dealCountByCategoryId[c._id] ?? 0}
                    position="shown"
                    onMoveUp={i > 0 ? () => handleMoveUp(i) : undefined}
                    onMoveDown={i < buckets.shown.length - 1 ? () => handleMoveDown(i) : undefined}
                    onToggleVisible={() => handleToggleVisible(c, true)}
                    onToggleActive={() => handleToggleActive(c)}
                    onEdit={() => { setEditCategory(c); setShowForm(true); }}
                    onDelete={() => handleDelete(c)}
                  />
                ))
              )}

              {/* HIDDEN */}
              {buckets.hidden.length > 0 && (
                <>
                  <SectionHeader
                    title="Hidden from Deals page"
                    count={buckets.hidden.length}
                    subtitle="Active but not shown as a section."
                    accent="amber"
                  />
                  {buckets.hidden.map((c) => (
                    <CategoryCard
                      key={c._id}
                      category={c}
                      dealCount={dealCountByCategoryId[c._id] ?? 0}
                      position="hidden"
                      onToggleVisible={() => handleToggleVisible(c, false)}
                      onToggleActive={() => handleToggleActive(c)}
                      onEdit={() => { setEditCategory(c); setShowForm(true); }}
                      onDelete={() => handleDelete(c)}
                    />
                  ))}
                </>
              )}

              {/* INACTIVE */}
              {buckets.inactive.length > 0 && (
                <>
                  <SectionHeader
                    title="Inactive"
                    count={buckets.inactive.length}
                    subtitle="Not shown anywhere."
                    accent="gray"
                  />
                  {buckets.inactive.map((c) => (
                    <CategoryCard
                      key={c._id}
                      category={c}
                      dealCount={dealCountByCategoryId[c._id] ?? 0}
                      position="inactive"
                      onToggleVisible={() => handleToggleVisible(c, false)}
                      onToggleActive={() => handleToggleActive(c)}
                      onEdit={() => { setEditCategory(c); setShowForm(true); }}
                      onDelete={() => handleDelete(c)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <CategoryFormModal
        visible={showForm}
        category={editCategory}
        onClose={() => { setShowForm(false); setEditCategory(null); }}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

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

  body: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2, maxWidth: 240 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12,
    height: 40, borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },

  // Section header
  sectionHeader: { marginTop: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  sectionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  sectionEmpty: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: '#e8ecf2', borderStyle: 'dashed', padding: 12, alignItems: 'center',
  },
  sectionEmptyText: { fontSize: 12, color: '#94a3b8' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e8ecf2',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },
  iconEmoji: { fontSize: 20 },
  name: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  dealCount: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  arrowsCol: { flexDirection: 'column', gap: 2 },
  arrowBtn: {
    width: 26, height: 22, borderRadius: 6, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  arrowBtnDisabled: { backgroundColor: '#f1f5f9' },

  actionsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1,
  },
  pillHide:     { backgroundColor: '#F5F8FF', borderColor: '#e2e8f0' },
  pillShow:     { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  pillActivate: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  pillText:         { fontSize: 11, fontWeight: '700' },
  pillTextHide:     { color: '#64748b' },
  pillTextShow:     { color: '#3b82f6' },
  pillTextActivate: { color: '#16a34a' },

  iconBtnEdit:   { width: 28, height: 28, borderRadius: 6, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  iconBtnDelete: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});
