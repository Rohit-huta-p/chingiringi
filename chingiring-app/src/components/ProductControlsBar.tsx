import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import {
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import {
  ProductControlsState,
  SortKey,
  SORT_OPTIONS,
  PRICE_PRESETS,
  COINS_PRESETS,
} from '../utils/productFilters';

// Sort + Filter buttons that open bottom sheets. Rendered inline — it sits on
// the category-chip row of each listing (Home web/mobile, Category page), so it
// carries no bar chrome of its own. `compact` drops the text labels for tight
// rows (mobile). Controlled: the host screen owns `state`.

const SORT_ROWS: { id: SortKey | null; label: string }[] = [
  { id: null, label: 'Recommended' },
  ...SORT_OPTIONS,
];

function Sheet({
  visible,
  title,
  onClose,
  children,
  headerAction,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grabber} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <View style={s.sheetHeadRight}>
              {headerAction}
              <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RangeChips({
  items,
  activeId,
  onPress,
}: {
  items: { id: string; label: string }[];
  activeId: string;
  onPress: (id: string) => void;
}) {
  return (
    <View style={s.chipWrap}>
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <TouchableOpacity
            key={it.id}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onPress(it.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipTxt, active && s.chipTxtActive]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ProductControlsBar({
  state,
  onChange,
  compact = false,
}: {
  state: ProductControlsState;
  onChange: (next: ProductControlsState) => void;
  compact?: boolean;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const sortLabel = SORT_OPTIONS.find((o) => o.id === state.sort)?.label ?? 'Sort';
  const sortActive = state.sort !== null;
  const filterCount =
    (state.priceRange !== 'all' ? 1 : 0) + (state.coinsRange !== 'all' ? 1 : 0);

  const btnStyle = compact ? s.iconBtn : s.btn;

  return (
    <View style={s.group}>
      <TouchableOpacity
        style={[btnStyle, sortActive && s.btnActive]}
        onPress={() => setSortOpen(true)}
        activeOpacity={0.7}
        accessibilityLabel="Sort"
      >
        <ArrowUpDown size={16} color={sortActive ? Colors.primary : Colors.textSecondary} />
        {!compact && (
          <>
            <Text style={[s.btnTxt, sortActive && s.btnTxtActive]} numberOfLines={1}>
              {sortLabel}
            </Text>
            <ChevronDown size={14} color={sortActive ? Colors.primary : Colors.textSecondary} />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[btnStyle, filterCount > 0 && s.btnActive]}
        onPress={() => setFilterOpen(true)}
        activeOpacity={0.7}
        accessibilityLabel="Filter"
      >
        <SlidersHorizontal size={16} color={filterCount > 0 ? Colors.primary : Colors.textSecondary} />
        {!compact && (
          <Text style={[s.btnTxt, filterCount > 0 && s.btnTxtActive]}>Filter</Text>
        )}
        {filterCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{filterCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Sort sheet */}
      <Sheet
        visible={sortOpen}
        title="Sort by"
        onClose={() => setSortOpen(false)}
        headerAction={
          sortActive ? (
            <TouchableOpacity onPress={() => onChange({ ...state, sort: null })} hitSlop={8}>
              <Text style={s.clearTxt}>Clear</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        {SORT_ROWS.map((opt) => {
          const selected = state.sort === opt.id;
          return (
            <TouchableOpacity
              key={opt.id ?? 'default'}
              style={s.sortRow}
              onPress={() => {
                onChange({ ...state, sort: opt.id });
                setSortOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.sortRowTxt, selected && s.sortRowTxtSel]}>{opt.label}</Text>
              {selected && <Check size={18} color={Colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </Sheet>

      {/* Filter sheet */}
      <Sheet
        visible={filterOpen}
        title="Filters"
        onClose={() => setFilterOpen(false)}
        headerAction={
          filterCount > 0 ? (
            <TouchableOpacity
              onPress={() => onChange({ ...state, priceRange: 'all', coinsRange: 'all' })}
              hitSlop={8}
            >
              <Text style={s.clearTxt}>Clear all</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
          <Text style={s.groupLabel}>Price</Text>
          <RangeChips
            items={PRICE_PRESETS}
            activeId={state.priceRange}
            onPress={(id) => onChange({ ...state, priceRange: id })}
          />

          <Text style={[s.groupLabel, { marginTop: 18 }]}>Coins</Text>
          <RangeChips
            items={COINS_PRESETS}
            activeId={state.coinsRange}
            onPress={(id) => onChange({ ...state, coinsRange: id })}
          />
        </ScrollView>

        <TouchableOpacity style={s.doneBtn} onPress={() => setFilterOpen(false)} activeOpacity={0.85}>
          <Text style={s.doneTxt}>Done</Text>
        </TouchableOpacity>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  group: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  btnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight10,
  },
  btnTxt: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    maxWidth: 120,
  },
  btnTxtActive: { color: Colors.primary },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold },

  // ── Sheet ──────────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text },
  sheetHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clearTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  sheetBody: { flexGrow: 0 },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sortRowTxt: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.text },
  sortRowTxtSel: { color: Colors.primary, fontFamily: Fonts.bold },

  groupLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTxtActive: { color: '#fff' },

  doneBtn: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
});
