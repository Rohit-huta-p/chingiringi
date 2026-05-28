import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Share, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Download, ArrowUpRight, ArrowDownLeft, Gift, Coins as CoinsIcon,
  Inbox,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { walletAPI, Transaction } from '../../api/wallet';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// ─── Filter chip groups ─────────────────────────────────────────────────────
// "Coins" maps to BOTH backend types because credits + debits live separately.

type TypeFilter = 'all' | 'cashback' | 'withdrawal' | 'coins' | 'referral';
type PeriodFilter = 'all' | '7d' | '30d' | '90d';

const TYPE_CHIPS: { key: TypeFilter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'cashback',   label: 'Cashback' },
  { key: 'withdrawal', label: 'Withdrawal' },
  { key: 'coins',      label: 'Coins' },
  { key: 'referral',   label: 'Referral' },
];

const PERIOD_CHIPS: { key: PeriodFilter; label: string }[] = [
  { key: 'all',  label: 'All Time' },
  { key: '7d',   label: 'Last 7 Days' },
  { key: '30d',  label: 'Last 30 Days' },
  { key: '90d',  label: 'Last 90 Days' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} mo${months === 1 ? '' : 's'} ago`;
}

function matchesPeriod(iso: string, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const dayMs = 86_400_000;
  const limit = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return Date.now() - new Date(iso).getTime() <= limit * dayMs;
}

function matchesType(tx: Transaction, t: TypeFilter): boolean {
  if (t === 'all') return true;
  if (t === 'coins') return tx.type === 'coin_credit' || tx.type === 'coin_debit';
  return tx.type === t;
}

// ─── Type-driven visual config for each row ─────────────────────────────────

function rowVisual(tx: Transaction) {
  switch (tx.type) {
    case 'cashback':
      return { Icon: ArrowUpRight, iconColor: '#16a34a', iconBg: '#dcfce7', sign: '+', isDebit: false };
    case 'withdrawal':
      return { Icon: ArrowDownLeft, iconColor: '#ef4444', iconBg: '#fee2e2', sign: '-', isDebit: true };
    case 'referral':
      return { Icon: Gift, iconColor: '#3b82f6', iconBg: '#eff6ff', sign: '+', isDebit: false };
    case 'coin_credit':
    case 'coin_debit':
      return {
        Icon: CoinsIcon,
        iconColor: '#b45309',
        iconBg: '#fef3c7',
        sign: tx.type === 'coin_credit' ? '+' : '-',
        isDebit: tx.type === 'coin_debit',
      };
    case 'bonus':
    default:
      return { Icon: Gift, iconColor: '#a78bfa', iconBg: '#ede9fe', sign: '+', isDebit: false };
  }
}

function statusColor(status: Transaction['status']) {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return { text: '#16a34a', bg: '#dcfce7' };
    case 'pending':
      return { text: '#b45309', bg: '#fef3c7' };
    case 'processing':
      return { text: '#3b82f6', bg: '#eff6ff' };
    case 'rejected':
      return { text: '#ef4444', bg: '#fee2e2' };
    default:
      return { text: '#64748b', bg: '#f1f5f9' };
  }
}

// ─── Row card ───────────────────────────────────────────────────────────────

function TxnRow({ tx }: { tx: Transaction }) {
  const visual = rowVisual(tx);
  const Icon = visual.Icon;
  const s = statusColor(tx.status);

  const title =
    tx.metadata?.brand ||
    (tx.type === 'withdrawal' ? 'Withdrawal'
      : tx.type === 'referral'   ? `Referral bonus`
      : tx.type.startsWith('coin') ? 'Coin transaction'
      : tx.description || 'Transaction');

  const typeLabel =
    tx.type === 'cashback'     ? 'Cashback'
    : tx.type === 'withdrawal' ? 'Withdrawal'
    : tx.type === 'referral'   ? 'Referral'
    : tx.type === 'coin_credit' || tx.type === 'coin_debit' ? 'Coins'
    : tx.type === 'bonus'      ? 'Bonus'
    : tx.type;

  return (
    <View style={css.row}>
      <View style={[css.rowIcon, { backgroundColor: visual.iconBg }]}>
        <Icon size={16} color={visual.iconColor} strokeWidth={2.2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={css.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={css.rowMeta} numberOfLines={1}>
          {typeLabel} · {timeAgo(tx.createdAt)}
        </Text>
        {tx.description && tx.description !== title ? (
          <Text style={css.rowDesc} numberOfLines={1}>{tx.description}</Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={[
            css.rowAmount,
            { color: visual.isDebit ? '#ef4444' : '#16a34a' },
          ]}
          numberOfLines={1}
        >
          {visual.sign}{inr(tx.amount)}
        </Text>
        <View style={[css.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[css.statusPillText, { color: s.text }]}>{tx.status}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Filter chip ────────────────────────────────────────────────────────────

function Chip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[css.chip, active && css.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[css.chipText, active && css.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export const MobileTransactionHistoryScreen = () => {
  const nav = useNavigation<any>();
  const refresh = usePullToRefresh();
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  // Fetch a wide window once, then filter client-side. Backend supports
  // type/period params too but keeping client-side filtering means chip
  // toggles feel instant (no refetch flash).
  const { data, isLoading } = useQuery({
    queryKey: ['wallet', 'transactions', 'mobile'],
    queryFn: () => walletAPI.getTransactions({ limit: 200 }),
    staleTime: 30_000,
  });

  const txns: Transaction[] = useMemo(() => {
    const raw =
      (data as any)?.data?.transactions ??
      (data as any)?.transactions ??
      (data as any)?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [data]);

  const filtered = useMemo(() => {
    return txns.filter(
      (t) => matchesType(t, typeFilter) && matchesPeriod(t.createdAt, periodFilter),
    );
  }, [txns, typeFilter, periodFilter]);

  // Net amount = credits − debits across the filtered set.
  const netAmount = useMemo(() => {
    return filtered.reduce((sum, t) => {
      const visual = rowVisual(t);
      return sum + (visual.isDebit ? -t.amount : t.amount);
    }, 0);
  }, [filtered]);

  const handleExport = async () => {
    // Phase 2: real CSV export endpoint. For now share a plain-text summary
    // so the button is functional and users see the count + total.
    const lines = filtered.slice(0, 50).map((t) => {
      const v = rowVisual(t);
      return `${new Date(t.createdAt).toISOString().slice(0, 10)} · ${t.type} · ${v.sign}₹${t.amount} · ${t.status}`;
    });
    const body =
      `Chingiringi — Transaction History (${filtered.length} txns, net ${inr(netAmount)})\n\n` +
      lines.join('\n');
    try {
      await Share.share({ message: body });
    } catch {
      Alert.alert('Export', body.slice(0, 800));
    }
  };

  return (
    <View style={css.root}>
      {/* ── Header: blue gradient + back + title + export ─────────────── */}
      <LinearGradient
        colors={Gradient.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={css.headerGradient}
      >
        <SafeAreaView edges={['top']} style={css.headerSafe}>
          <View style={css.blobLeft} />
          <View style={css.blobRight} />

          <View style={css.headerRow}>
            <TouchableOpacity
              style={css.iconBtn}
              onPress={() => nav.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={20} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={css.headerKicker}>ACCOUNT</Text>
              <Text style={css.headerTitle}>Transaction History</Text>
            </View>

            <TouchableOpacity style={css.exportBtn} onPress={handleExport} activeOpacity={0.85}>
              <Download size={14} color="#fff" strokeWidth={2.2} />
              <Text style={css.exportBtnText}>Export</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl {...refresh} />}
      >
        <View style={css.body}>
          {/* ── Filters card ───────────────────────────────────────────── */}
          <View style={css.filtersCard}>
            <Text style={css.filterHeader}>TRANSACTION TYPE</Text>
            <View style={css.chipsRow}>
              {TYPE_CHIPS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={typeFilter === c.key}
                  onPress={() => setTypeFilter(c.key)}
                />
              ))}
            </View>

            <Text style={[css.filterHeader, { marginTop: 14 }]}>TIME PERIOD</Text>
            <View style={css.chipsRow}>
              {PERIOD_CHIPS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={periodFilter === c.key}
                  onPress={() => setPeriodFilter(c.key)}
                />
              ))}
            </View>
          </View>

          {/* ── Net amount summary ─────────────────────────────────────── */}
          <View style={css.totalCard}>
            <Text style={css.totalLabel}>
              TOTAL NET AMOUNT ({filtered.length} TRANSACTION{filtered.length === 1 ? '' : 'S'})
            </Text>
            <Text style={css.totalValue}>
              {netAmount < 0 ? '-' : ''}{inr(Math.abs(netAmount))}
            </Text>
          </View>

          {/* ── Transactions list ──────────────────────────────────────── */}
          {isLoading ? (
            <View style={css.emptyState}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={css.emptyText}>Loading transactions…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={css.emptyState}>
              <Inbox size={36} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={css.emptyText}>
                {txns.length === 0
                  ? 'No transactions yet. Earn cashback by shopping through Chingiringi!'
                  : 'No transactions match these filters.'}
              </Text>
            </View>
          ) : (
            filtered.map((t) => <TxnRow key={t._id} tx={t} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const css = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Header
  headerGradient: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerSafe: { paddingBottom: 18, position: 'relative' },
  blobLeft: {
    position: 'absolute',
    top: -20, left: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blobRight: {
    position: 'absolute',
    top: 30, right: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 6, gap: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerKicker: {
    color: 'rgba(255,255,255,0.75)', fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 1, marginBottom: 2,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: Fonts.extraBold },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  exportBtnText: { color: '#fff', fontSize: 12, fontFamily: Fonts.bold },

  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  // Filters card
  filtersCard: {
    backgroundColor: '#fff',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  filterHeader: {
    fontSize: 10, fontFamily: Fonts.bold, color: Colors.textSecondary,
    letterSpacing: 1, marginBottom: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#475569' },
  chipTextActive: { color: '#fff', fontFamily: Fonts.bold },

  // Total card
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 0.6, marginBottom: 4,
  },
  totalValue: { color: '#fff', fontSize: 28, fontFamily: Fonts.extraBold },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#eef2f7',
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  rowTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  rowMeta:  { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  rowDesc:  { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  rowAmount: { fontSize: 14, fontFamily: Fonts.extraBold, marginBottom: 4 },

  statusPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  statusPillText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'capitalize' },

  emptyState: {
    alignItems: 'center', paddingVertical: 40, gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#eef2f7',
  },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },
});

export default MobileTransactionHistoryScreen;
