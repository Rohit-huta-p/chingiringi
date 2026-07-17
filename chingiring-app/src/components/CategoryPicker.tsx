import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { ChevronDown, Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/admin';

/**
 * Inline category picker. Replaces the standalone admin Categories screen.
 *
 * Shows a dropdown of existing categories pulled from the backend. Each row
 * has inline edit (rename) + delete actions, so the admin manages the whole
 * category list from inside the Product form without ever leaving it. If the
 * typed search query doesn't match any existing category, a "Create" row
 * appears at the bottom of the list — one tap creates the category on the
 * backend and selects it.
 *
 * Selected value is the category NAME (not _id), to match how the product
 * controller stores the field as a free-text string. Renames cascade visually
 * via cache invalidation, but existing products keep their old category
 * string until edited (matches the backend's loose-string design).
 */
interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

export const CategoryPicker: React.FC<Props> = ({ value, onChange, disabled }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // When a delete is blocked because the category is in use, we switch the
  // sheet into a "reassign" mode instead of a dead-end error.
  const [reassignFor, setReassignFor] = useState<Category | null>(null);
  const [reassignCounts, setReassignCounts] = useState<{ products: number; deals: number }>({
    products: 0,
    deals: 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminAPI.getCategories(),
  });

  const categories: Category[] = data?.data?.categories ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return categories.some((c) => c.name.toLowerCase() === q);
  }, [categories, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] });

  const createMutation = useMutation({
    mutationFn: (name: string) => adminAPI.createCategory({ name }),
    onSuccess: (res) => {
      invalidate();
      const newName = res?.data?.category?.name ?? query.trim();
      onChange(newName);
      setQuery('');
      setOpen(false);
    },
    onError: (e: any) => Alert.alert('Could not create', e?.response?.data?.message || e?.message || 'Try again'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => adminAPI.updateCategory(id, { name }),
    onSuccess: (res, vars) => {
      invalidate();
      const newName = res?.data?.category?.name ?? vars.name;
      // If the user was on this category, update the parent value so the
      // rename reflects immediately instead of waiting for a refetch.
      const old = categories.find((c) => c._id === vars.id)?.name;
      if (old && old === value) onChange(newName);
      setEditingId(null);
      setEditingName('');
    },
    onError: (e: any) => Alert.alert('Could not update', e?.response?.data?.message || e?.message || 'Try again'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      adminAPI.deleteCategory(id, reassignTo),
    onSuccess: (_res, vars) => {
      const deleted = categories.find((c) => c._id === vars.id);
      invalidate();
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'deals'] });
      // If the deleted one was selected, clear the value.
      if (deleted && deleted.name === value) onChange('');
      setReassignFor(null);
    },
    onError: (e: any, vars) => {
      // Blocked because the category is in use → switch to reassign mode
      // instead of a dead-end error.
      if (e?.response?.data?.code === 'CATEGORY_IN_USE') {
        const cat = categories.find((c) => c._id === vars.id) ?? null;
        setReassignCounts({
          products: e.response.data.data?.products ?? 0,
          deals: e.response.data.data?.deals ?? 0,
        });
        setReassignFor(cat);
        return;
      }
      Alert.alert('Could not delete', e?.response?.data?.message || e?.message || 'Try again');
    },
  });

  const startEdit = (cat: Category) => {
    setEditingId(cat._id);
    setEditingName(cat.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };
  const saveEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return cancelEdit();
    const original = categories.find((c) => c._id === editingId)?.name;
    if (name === original) return cancelEdit();
    updateMutation.mutate({ id: editingId, name });
  };

  const confirmDelete = (cat: Category) => {
    // Attempt a plain delete. If the category is in use, the backend replies
    // 409 and onError flips the sheet into reassign mode.
    const go = () => deleteMutation.mutate({ id: cat._id });
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete category "${cat.name}"?`)) go();
      return;
    }
    Alert.alert(`Delete "${cat.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  const selectExisting = (cat: Category) => {
    onChange(cat.name);
    setOpen(false);
    setQuery('');
  };

  const createNew = () => {
    const name = query.trim();
    if (!name) return;
    createMutation.mutate(name);
  };

  return (
    <>
      <TouchableOpacity
        style={[st.trigger, disabled && { opacity: 0.6 }]}
        onPress={() => {
          setReassignFor(null);
          setOpen(true);
        }}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={[st.triggerText, !value && { color: '#94a3b8' }]} numberOfLines={1}>
          {value || 'Select or add category'}
        </Text>
        <ChevronDown size={16} color="#64748b" strokeWidth={2} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={st.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={st.sheet} onPress={() => {}}>
            {/* Header / search */}
            <View style={st.header}>
              <View style={st.searchWrap}>
                <Search size={14} color="#94a3b8" strokeWidth={2} />
                <TextInput
                  style={st.searchInput}
                  placeholder="Search or type a new category..."
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity style={st.closeBtn} onPress={() => setOpen(false)}>
                <X size={16} color="#64748b" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView style={st.list} keyboardShouldPersistTaps="handled">
              {/* Reassign mode — shown when a delete is blocked by references. */}
              {reassignFor && (
                <View style={st.reassignPanel}>
                  <Text style={st.reassignTitle}>"{reassignFor.name}" is in use</Text>
                  <Text style={st.reassignSub}>
                    {reassignCounts.products} product{reassignCounts.products === 1 ? '' : 's'} and{' '}
                    {reassignCounts.deals} deal{reassignCounts.deals === 1 ? '' : 's'} use it. Move them to
                    another category, then it'll be deleted.
                  </Text>
                  {deleteMutation.isPending ? (
                    <View style={st.center}>
                      <ActivityIndicator color="#4784E2" />
                    </View>
                  ) : (
                    <>
                      {categories
                        .filter((c) => c._id !== reassignFor._id)
                        .map((c) => (
                          <TouchableOpacity
                            key={c._id}
                            style={st.reassignOption}
                            activeOpacity={0.7}
                            onPress={() => deleteMutation.mutate({ id: reassignFor._id, reassignTo: c._id })}
                          >
                            <Text style={st.reassignOptionText}>Move to "{c.name}"</Text>
                          </TouchableOpacity>
                        ))}
                      {reassignCounts.deals === 0 && (
                        <TouchableOpacity
                          style={[st.reassignOption, st.reassignOptionMuted]}
                          activeOpacity={0.7}
                          onPress={() => deleteMutation.mutate({ id: reassignFor._id, reassignTo: '' })}
                        >
                          <Text style={[st.reassignOptionText, { color: '#64748b' }]}>
                            Remove label (uncategorised)
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={st.reassignCancel} activeOpacity={0.7} onPress={() => setReassignFor(null)}>
                        <Text style={st.reassignCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {!reassignFor && (<>
              {isLoading && (
                <View style={st.center}>
                  <ActivityIndicator color="#4784E2" />
                </View>
              )}

              {!isLoading && filtered.length === 0 && !query.trim() && (
                <Text style={st.empty}>No categories yet. Type to add one.</Text>
              )}

              {filtered.map((cat) => {
                const isEditing = editingId === cat._id;
                const isSelected = cat.name === value;
                const isBusy =
                  (updateMutation.isPending && updateMutation.variables?.id === cat._id) ||
                  (deleteMutation.isPending && deleteMutation.variables?.id === cat._id);

                if (isEditing) {
                  return (
                    <View key={cat._id} style={st.rowEditing}>
                      <TextInput
                        style={st.editInput}
                        value={editingName}
                        onChangeText={setEditingName}
                        autoFocus
                        autoCapitalize="words"
                        onSubmitEditing={saveEdit}
                      />
                      <TouchableOpacity
                        style={[st.iconBtn, { backgroundColor: '#dcfce7' }]}
                        onPress={saveEdit}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending
                          ? <ActivityIndicator size="small" color="#16a34a" />
                          : <Check size={14} color="#16a34a" strokeWidth={2.4} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.iconBtn, { backgroundColor: '#f1f5f9' }]}
                        onPress={cancelEdit}
                      >
                        <X size={14} color="#64748b" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View key={cat._id} style={st.row}>
                    <TouchableOpacity
                      style={st.rowLabel}
                      onPress={() => selectExisting(cat)}
                      activeOpacity={0.65}
                      disabled={isBusy}
                    >
                      {isSelected && <Check size={14} color="#4784E2" strokeWidth={2.4} />}
                      <Text style={[st.rowText, isSelected && { color: '#4784E2', fontWeight: '700' }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>

                    <View style={st.rowActions}>
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#64748b" />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[st.iconBtn, { backgroundColor: '#eff6ff' }]}
                            onPress={() => startEdit(cat)}
                          >
                            <Pencil size={13} color="#4784E2" strokeWidth={2.2} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[st.iconBtn, { backgroundColor: '#fef2f2' }]}
                            onPress={() => confirmDelete(cat)}
                          >
                            <Trash2 size={13} color="#dc2626" strokeWidth={2.2} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* "+ Create [query]" — only shown when query has no exact match */}
              {!isLoading && query.trim() && !exactMatch && (
                <TouchableOpacity
                  style={st.createRow}
                  onPress={createNew}
                  activeOpacity={0.7}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color="#4784E2" />
                  ) : (
                    <Plus size={14} color="#4784E2" strokeWidth={2.4} />
                  )}
                  <Text style={st.createText}>
                    Create <Text style={{ fontWeight: '800' }}>"{query.trim()}"</Text>
                  </Text>
                </TouchableOpacity>
              )}
              </>)}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const st = StyleSheet.create({
  // Trigger button (mimics input style)
  trigger: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F5F8FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    marginRight: 8,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: 520,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 50px rgba(15,23,42,0.25)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 12 },
          shadowRadius: 24,
          elevation: 10,
        }),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  list: {
    maxHeight: 420,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  center: { paddingVertical: 24, alignItems: 'center' },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 2,
  },
  rowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rowText: {
    fontSize: 14,
    color: '#0f172a',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  rowEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4784E2',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontSize: 14,
    color: '#0f172a',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderStyle: 'dashed',
  },
  createText: {
    fontSize: 14,
    color: '#0f172a',
  },

  // Reassign mode
  reassignPanel: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  reassignTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  reassignSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  reassignOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    marginBottom: 8,
  },
  reassignOptionMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  reassignOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  reassignCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  reassignCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
});

export default CategoryPicker;
