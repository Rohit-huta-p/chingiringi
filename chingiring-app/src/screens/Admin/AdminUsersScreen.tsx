import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, Platform, Dimensions, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, CheckCircle, Ban, IndianRupee, Coins,
  ShoppingBag, Users2, DollarSign,
} from 'lucide-react-native';
import { Colors, Spacing } from '../../constants/theme';
import { adminAPI } from '../../api/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  role?: string;
  status?: 'active' | 'blocked';
  isBlocked?: boolean;
  createdAt: string;
  lastLoginAt?: string;
  wallet?: {
    confirmedCashback?: number;
    pendingCashback?: number;
    coins?: number;
  };
  stats?: {
    orders?: number;
    referrals?: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#64748b', '#16a34a', '#ea580c', '#0891b2'];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function firstInitial(name?: string) {
  if (!name) return 'U';
  return name.trim()[0]?.toUpperCase() || 'U';
}

function isoDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function userStatus(u: AdminUser): 'active' | 'blocked' {
  if (u.status === 'blocked' || u.isBlocked) return 'blocked';
  return 'active';
}

function userBalance(u: AdminUser): number {
  const w = u.wallet;
  return (w?.confirmedCashback ?? 0) + (w?.pendingCashback ?? 0);
}

// ─── Wallet Adjust Modal ────────────────────────────────────────────────────

function WalletAdjustModal({
  visible, onClose, user, type,
}: {
  visible: boolean;
  onClose: () => void;
  user: AdminUser | null;
  type: 'credit' | 'debit';
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'cashback' | 'coins'>('cashback');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');
      return adminAPI.adjustUserWallet(user._id, {
        type,
        amount: parseFloat(amount) || 0,
        currency,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
      setAmount(''); setNote(''); setCurrency('cashback');
    },
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to adjust wallet'),
  });

  const handleSubmit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      Alert.alert('Validation', 'Enter a valid positive amount.');
      return;
    }
    mutation.mutate();
  };

  const screenWidth = Dimensions.get('window').width;
  const modalWidth = Math.min(screenWidth - 40, 460);
  const isCredit = type === 'credit';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: modalWidth }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isCredit ? 'Credit Wallet' : 'Debit Wallet'}
              {user ? ` — ${user.name}` : ''}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {/* Currency segment */}
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.segmentRow}>
              {(['cashback', 'coins'] as const).map((c) => {
                const active = currency === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {c === 'cashback' ? 'Cashback (₹)' : 'Coins'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <Text style={styles.fieldLabel}>
              Amount {currency === 'cashback' ? '(₹)' : '(coins)'}
            </Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={currency === 'cashback' ? 'e.g., 100' : 'e.g., 500'}
              placeholderTextColor="#94a3b8"
            />

            {/* Reason */}
            <Text style={styles.fieldLabel}>Reason / Note</Text>
            <TextInput
              style={[styles.input, { minHeight: 64 }]}
              value={note}
              onChangeText={setNote}
              placeholder={isCredit ? 'e.g., Goodwill credit for delayed payout' : 'e.g., Reversed duplicate cashback'}
              placeholderTextColor="#94a3b8"
              multiline
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: isCredit ? '#16a34a' : '#dc2626' },
              ]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isCredit ? 'Credit' : 'Debit'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

// Mobile card — replaces the desktop 6-column table row below 768px. Stacks the
// same data (identity, wallet, activity, status, joined, actions) into a card.
function MobileUserCard({
  u, disabled, onToggle, onCredit, onDebit,
}: {
  u: AdminUser;
  disabled: boolean;
  onToggle: () => void;
  onCredit: () => void;
  onDebit: () => void;
}) {
  const isBlocked = userStatus(u) === 'blocked';
  return (
    <View style={styles.mCard}>
      <View style={styles.mCardTop}>
        <View style={[styles.avatar, { backgroundColor: avatarColor(u._id) }]}>
          <Text style={styles.avatarTxt}>{firstInitial(u.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
          {u.email ? <Text style={styles.userMeta} numberOfLines={1}>{u.email}</Text> : null}
          {u.phone ? <Text style={styles.userMeta} numberOfLines={1}>{u.phone}</Text> : null}
        </View>
        {isBlocked ? (
          <View style={[styles.statusPill, { backgroundColor: '#fee2e2' }]}>
            <Ban size={12} color="#dc2626" strokeWidth={2.5} />
            <Text style={[styles.statusPillTxt, { color: '#dc2626' }]}>Blocked</Text>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: '#dcfce7' }]}>
            <CheckCircle size={12} color="#16a34a" strokeWidth={2.5} />
            <Text style={[styles.statusPillTxt, { color: '#16a34a' }]}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.mCardGrid}>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Confirmed</Text>
          <Text style={[styles.mStatVal, { color: '#16a34a' }]}>₹{(u.wallet?.confirmedCashback ?? 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Pending</Text>
          <Text style={[styles.mStatVal, { color: '#d97706' }]}>₹{(u.wallet?.pendingCashback ?? 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Coins</Text>
          <Text style={[styles.mStatVal, { color: '#7c3aed' }]}>{(u.wallet?.coins ?? 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Orders</Text>
          <Text style={[styles.mStatVal, { color: '#2563eb' }]}>{(u.stats?.orders ?? 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Referrals</Text>
          <Text style={[styles.mStatVal, { color: '#0891b2' }]}>{(u.stats?.referrals ?? 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.mStat}>
          <Text style={styles.mStatLabel}>Joined</Text>
          <Text style={styles.mStatVal}>{isoDate(u.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.mCardActions}>
        <TouchableOpacity
          style={[styles.actBtn, isBlocked ? styles.actUnblock : styles.actBlock, { flex: 1 }]}
          onPress={onToggle}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text style={[styles.actBtnTxt, { color: isBlocked ? '#16a34a' : '#dc2626' }]}>{isBlocked ? 'Unblock' : 'Block'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actBtn, styles.actCredit, { flex: 1 }]} onPress={onCredit} activeOpacity={0.8}>
          <Text style={[styles.actBtnTxt, { color: '#16a34a' }]}>+ Credit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actBtn, styles.actDebit, { flex: 1 }]} onPress={onDebit} activeOpacity={0.8}>
          <Text style={[styles.actBtnTxt, { color: '#dc2626' }]}>− Debit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function AdminUsersScreen() {
  const [search, setSearch] = useState('');
  const [walletUser, setWalletUser] = useState<AdminUser | null>(null);
  const [walletType, setWalletType] = useState<'credit' | 'debit'>('credit');
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  // Mobile layout — native OR narrow web. Renders the shared admin nav header
  // (all section tabs) so Users matches the Dashboard on native + phone-web.
  const isMobile = Platform.OS !== 'web' || width < 768;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: async () => {
      try {
        return await adminAPI.getUsers({
          limit: 50,
          search: search.trim() || undefined,
        });
      } catch {
        return { data: { users: [], total: 0 } };
      }
    },
    staleTime: 30_000,
  });

  const users: AdminUser[] =
    data?.data?.users ?? data?.users ?? data?.data ?? [];

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'block' | 'unblock' }) =>
      adminAPI.updateUserStatus(payload.id, payload.action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (err: any) =>
      Alert.alert('Error', err?.message || 'Failed to update user status'),
  });

  const handleBlockToggle = (u: AdminUser) => {
    const willBlock = userStatus(u) === 'active';
    const title = willBlock ? 'Block User' : 'Unblock User';
    const msg = `${title}: ${u.name}?`;
    const go = () =>
      statusMutation.mutate({ id: u._id, action: willBlock ? 'block' : 'unblock' });
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && (window as any).confirm(msg)) go();
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: go },
      ]);
    }
  };

  const openWalletModal = (u: AdminUser, type: 'credit' | 'debit') => {
    setWalletUser(u);
    setWalletType(type);
  };

  // Stats
  const total = users.length;
  const active = users.filter((u) => userStatus(u) === 'active').length;
  const blocked = users.filter((u) => userStatus(u) === 'blocked').length;
  const totalBalance = users.reduce((acc, u) => acc + userBalance(u), 0);

  // Search filter (client-side reinforcement; server already filters via ?search)
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q),
    );
  }, [users, search]);

  // On mobile the whole screen scrolls as one unit (like MobileAdminDashboard).
  // A nested ScrollView inside a flex View has no bounded height on web, so the
  // list below the search box wasn't scrollable — a single outer scroll fixes it.
  const Body: any = isMobile ? ScrollView : View;
  const bodyProps = isMobile
    ? {
        style: { flex: 1 },
        contentContainerStyle: { padding: Spacing.lg, paddingBottom: 32 },
        showsVerticalScrollIndicator: false,
      }
    : { style: styles.container };

  return (
    <SafeAreaView style={styles.root} edges={isMobile ? ['top'] : []}>
      {isMobile ? <MobileAdminNav active="AdminUsers" /> : null}
      <Body {...bodyProps}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>User Management</Text>
          <Text style={styles.pageSubtitle}>
            Manage users, view profiles, and handle customer support
          </Text>
        </View>
      </View>

      {/* Stats row — 4 cards (2 per row on mobile) */}
      <View style={[styles.statsRow, isMobile && { flexWrap: 'wrap' }]}>
        <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
          <Text style={styles.statLabel}>Total Users</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>{total}</Text>
        </View>
        <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
          <Text style={[styles.statLabel, { color: '#15803d' }]}>Active Users</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{active}</Text>
        </View>
        <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
          <Text style={[styles.statLabel, { color: '#b91c1c' }]}>Blocked Users</Text>
          <Text style={[styles.statValue, { color: '#dc2626' }]}>{blocked}</Text>
        </View>
        <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
          <Text style={[styles.statLabel, { color: '#6d28d9' }]}>Total Balance</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>
            ₹{totalBalance.toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Search size={16} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
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

      {/* Cards on mobile · 6-column table on desktop */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : isMobile ? (
        filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Users2 size={28} color="#cbd5e1" strokeWidth={1.5} />
            <Text style={styles.emptyText}>
              {search.trim() ? `No users match "${search}".` : 'No users yet.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, paddingTop: 4 }}>
            {filtered.map((u) => (
              <MobileUserCard
                key={u._id}
                u={u}
                disabled={statusMutation.isPending}
                onToggle={() => handleBlockToggle(u)}
                onCredit={() => openWalletModal(u, 'credit')}
                onDebit={() => openWalletModal(u, 'debit')}
              />
            ))}
          </View>
        )
      ) : (
        <ScrollView>
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>User</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Wallet</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Activity</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Joined</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Actions</Text>
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Users2 size={28} color="#cbd5e1" strokeWidth={1.5} />
                <Text style={styles.emptyText}>
                  {search.trim() ? `No users match "${search}".` : 'No users yet.'}
                </Text>
              </View>
            ) : (
              filtered.map((u, idx) => {
                const status = userStatus(u);
                const isBlocked = status === 'blocked';
                return (
                  <View
                    key={u._id}
                    style={[
                      styles.tableRow,
                      idx === filtered.length - 1 && styles.tableRowLast,
                    ]}
                  >
                    {/* User cell */}
                    <View style={{ flex: 2.2, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <View style={[styles.avatar, { backgroundColor: avatarColor(u._id) }]}>
                        <Text style={styles.avatarTxt}>{firstInitial(u.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                        {u.email ? (
                          <Text style={styles.userMeta} numberOfLines={1}>{u.email}</Text>
                        ) : null}
                        {u.phone ? (
                          <Text style={styles.userMeta} numberOfLines={1}>{u.phone}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Wallet cell */}
                    <View style={{ flex: 1.6, gap: 4 }}>
                      <View style={styles.walletLine}>
                        <DollarSign size={12} color="#16a34a" strokeWidth={2.5} />
                        <Text style={styles.walletTxt}>
                          ₹{(u.wallet?.confirmedCashback ?? 0).toLocaleString('en-IN')}{' '}
                          <Text style={styles.walletMuted}>(confirmed)</Text>
                        </Text>
                      </View>
                      <View style={styles.walletLine}>
                        <IndianRupee size={12} color="#d97706" strokeWidth={2.5} />
                        <Text style={styles.walletTxt}>
                          ₹{(u.wallet?.pendingCashback ?? 0).toLocaleString('en-IN')}{' '}
                          <Text style={styles.walletMuted}>(pending)</Text>
                        </Text>
                      </View>
                      <View style={styles.walletLine}>
                        <Coins size={12} color="#7c3aed" strokeWidth={2.5} />
                        <Text style={styles.walletTxt}>
                          {(u.wallet?.coins ?? 0).toLocaleString('en-IN')}{' '}
                          <Text style={styles.walletMuted}>coins</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Activity cell */}
                    <View style={{ flex: 1.3, gap: 4 }}>
                      <View style={styles.walletLine}>
                        <ShoppingBag size={12} color="#2563eb" strokeWidth={2.5} />
                        <Text style={styles.walletTxt}>
                          {(u.stats?.orders ?? 0).toLocaleString('en-IN')} orders
                        </Text>
                      </View>
                      <View style={styles.walletLine}>
                        <Users2 size={12} color="#0891b2" strokeWidth={2.5} />
                        <Text style={styles.walletTxt}>
                          {(u.stats?.referrals ?? 0).toLocaleString('en-IN')} referrals
                        </Text>
                      </View>
                    </View>

                    {/* Status cell */}
                    <View style={{ flex: 1.2 }}>
                      {isBlocked ? (
                        <View style={[styles.statusPill, { backgroundColor: '#fee2e2' }]}>
                          <Ban size={12} color="#dc2626" strokeWidth={2.5} />
                          <Text style={[styles.statusPillTxt, { color: '#dc2626' }]}>
                            Blocked
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: '#dcfce7' }]}>
                          <CheckCircle size={12} color="#16a34a" strokeWidth={2.5} />
                          <Text style={[styles.statusPillTxt, { color: '#16a34a' }]}>
                            Active
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Joined cell */}
                    <View style={{ flex: 1.4 }}>
                      <Text style={styles.dateTxt}>{isoDate(u.createdAt)}</Text>
                      <Text style={styles.dateMeta}>
                        Last: {isoDate(u.lastLoginAt || u.createdAt)}
                      </Text>
                    </View>

                    {/* Actions cell */}
                    <View style={{ flex: 2.2, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={[
                          styles.actBtn,
                          isBlocked ? styles.actUnblock : styles.actBlock,
                        ]}
                        onPress={() => handleBlockToggle(u)}
                        disabled={statusMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.actBtnTxt,
                            { color: isBlocked ? '#16a34a' : '#dc2626' },
                          ]}
                        >
                          {isBlocked ? 'Unblock' : 'Block'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actBtn, styles.actCredit]}
                        onPress={() => openWalletModal(u, 'credit')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actBtnTxt, { color: '#16a34a' }]}>+ Credit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actBtn, styles.actDebit]}
                        onPress={() => openWalletModal(u, 'debit')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.actBtnTxt, { color: '#dc2626' }]}>− Debit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <WalletAdjustModal
        visible={walletUser !== null}
        onClose={() => setWalletUser(null)}
        user={walletUser}
        type={walletType}
      />
      </Body>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
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
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },
  // 2 per row on mobile: basis 45% leaves room for the row gap (so two fit and
  // a third wraps), flexGrow makes the pair fill the width. flexBasis overrides
  // the basis:0 that statCard's `flex:1` sets.
  statCardMobile: { flexBasis: '45%', flexGrow: 1 },

  // ── Mobile user card (replaces the 6-column table below 768px) ──
  mCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8ecf2', padding: 14, gap: 12 },
  mCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mCardGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 10 },
  mStat: { flexBasis: '30%', flexGrow: 1 },
  mStatLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  mStatVal: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  mCardActions: { flexDirection: 'row', gap: 8 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  userMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Wallet / Activity lines
  walletLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletTxt: { fontSize: 12, fontWeight: '500', color: Colors.text },
  walletMuted: { color: '#94a3b8', fontWeight: '400' },

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

  // Action buttons
  actBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  actBtnTxt: { fontSize: 12, fontWeight: '700' },
  actBlock: { backgroundColor: '#fee2e2' },
  actUnblock: { backgroundColor: '#dcfce7' },
  actCredit: { backgroundColor: '#dcfce7' },
  actDebit: { backgroundColor: '#fee2e2' },

  // Empty
  emptyState: { padding: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, flex: 1 },
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

  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },

  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
});
