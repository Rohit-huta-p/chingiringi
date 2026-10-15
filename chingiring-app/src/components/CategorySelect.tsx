/**
 * CategorySelect — a combobox for choosing a store category.
 *
 * A text field you can type into, with a live-filtering dropdown directly
 * beneath it (no modal sheet). The typed text IS the value, so sellers can:
 *   • type to filter and tap a known category, or
 *   • type a category that isn't listed and tap "Add …" to use it as-is (custom).
 *
 * The known list is fetched from the backend (canonical suggestions ∪ custom
 * values already in use); the static STORE_CATEGORIES is the offline/loading
 * fallback. A store's `category` is free-text, so a custom value saves fine and
 * then shows up here for everyone once that store is saved.
 *
 * Used by seller onboarding (step 1), Edit store details, and the Go-live sheet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Keyboard } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check, Plus, Search } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { STORE_CATEGORIES } from '../data/offlineStores';
import { getCategoryMeta } from '../constants/categories';
import { storesAPI } from '../api/stores';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const CategorySelect: React.FC<Props> = ({
  value, onChange, label, placeholder = 'Search or type a category', disabled,
}) => {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  // True once the seller edits the field — tells a real search apart from the
  // field merely displaying the current selection. Without it, a selected value
  // sitting in the input would filter the list down to itself on reopen.
  const [dirty, setDirty] = useState(false);
  const focused = useRef(false);

  const { data } = useQuery({
    queryKey: ['storeCategories'],
    queryFn: storesAPI.getCategories,
    staleTime: 5 * 60_000,
  });
  const categories: string[] = data && data.length ? data : [...STORE_CATEGORIES];

  // Mirror an external value change (e.g. seeding an edit form) into the input,
  // but never while the seller is actively typing.
  useEffect(() => {
    if (!focused.current) { setQuery(value ?? ''); setDirty(false); }
  }, [value]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const activeVal = (value ?? '').trim().toLowerCase();

  // Only filter while the seller is actually typing a search — otherwise show
  // the full list so every category stays reachable even when one is selected.
  const searching = dirty && ql.length > 0;
  const base = searching ? categories.filter((c) => c.toLowerCase().includes(ql)) : categories;

  // Pin the selected category to the top. When not searching, a custom value
  // that isn't in the known list is still shown (and pinned) as the current pick.
  let filtered = base;
  if (activeVal) {
    const selected = base.find((c) => c.toLowerCase() === activeVal);
    if (selected) {
      filtered = [selected, ...base.filter((c) => c.toLowerCase() !== activeVal)];
    } else if (!searching && (value ?? '').trim()) {
      filtered = [(value as string).trim(), ...base];
    }
  }

  const hasExact = categories.some((c) => c.toLowerCase() === ql);
  const canAdd = searching && !hasExact;

  const choose = (c: string) => {
    onChange(c);
    setQuery(c);
    setDirty(false);
    focused.current = false;
    setOpen(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.field, disabled && styles.fieldDisabled, open && styles.fieldOpen]}>
        <Search size={17} color={Colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={query}
          editable={!disabled}
          onChangeText={(t) => { setQuery(t); onChange(t); setDirty(true); if (!open) setOpen(true); }}
          onFocus={() => { focused.current = true; setDirty(false); setOpen(true); }}
          onBlur={() => { focused.current = false; setTimeout(() => setOpen(false), 120); }}
          selectTextOnFocus
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => { if (q) choose(q); }}
          accessibilityLabel={label ?? 'Category'}
        />
        <Pressable onPress={() => { if (!disabled) setOpen((o) => !o); }} hitSlop={8}>
          <ChevronDown size={18} color={Colors.textSecondary} style={open ? styles.chevronOpen : undefined} />
        </Pressable>
      </View>

      {open && !disabled ? (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {canAdd ? (
              <Pressable onPress={() => choose(q)} style={[styles.row, styles.addRow]}>
                <View style={styles.addIcon}><Plus size={16} color={Colors.orange} strokeWidth={2.4} /></View>
                <Text style={styles.addText} numberOfLines={1}>Add &ldquo;{q}&rdquo;</Text>
              </Pressable>
            ) : null}

            {filtered.map((c) => {
              const meta = getCategoryMeta(c);
              const Icon = meta.Icon;
              const active = activeVal === c.toLowerCase();
              return (
                <Pressable key={c} onPress={() => choose(c)} style={[styles.row, active && styles.rowActive]}>
                  <View style={[styles.rowIcon, { backgroundColor: `${meta.color}1A` }]}>
                    <Icon size={16} color={meta.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.rowLabel} numberOfLines={1}>{c}</Text>
                  {active ? <Check size={16} color={Colors.orange} /> : null}
                </Pressable>
              );
            })}

            {filtered.length === 0 && !canAdd ? (
              <Text style={styles.empty}>Start typing to add your own category</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.backgroundGrey,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  fieldOpen: { borderColor: Colors.orange },
  fieldDisabled: { opacity: 0.5 },
  input: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Colors.text, padding: 0 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  dropdown: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.surface, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  list: { maxHeight: 260 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 12,
  },
  rowActive: { backgroundColor: '#FFF7ED' },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },

  addRow: { borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#FFF7ED' },
  addIcon: {
    width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FDE6CF',
  },
  addText: { flex: 1, fontSize: 15, fontFamily: Fonts.bold, color: Colors.orange },

  empty: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary,
    paddingVertical: 14, paddingHorizontal: 12,
  },
});

export default CategorySelect;
