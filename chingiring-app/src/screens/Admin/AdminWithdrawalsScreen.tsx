import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, X, Clock, CheckCircle, Loader,
  Smartphone, Building2, DollarSign,
} from 'lucide-react-native';
import { Colors, Spacing } from '../../constants/theme';
import { adminAPI } from '../../api/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

interface WithdrawalRequest {
  _id: string;
  userName: string;
  userId: string;
  amount: number;
  method: 'UPI' | 'Bank';
  paymentDetails: string;      // UPI vpa OR "acct / IFSC: xxxx"
  accountNumber?: string;      // bank only
  ifsc?: string;               // bank only
  requestedAt: string;         // ISO date
  completedAt?: string;        // ISO date
  txnId?: string;
  status: WithdrawalStatus;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  WithdrawalStatus,
  { color: string; bg: string; label: string }
> = {
  pending:    { color: '#d97706', bg: '#fef3c7', label: 'Pending' },
  processing: { color: '#2563eb', bg: '#dbeafe', label: 'Processing' },
  completed:  { color: '#16a34a', bg: '#dcfce7', label: 'Completed' },
  rejected:   { color: '#dc2626', bg: '#fee2e2', label: 'Rejected' },
};

function StatusPill({ status }: { status: WithdrawalStatus }) {
  const st = STATUS_STYLES[status];
  const Icon =
    status === 'completed' ? CheckCircle :
    status === 'processing' ? Loader :
    status === 'pending' ? Clock : X;
  return (
    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
      <Icon size={12} color={st.color} strokeWidth={2.5} />
      <Text style={[styles.statusPillTxt, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}

function MethodPill({ method }: { method: 'UPI' | 'Bank' }) {
  const isUPI = method === 'UPI';
  const color = isUPI ? '#7c3aed' : '#2563eb';
  const bg = isUPI ? '#ede9fe' : '#dbeafe';
  const Icon = isUPI ? Smartphone : Building2;
  return (
    <View style={[styles.methodPill, { backgroundColor: bg }]}>
      <Icon size={12} color={color} strokeWidth={2.5} />
      <Text style={[styles.methodPillTxt, { color }]}>{method}</Text>
    </View>
  );
}

// ─── Action buttons (status-dependent) ───────────────────────────────────────

function RowActions({
  row,
  onAction,
  pending,
}: {
  row: WithdrawalRequest;
  onAction: (action: 'process' | 'complete' | 'reject', id: string) => void;
  pending: boolean;
}) {
  if (row.status === 'pending') {
    return (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actBtn, styles.actProcess]}
          onPress={() => onAction('process', row._id)}
          disabled={pending}
          activeOpacity={0.8}
        >
          <Text style={[styles.actBtnTxt, { color: '#2563eb' }]}>Process</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actBtn, styles.actComplete]}
          onPress={() => onAction('complete', row._id)}
          disabled={pending}
          activeOpacity={0.8}
        >
          <Text style={[styles.actBtnTxt, { color: '#16a34a' }]}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actBtn, styles.actReject]}
          onPress={() => onAction('reject', row._id)}
          disabled={pending}
          activeOpacity={0.8}
        >
          <Text style={[styles.actBtnTxt, { color: '#dc2626' }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (row.status === 'processing') {
    return (
      <TouchableOpacity
        style={[styles.actBtn, styles.actComplete, { alignSelf: 'flex-start' }]}
        onPress={() => onAction('complete', row._id)}
        disabled={pending}
        activeOpacity={0.8}
      >
        <Text style={[styles.actBtnTxt, { color: '#16a34a' }]}>Complete</Text>
      </TouchableOpacity>
    );
  }
  return <Text style={styles.noActions}>No actions</Text>;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function AdminWithdrawalsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WithdrawalStatus>('all');
  const queryClient = useQueryClient();

  // Use adminAPI.getWithdrawals when backend ships; until then show empty.
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'withdrawals', statusFilter],
    queryFn: async () => {
      try {
        const fn = (adminAPI as any).getWithdrawals;
        if (typeof fn === 'function') return await fn({ status: statusFilter });
      } catch {
        /* fall through to empty */
      }
      return { data: { withdrawals: [] } };
    },
    staleTime: 30_000,
  });

  const withdrawals: WithdrawalRequest[] =
    data?.data?.withdrawals ?? data?.withdrawals ?? data?.data ?? [];

  const actionMutation = useMutation({
    mutationFn: async (payload: {
      action: 'process' | 'complete' | 'reject';
      id: string;
    }) => {
      const fn = (adminAPI as any).updateWithdrawal;
      if (typeof fn === 'function') return fn(payload.id, { action: payload.action });
      // No backend endpoint yet — resolve locally.
      return { status: 'success', data: { id: payload.id, action: payload.action } };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }),
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to update withdrawal'),
  });

  const handleAction = (
    action: 'process' | 'complete' | 'reject',
    id: string,
  ) => {
    const row = withdrawals.find((w) => w._id === id);
    if (!row) return;
    const title =
      action === 'process' ? 'Mark as Processing'
      : action === 'complete' ? 'Mark as Completed'
      : 'Reject Withdrawal';
    const msg = `${title} — ₹${row.amount.toLocaleString('en-IN')} to ${row.userName}?`;

    const go = () => actionMutation.mutate({ action, id });
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && (window as any).confirm(msg)) go();
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: go },
      ]);
    }
  };

  // Derived stats
  const total = withdrawals.length;
  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length;
  const processingCount = withdrawals.filter((w) => w.status === 'processing').length;
  const completedCount = withdrawals.filter((w) => w.status === 'completed').length;
  const pendingAmount = withdrawals
    .filter((w) => w.status === 'pending')
    .reduce((acc, w) => acc + w.amount, 0);

  // Filter + search
  const filtered = useMemo(() => {
    let rows = withdrawals;
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q) ||
          r.paymentDetails.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [withdrawals, statusFilter, search]);

  // Status-filter chip row acts as the "dropdown" in the design
  const statusChips: { key: 'all' | WithdrawalStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Withdrawal Management</Text>
          <Text style={styles.pageSubtitle}>
            Process withdrawal requests and manage payouts
          </Text>
        </View>
      </View>

      {/* Stats row — 5 cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Requests</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>{total}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPending]}>
          <Text style={[styles.statLabel, { color: '#b45309' }]}>Pending</Text>
          <Text style={[styles.statValue, { color: '#d97706' }]}>{pendingCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#1d4ed8' }]}>Processing</Text>
          <Text style={[styles.statValue, { color: '#2563eb' }]}>{processingCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#15803d' }]}>Completed</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{completedCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#6d28d9' }]}>Pending Amount</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>
            ₹{pendingAmount.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Search + filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94a3b8" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by user name..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#64748b" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.filterBox}>
          <SlidersHorizontal size={16} color="#64748b" strokeWidth={2} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {statusChips.map((c) => {
              const active = c.key === statusFilter;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setStatusFilter(c.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterChipTxt,
                      active && styles.filterChipTxtActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Table */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView>
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>User</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Method</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Payment Details</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Requested On</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Actions</Text>
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <DollarSign size={28} color="#cbd5e1" strokeWidth={1.5} />
                <Text style={styles.emptyText}>
                  {search.trim() || statusFilter !== 'all'
                    ? 'No withdrawals match your filters.'
                    : 'No withdrawal requests yet.'}
                </Text>
              </View>
            ) : (
              filtered.map((row, idx) => (
                <View
                  key={row._id}
                  style={[
                    styles.tableRow,
                    idx === filtered.length - 1 && styles.tableRowLast,
                  ]}
                >
                  {/* User */}
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.userName} numberOfLines={1}>{row.userName}</Text>
                    <Text style={styles.userId}>ID: {row.userId}</Text>
                  </View>

                  {/* Amount */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amountTxt}>₹{row.amount.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* Method */}
                  <View style={{ flex: 1 }}>
                    <MethodPill method={row.method} />
                  </View>

                  {/* Payment Details */}
                  <View style={{ flex: 1.5 }}>
                    {row.method === 'Bank' && row.accountNumber ? (
                      <>
                        <Text style={styles.paymentPrimary}>{row.accountNumber}</Text>
                        {row.ifsc ? (
                          <Text style={styles.paymentSecondary}>IFSC: {row.ifsc}</Text>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.paymentPrimary} numberOfLines={1}>
                        {row.paymentDetails}
                      </Text>
                    )}
                  </View>

                  {/* Status */}
                  <View style={{ flex: 1.2 }}>
                    <StatusPill status={row.status} />
                  </View>

                  {/* Requested On (+ completion/TXN meta) */}
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.dateTxt}>{row.requestedAt}</Text>
                    {row.completedAt ? (
                      <Text style={styles.dateMeta}>
                        Completed: <Text style={{ color: '#16a34a' }}>{row.completedAt}</Text>
                      </Text>
                    ) : null}
                    {row.txnId ? (
                      <Text style={styles.dateMeta} numberOfLines={1}>
                        TXN: <Text style={{ color: '#2563eb' }}>{row.txnId}</Text>
                      </Text>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={{ flex: 2 }}>
                    <RowActions
                      row={row}
                      onAction={handleAction}
                      pending={actionMutation.isPending}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8', padding: Spacing.lg },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pageTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  pageSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  statCardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },

  // Search + filter
  searchContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  searchBox: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  filterBox: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipTxt: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTxtActive: { color: '#fff' },

  // Table
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F0F4F8',
    borderBottomWidth: 1,
    borderBottomColor: '#e8ecf2',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  tableRowLast: { borderBottomWidth: 0 },

  // User cell
  userName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  userId: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Amount
  amountTxt: { fontSize: 16, fontWeight: '700', color: '#0f172a' },

  // Method pill
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  methodPillTxt: { fontSize: 11, fontWeight: '700' },

  // Payment cell
  paymentPrimary: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  paymentSecondary: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  statusPillTxt: { fontSize: 11, fontWeight: '700' },

  // Date cell
  dateTxt: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  dateMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actBtnTxt: { fontSize: 12, fontWeight: '700' },
  actProcess: { backgroundColor: '#dbeafe' },
  actComplete: { backgroundColor: '#dcfce7' },
  actReject: { backgroundColor: '#fee2e2' },
  noActions: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },

  // Empty
  emptyState: { padding: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
