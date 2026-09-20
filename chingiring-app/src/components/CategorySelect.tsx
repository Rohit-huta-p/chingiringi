/**
 * CategorySelect — a dropdown for picking a store category.
 *
 * Renders an Input-like field that opens a bottom-sheet modal listing the
 * canonical STORE_CATEGORIES (icon + colour per category). A final "Other"
 * row switches the sheet to a free-text input so sellers can enter a category
 * that isn't in the list — the backend `category` field accepts any string.
 *
 * Used by seller onboarding (step 1), Edit store details, and the Go-live sheet.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { ChevronDown, Check, Plus, X, Pencil } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { STORE_CATEGORIES } from '../data/offlineStores';
import { getCategoryMeta } from '../constants/categories';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const CategorySelect: React.FC<Props> = ({
  value, onChange, label, placeholder = 'Select a category', disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const isCanonical = useMemo(
    () => (STORE_CATEGORIES as readonly string[]).includes(value),
    [value],
  );

  const close = () => { setOpen(false); setCustomMode(false); setCustomText(''); };
  const pick = (c: string) => { onChange(c); close(); };
  const addCustom = () => {
    const t = customText.trim();
    if (!t) return;
    onChange(t);
    close();
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => { if (!disabled) setOpen(true); }}
        style={[styles.field, disabled && styles.fieldDisabled]}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Category'}
      >
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {customMode ? 'Add a custom category' : 'Choose a category'}
              </Text>
              <Pressable onPress={close} hitSlop={10}><X size={20} color={Colors.textSecondary} /></Pressable>
            </View>

            {customMode ? (
              <View style={styles.customWrap}>
                <TextInput
                  style={styles.customInput}
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="e.g. Home Bakery"
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={addCustom}
                  autoCapitalize="words"
                />
                <Pressable
                  onPress={addCustom}
                  disabled={!customText.trim()}
                  style={[styles.addBtn, !customText.trim() && styles.addBtnDisabled]}
                >
                  <Text style={styles.addBtnText}>Add category</Text>
                </Pressable>
                <Pressable onPress={() => setCustomMode(false)} style={styles.backRow} hitSlop={8}>
                  <Text style={styles.backRowText}>← Back to list</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {STORE_CATEGORIES.map((c) => {
                  const meta = getCategoryMeta(c);
                  const Icon = meta.Icon;
                  const active = value === c;
                  return (
                    <Pressable key={c} onPress={() => pick(c)} style={[styles.row, active && styles.rowActive]}>
                      <View style={[styles.rowIcon, { backgroundColor: `${meta.color}1A` }]}>
                        <Icon size={18} color={meta.color} strokeWidth={2} />
                      </View>
                      <Text style={styles.rowLabel} numberOfLines={1}>{c}</Text>
                      {active ? <Check size={18} color={Colors.orange} /> : null}
                    </Pressable>
                  );
                })}

                {/* The current value when it's a custom (non-canonical) entry. */}
                {value && !isCanonical ? (
                  <View style={[styles.row, styles.rowActive]}>
                    <View style={[styles.rowIcon, { backgroundColor: '#6B72801A' }]}>
                      <Pencil size={16} color={Colors.textSecondary} strokeWidth={2} />
                    </View>
                    <Text style={styles.rowLabel} numberOfLines={1}>{value}</Text>
                    <Check size={18} color={Colors.orange} />
                  </View>
                ) : null}

                <Pressable
                  onPress={() => { setCustomText(!isCanonical ? value : ''); setCustomMode(true); }}
                  style={styles.otherRow}
                >
                  <View style={styles.otherIcon}><Plus size={18} color={Colors.orange} strokeWidth={2.4} /></View>
                  <Text style={styles.otherText}>Other — enter your own</Text>
                </Pressable>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },

  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.backgroundGrey,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Colors.text },
  fieldPlaceholder: { color: Colors.textSecondary },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
    maxHeight: '80%',
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 8, marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.text },

  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 6, borderRadius: 12,
  },
  rowActive: { backgroundColor: '#FFF7ED' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },

  otherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 6, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  otherIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  otherText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.orange },

  customWrap: { gap: 12, paddingVertical: 8 },
  customInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.backgroundGrey,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: Fonts.regular, color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  backRow: { alignItems: 'center', paddingVertical: 6 },
  backRowText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
});

export default CategorySelect;
