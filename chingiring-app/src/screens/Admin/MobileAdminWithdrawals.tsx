import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  SlidersHorizontal,
  Clock,
  CheckCircle,
  AlertTriangle,
  Inbox,
  LayoutDashboard,
  Tag,
  CreditCard,
  Users,
  Package,
  Image as ImageIcon,
 Ticket,
  Grid3X3,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
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

interface WithdrawalRequest {
  _id: string;
  userName: string;
  userId: string;
  amount: number;
  method: string;
  paymentDetails: string;
  requestedAt: string;
  txnId?: string;
  status: 'pending' | 'completed' | 'processing' | 'rejected';
}

// ─── Status helpers ─────────────────────────────────────────────────

function statusColor(s: string): string {
  switch (s) {
    case 'pending': return '#f97316';
    case 'completed': return '#22c55e';
    case 'processing': return '#6366f1';
    case 'rejected': return '#ef4444';
    default: return '#94a3b8';
  }
}

function statusIcon(s: string) {
  switch (s) {
    case 'pending': return <Clock size={12} color="#f97316" strokeWidth={2} />;
    case 'completed': return <CheckCircle size={12} color="#22c55e" strokeWidth={2} />;
    case 'processing': return <AlertTriangle size={12} color="#6366f1" strokeWidth={2} />;
    case 'rejected': return <AlertTriangle size={12} color="#ef4444" strokeWidth={2} />;
    default: return null;
  }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Withdrawal Card ────────────────────────────────────────────────

function WithdrawalCard({ item }: { item: WithdrawalRequest }) {
  const handleAction = (action: string) => {
    Alert.alert(action, `${action} withdrawal of ₹${item.amount} for ${item.userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: action, onPress: () => {} },
    ]);
  };

  return (
    <View style={s.card}>
      {/* Header: name + status */}
      <View style={s.cardHeader}>
        <View>
          <Text style={s.cardName}>{item.userName}</Text>
          <Text style={s.cardId}>ID: {item.userId}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: `${statusColor(item.status)}14` }]}>
          {statusIcon(item.status)}
          <Text style={[s.statusText, { color: statusColor(item.status) }]}>
            {capitalize(item.status)}
          </Text>
        </View>
      </View>

      {/* Details table */}
      <View style={s.detailsBox}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Amount</Text>
          <Text style={s.detailValue}>₹{item.amount.toLocaleString()}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Method</Text>
          <Text style={[s.detailValue, { color: '#3b82f6' }]}>{item.method}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Payment Details</Text>
          <Text style={s.detailValue} numberOfLines={1}>{item.paymentDetails}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Requested</Text>
          <Text style={s.detailValue}>{item.requestedAt}</Text>
        </View>
        {item.txnId && (
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>TXN ID</Text>
            <Text style={[s.detailValue, { color: '#3b82f6' }]}>{item.txnId}</Text>
          </View>
        )}
      </View>

      {/* Action buttons based on status */}
      {item.status === 'pending' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.actionBtn, s.processBtn]} onPress={() => handleAction('Process')}>
            <Text style={[s.actionBtnText, { color: '#3b82f6' }]}>Process</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.completeBtn]} onPress={() => handleAction('Complete')}>
            <Text style={[s.actionBtnText, { color: '#22c55e' }]}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={() => handleAction('Reject')}>
            <Text style={[s.actionBtnText, { color: '#ef4444' }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'processing' && (
        <TouchableOpacity style={[s.actionBtn, s.markCompleteBtn]} onPress={() => handleAction('Mark Complete')}>
          <Text style={[s.actionBtnText, { color: '#22c55e' }]}>Mark Complete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────

export const MobileAdminWithdrawals = () => {
  const nav = useNavigation<any>();
  const userName = useAuthStore((s) => s.user?.name);
  const [search, setSearch] = useState('');

  // TODO: Replace with actual admin withdrawal API when available
  const withdrawals: WithdrawalRequest[] = [];
  const isLoading = false;

  const filtered = useMemo(() => {
    if (!search.trim()) return withdrawals;
    const q = search.toLowerCase();
    return withdrawals.filter((w) => w.userName.toLowerCase().includes(q) || w.userId.toLowerCase().includes(q));
  }, [withdrawals, search]);

  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length;
  const processingCount = withdrawals.filter((w) => w.status === 'processing').length;
  const pendingAmount = withdrawals.filter((w) => w.status === 'pending').reduce((s, w) => s + w.amount, 0);

  if (isLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Shared admin header + section nav ────────── */}
        <MobileAdminNav active="AdminWithdrawals" />

        <View style={s.body}>
          {/* ── Title ─────────────────────────────────── */}
          <Text style={s.pageTitle}>Withdrawal Management</Text>
          <Text style={s.pageSub}>Process withdrawal requests and manage payouts</Text>

          {/* ── Search ────────────────────────────────── */}
          <View style={s.searchRow}>
            <Search size={16} color="#94a3b8" strokeWidth={2} />
            <TextInput style={s.searchInput} placeholder="Search by username..." placeholderTextColor="#94a3b8"
              value={search} onChangeText={setSearch} />
            <SlidersHorizontal size={18} color="#94a3b8" strokeWidth={2} />
          </View>

          {/* ── Stats 2×2 ─────────────────────────────── */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Total Requests</Text>
              <Text style={s.miniVal}>{withdrawals.length}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Pending</Text>
              <Text style={[s.miniVal, { color: '#f97316' }]}>{pendingCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Processing</Text>
              <Text style={[s.miniVal, { color: '#6366f1' }]}>{processingCount}</Text>
            </View>
            <View style={s.miniStat}>
              <Text style={s.miniLabel}>Pending Amount</Text>
              <Text style={[s.miniVal, { color: '#8b5cf6' }]}>₹{pendingAmount.toLocaleString()}</Text>
            </View>
          </View>

          {/* ── Withdrawal cards ──────────────────────── */}
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No withdrawal requests</Text>
              <Text style={s.emptySub}>{search ? 'Try a different search.' : 'Requests will appear here when users initiate withdrawals.'}</Text>
            </View>
          ) : (
            filtered.map((w) => <WithdrawalCard key={w._id} item={w} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  logoTxt: { fontSize: 16, fontWeight: '800', color: '#3b82f6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  avatarCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Nav
  navScroll: { backgroundColor: '#3b82f6', paddingBottom: 12 },
  navContent: { paddingHorizontal: 12, gap: 4 },
  navTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navTabActive: { backgroundColor: '#fff' },
  navLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  navLabelActive: { color: '#3b82f6', fontWeight: '700' },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 16 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  pageSub: { fontSize: 12, color: '#94a3b8', marginBottom: 14 },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#e8ecf2', marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  miniStat: { width: '48%' as any, flexGrow: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  miniLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  // Withdrawal card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  cardId: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Details
  detailsBox: { backgroundColor: '#F5F8FF', borderRadius: 10, padding: 12, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 12, color: '#94a3b8' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1e293b', maxWidth: '55%', textAlign: 'right' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  processBtn: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  completeBtn: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  rejectBtn: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  markCompleteBtn: { borderColor: '#22c55e', backgroundColor: '#f0fdf4', width: '100%' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 240 },
});
