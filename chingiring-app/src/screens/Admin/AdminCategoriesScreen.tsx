import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Folder, Search,
  ArrowUp, ArrowDown, Eye, EyeOff, Power,
} from 'lucide-react-native';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';
import { Category, Deal, dealsAPI } from '../../api/deals';

// ─── Bucketing ──────────────────────────────────────────────────────────────
// Categories sort into three sections so the admin sees, at a glance, exactly
// which ones drive a row on the user-facing Deals page.
//   - shown:    isActive && showOnDealsPage  → rows on Deals page (sortable)
//   - hidden:   isActive && !showOnDealsPage → in DB but no Deals-page row
//   - inactive: !isActive                    → hidden everywhere

interface BucketedCategories {
  shown:    Category[];
  hidden:   Category[];
  inactive: Category[];
}

function bucketCategories(list: Category[]): BucketedCategories {
  const shown:    Category[] = [];
  const hidden:   Category[] = [];
  const inactive: Category[] = [];
  for (const c of list) {
    if (c.isActive === false) inactive.push(c);
    else if (c.showOnDealsPage === false) hidden.push(c);
    else shown.push(c);
  }
  // Shown section is ordered. Ties fall back to name for stability.
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

// ─── Row card ───────────────────────────────────────────────────────────────

function CategoryRow({
  category, dealCount, position, onMoveUp, onMoveDown, onToggleVisible,
  onToggleActive, onEdit, onDelete,
}: {
  category: Category;
  dealCount: number;
  position?: 'shown' | 'hidden' | 'inactive';
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleVisible: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isShown = position === 'shown';
  return (
    <View style={styles.rowCard}>
      {/* Reorder arrows — only in the shown section */}
      {isShown && (
        <View style={styles.arrowsCol}>
          <TouchableOpacity
            style={[styles.arrowBtn, !onMoveUp && styles.arrowBtnDisabled]}
            onPress={onMoveUp}
            disabled={!onMoveUp}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ArrowUp size={14} color={onMoveUp ? Colors.primary : '#cbd5e1'} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, !onMoveDown && styles.arrowBtnDisabled]}
            onPress={onMoveDown}
            disabled={!onMoveDown}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ArrowDown size={14} color={onMoveDown ? Colors.primary : '#cbd5e1'} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.name}>{category.name}</Text>
        <Text style={styles.dealsCount}>
          {dealCount} {dealCount === 1 ? 'deal' : 'deals'}
        </Text>
      </View>

      {/* Primary action — moves row between sections */}
      {position === 'shown' && (
        <TouchableOpacity style={styles.actionPillHide} onPress={onToggleVisible}>
          <EyeOff size={13} color="#64748b" strokeWidth={2.2} />
          <Text style={styles.actionPillHideText}>Hide</Text>
        </TouchableOpacity>
      )}
      {position === 'hidden' && (
        <TouchableOpacity style={styles.actionPillShow} onPress={onToggleVisible}>
          <Eye size={13} color="#3b82f6" strokeWidth={2.2} />
          <Text style={styles.actionPillShowText}>Show</Text>
        </TouchableOpacity>
      )}
      {position === 'inactive' && (
        <TouchableOpacity style={styles.actionPillActivate} onPress={onToggleActive}>
          <Power size={13} color="#16a34a" strokeWidth={2.2} />
          <Text style={styles.actionPillActivateText}>Activate</Text>
        </TouchableOpacity>
      )}

      {/* Edit + Delete */}
      <TouchableOpacity style={styles.iconBtnEdit} onPress={onEdit}>
        <Pencil size={14} color="#3b82f6" strokeWidth={2} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtnDelete} onPress={onDelete}>
        <Trash2 size={14} color="#ef4444" strokeWidth={2} />
      </TouchableOpacity>
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
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[styles.sectionBadge, { backgroundColor: bg }]}>
          <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Form modal (simpler — no order inputs, with live preview) ─────────────

export interface CategoryDraft {
  name: string;
  isActive: boolean;
  showOnDealsPage: boolean;
}

const EMPTY_DRAFT: CategoryDraft = {
  name: '',
  isActive: true,
  showOnDealsPage: true,
};

export function CategoryFormModal({
  visible, category, onClose, onSave,
}: {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => void | Promise<void>;
}) {
  const isEdit = !!category;
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);

  React.useEffect(() => {
    if (!visible) return;
    setDraft(category ? {
      name: category.name,
      isActive: category.isActive !== false,
      showOnDealsPage: category.showOnDealsPage !== false,
    } : EMPTY_DRAFT);
  }, [visible, category]);

  const handleSubmit = () => {
    if (!draft.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    onSave(draft);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Category' : 'Add Category'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Live preview — shows how the row will look on the Deals page */}
            <Text style={styles.previewLabel}>PREVIEW</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewName}>
                {draft.name.trim() || 'Category name'}
              </Text>
              <Text style={styles.previewSub}>section heading</Text>
            </View>

            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Electronics"
              placeholderTextColor="#94a3b8"
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
            />

            {/* Two toggles as buttons — much clearer than Switch + label */}
            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleChip, draft.showOnDealsPage && styles.toggleChipOn]}
                onPress={() => setDraft({ ...draft, showOnDealsPage: !draft.showOnDealsPage })}
              >
                {draft.showOnDealsPage
                  ? <Eye size={14} color="#3b82f6" strokeWidth={2.2} />
                  : <EyeOff size={14} color="#64748b" strokeWidth={2.2} />}
                <Text style={[styles.toggleChipText, draft.showOnDealsPage && styles.toggleChipTextOn]}>
                  {draft.showOnDealsPage ? 'Shown on Deals page' : 'Hidden from Deals page'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleChip, draft.isActive && styles.toggleChipOnGreen]}
                onPress={() => setDraft({ ...draft, isActive: !draft.isActive })}
              >
                <Power size={14} color={draft.isActive ? '#16a34a' : '#64748b'} strokeWidth={2.2} />
                <Text style={[styles.toggleChipText, draft.isActive && styles.toggleChipTextOnGreen]}>
                  {draft.isActive ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>{isEdit ? 'Save changes' : 'Create category'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export function AdminCategoriesScreen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');

  const { data: catRes, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => adminAPI.getCategories(),
    staleTime: 60_000,
  });

  // Fetch deals once to compute per-category deal counts. Admin view needs
  // visibility across all deals, hence a high limit. Keep cache for 60s so
  // navigating between admin pages doesn't refetch.
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

  // Apply search before bucketing so each section reflects the filtered set.
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
    qc.invalidateQueries({ queryKey: ['categories'] }); // user-facing cache
  };

  const createMutation = useMutation({
    mutationFn: (draft: CategoryDraft) => adminAPI.createCategory(draft),
    onSuccess: () => { invalidate(); setShowForm(false); setEditCategory(null); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to create'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: Partial<Category> }) =>
      adminAPI.updateCategory(id, draft),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to update'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteCategory(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to delete'),
  });

  // ── Reorder: rewrite dealsPageSortOrder for the entire shown bucket so
  //    state is always deterministic, regardless of what stale orders the
  //    DB had before. Triggered when arrow buttons swap a row with its
  //    neighbor.
  const writeShownOrder = (next: Category[]) => {
    next.forEach((c, i) => {
      if ((c.dealsPageSortOrder ?? 0) !== i) {
        updateMutation.mutate({ id: c._id, draft: { dealsPageSortOrder: i } as any });
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

  // Toggling visibility: when promoting Hidden → Shown, append to the END of
  // the shown order (give it max+1) so it doesn't displace existing rows.
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
      } as any,
    });
  };

  const handleToggleActive = (c: Category) => {
    updateMutation.mutate({
      id: c._id,
      draft: { isActive: !(c.isActive !== false) } as any,
    });
  };

  const handleSave = (draft: CategoryDraft) => {
    if (editCategory) updateMutation.mutate({ id: editCategory._id, draft: draft as any });
    else createMutation.mutate(draft);
  };

  const handleDelete = (c: Category) => {
    const remove = () => deleteMutation.mutate(c._id);
    const count = dealCountByCategoryId[c._id] ?? 0;
    const warning = count > 0
      ? `${count} ${count === 1 ? 'deal uses' : 'deals use'} this category. You'll need to reassign them.`
      : '';
    const msg = `Delete "${c.name}"?${warning ? '\n\n' + warning : ''}`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) remove();
    } else {
      Alert.alert('Delete Category', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Categories</Text>
          <Text style={styles.pageSubtitle}>
            Each category here becomes a row on the user-facing Deals page. Hide,
            reorder, or deactivate without touching the deals themselves.
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditCategory(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Category</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={16} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Loading / empty */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptyText}>Loading categories…</Text>
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.emptyState}>
          <Folder size={48} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={styles.emptyText}>No categories yet. Click "Add Category" to create one.</Text>
        </View>
      ) : (
        <>
          {/* SHOWN */}
          <SectionHeader
            title="On Deals page"
            count={buckets.shown.length}
            subtitle="Drag the arrows to reorder how they appear on the user Deals page."
            accent="green"
          />
          {buckets.shown.length === 0 ? (
            <View style={styles.sectionEmpty}>
              <Text style={styles.sectionEmptyText}>
                Nothing on the Deals page yet. Show a category below to add one.
              </Text>
            </View>
          ) : (
            <View style={styles.sectionList}>
              {buckets.shown.map((c, i) => (
                <CategoryRow
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
              ))}
            </View>
          )}

          {/* HIDDEN */}
          {buckets.hidden.length > 0 && (
            <>
              <SectionHeader
                title="Hidden from Deals page"
                count={buckets.hidden.length}
                subtitle="Active categories that don't appear as their own row on the Deals page."
                accent="amber"
              />
              <View style={styles.sectionList}>
                {buckets.hidden.map((c) => (
                  <CategoryRow
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
              </View>
            </>
          )}

          {/* INACTIVE */}
          {buckets.inactive.length > 0 && (
            <>
              <SectionHeader
                title="Inactive"
                count={buckets.inactive.length}
                subtitle="Not shown anywhere. Reactivate to use again."
                accent="gray"
              />
              <View style={styles.sectionList}>
                {buckets.inactive.map((c) => (
                  <CategoryRow
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
              </View>
            </>
          )}
        </>
      )}

      <CategoryFormModal
        visible={showForm}
        category={editCategory}
        onClose={() => { setShowForm(false); setEditCategory(null); }}
        onSave={handleSave}
      />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FF' },
  containerContent: { padding: Spacing.lg, paddingBottom: 60, gap: 16 },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, maxWidth: 620, lineHeight: 20 },
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Section header
  sectionHeader: { marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionBadgeText: { fontSize: 12, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  sectionList: { gap: 8 },
  sectionEmpty: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  sectionEmptyText: { fontSize: 13, color: Colors.textSecondary },

  // Row
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  arrowsCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  arrowBtn: {
    width: 24,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: { backgroundColor: '#f1f5f9' },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: { fontSize: 22 },

  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dealsCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  actionPillHide: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  actionPillHideText: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  actionPillShow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
  },
  actionPillShowText: { fontSize: 12, fontWeight: '700', color: '#3b82f6' },

  actionPillActivate: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
  },
  actionPillActivateText: { fontSize: 12, fontWeight: '700', color: '#16a34a' },

  iconBtnEdit: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  iconBtnDelete: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
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
    backgroundColor: '#3b82f6',
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

  // Live preview block (top of modal)
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F8FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    padding: 12,
    marginBottom: 16,
  },
  previewIcon: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8ecf2',
    justifyContent: 'center', alignItems: 'center',
  },
  previewEmoji: { fontSize: 20 },
  previewName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  previewSub: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Visibility toggle chips
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
  },
  toggleChipOn:      { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  toggleChipOnGreen: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  toggleChipText:        { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  toggleChipTextOn:      { color: '#3b82f6' },
  toggleChipTextOnGreen: { color: '#16a34a' },
});
