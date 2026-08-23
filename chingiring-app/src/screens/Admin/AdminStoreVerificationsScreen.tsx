/**
 * AdminStoreVerificationsScreen
 *
 * Lists stores with verificationStatus in ['pending', 'rejected'] so admin
 * can review the submitted document and either verify or reject each request.
 *
 * Works on both mobile (via AdminNavigator tab) and desktop (via DesktopAdminDrawer).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Image,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Clock, XCircle, FileText, ExternalLink,
  Check, X, Inbox,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { verificationAPI, type SellerStore, type VerificationStatus } from '../../api/verification';
import { MobileAdminNav } from '../../components/MobileAdminNav';

// ── Types ──────────────────────────────────────────────────────────────────
type FilterTab = 'pending' | 'rejected' | 'all';

// ── Helpers ────────────────────────────────────────────────────────────────
const DOC_LABEL: Record<string, string> = {
  gst:          'GST Certificate',
  fssai:        'FSSAI Licence',
  tradeLicence: 'Trade Licence',
};

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_CONFIG: Record<string, { color: string; label: string; Icon: React.ComponentType<any> }> = {
  pending:  { color: '#F59E0B', label: 'Pending',  Icon: Clock       },
  verified: { color: '#16A34A', label: 'Verified', Icon: ShieldCheck  },
  rejected: { color: '#DC2626', label: 'Rejected', Icon: XCircle      },
};

// ── Store verification card ────────────────────────────────────────────────
interface CardProps {
  store: SellerStore;
  onVerify: (storeId: string) => void;
  onReject: (storeId: string, reason: string) => void;
  verifying: boolean;
}

function VerificationCard({ store, onVerify, onReject, verifying }: CardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const cfg = STATUS_CONFIG[store.verificationStatus ?? 'pending'];
  const StatusIcon = cfg.Icon;
  const docLabel = DOC_LABEL[store.verificationDoc?.type ?? ''] ?? 'Document';
  const docUrl = store.verificationDoc?.url ?? '';
  const submittedAt = store.verificationDoc?.submittedAt as any;
  const rejectionReason = store.verificationDoc?.rejectionReason;

  const handleConfirmReject = () => {
    if (!reason.trim()) return;
    onReject(store._id, reason.trim());
    setRejectOpen(false);
    setReason('');
  };

  return (
    <View style={st.card}>
      {/* ── Top row: avatar + store info + status badge ── */}
      <View style={st.cardTop}>
        <View style={st.avatar}>
          {store.logoUrl
            ? <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Text style={st.avatarText}>{initials(store.name)}</Text>}
        </View>

        <View style={st.cardInfo}>
          <Text style={st.storeName} numberOfLines={1}>{store.name}</Text>
          <Text style={st.docType}>{docLabel}</Text>
          <Text style={st.submittedDate}>Submitted {fmtDate(submittedAt as string)}</Text>
        </View>

        <View style={[st.statusBadge, { backgroundColor: cfg.color + '20' }]}>
          <StatusIcon size={12} color={cfg.color} />
          <Text style={[st.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* ── Rejection reason (if rejected) ── */}
      {store.verificationStatus === 'rejected' && !!rejectionReason && (
        <View style={st.reasonBox}>
          <Text style={st.reasonLabel}>Rejection reason:</Text>
          <Text style={st.reasonText}>{rejectionReason}</Text>
        </View>
      )}

      {/* ── Document link ── */}
      {!!docUrl && (
        <Pressable
          style={st.docLink}
          onPress={() => Linking.openURL(docUrl).catch(() => {})}
        >
          <FileText size={14} color={Colors.primary} />
          <Text style={st.docLinkText}>View Submitted Document</Text>
          <ExternalLink size={12} color={Colors.primary} />
        </Pressable>
      )}

      {/* ── Reject input (expanded) ── */}
      {rejectOpen && (
        <View style={st.rejectBox}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for rejection (required)"
            placeholderTextColor={Colors.textSecondary}
            style={st.rejectInput}
            multiline
            numberOfLines={2}
            autoFocus
          />
          <View style={st.rejectActions}>
            <Pressable style={st.cancelBtn} onPress={() => { setRejectOpen(false); setReason(''); }}>
              <X size={14} color={Colors.textSecondary} />
              <Text style={st.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[st.confirmRejectBtn, !reason.trim() && { opacity: 0.4 }]}
              onPress={handleConfirmReject}
              disabled={!reason.trim()}
            >
              <Text style={st.confirmRejectText}>Confirm Reject</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Action buttons ── */}
      {!rejectOpen && (
        <View style={st.actions}>
          {verifying ? (
            <ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />
          ) : (
            <>
              <Pressable
                style={st.verifyBtn}
                onPress={() => onVerify(store._id)}
              >
                <Check size={15} color="#fff" strokeWidth={2.5} />
                <Text style={st.verifyText}>Verify</Text>
              </Pressable>
              <Pressable
                style={st.rejectBtn}
                onPress={() => setRejectOpen(true)}
              >
                <X size={15} color="#DC2626" strokeWidth={2.5} />
                <Text style={st.rejectText}>Reject</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export function AdminStoreVerificationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 768;

  const [filter, setFilter] = useState<FilterTab>('pending');
  const [actionStoreId, setActionStoreId] = useState<string | null>(null);

  const qc = useQueryClient();

  // Fetch pending + rejected stores (both always; we filter locally so counts are live)
  const { data: allStores = [], isLoading, isRefetching, refetch } = useQuery<SellerStore[]>({
    queryKey: ['admin', 'verifications'],
    queryFn: () => verificationAPI.adminListVerifications(['pending', 'rejected']),
    staleTime: 30_000,
  });

  const pending  = allStores.filter((s) => s.verificationStatus === 'pending');
  const rejected = allStores.filter((s) => s.verificationStatus === 'rejected');
  const displayed = filter === 'pending' ? pending : filter === 'rejected' ? rejected : allStores;

  const { mutate: setStatus } = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'verified' | 'rejected'; reason?: string }) =>
      verificationAPI.adminSetStatus(id, status, reason),
    onMutate: ({ id }) => setActionStoreId(id),
    onSettled: () => {
      setActionStoreId(null);
      qc.invalidateQueries({ queryKey: ['admin', 'verifications'] });
    },
  });

  const handleVerify = useCallback((id: string) => {
    setStatus({ id, status: 'verified' });
  }, [setStatus]);

  const handleReject = useCallback((id: string, reason: string) => {
    setStatus({ id, status: 'rejected', reason });
  }, [setStatus]);

  // ── Filter tab pills ────────────────────────────────────────────────────
  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending',  label: 'Pending',  count: pending.length  },
    { key: 'rejected', label: 'Rejected', count: rejected.length },
    { key: 'all',      label: 'All',      count: allStores.length },
  ];

  const listContent = (
    <FlatList
      data={displayed}
      keyExtractor={(item) => item._id}
      contentContainerStyle={[
        st.listContent,
        { paddingBottom: insets.bottom + (isMobile ? 80 : 24) },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
      ListEmptyComponent={
        <View style={st.empty}>
          {isLoading
            ? <ActivityIndicator color={Colors.primary} size="large" />
            : (
              <>
                <Inbox size={52} color={Colors.border} />
                <Text style={st.emptyTitle}>
                  {filter === 'pending' ? 'No pending verifications' : filter === 'rejected' ? 'No rejected stores' : 'No verifications to review'}
                </Text>
                <Text style={st.emptySub}>Stores that submit documents appear here.</Text>
              </>
            )}
        </View>
      }
      renderItem={({ item }) => (
        <VerificationCard
          store={item}
          onVerify={handleVerify}
          onReject={handleReject}
          verifying={actionStoreId === item._id}
        />
      )}
    />
  );

  // ── Desktop two-column wrapper or mobile full-width ─────────────────────
  return (
    <View style={[st.root, isMobile && { paddingTop: insets.top }]}>
      {isMobile && <MobileAdminNav active="AdminStoreVerifications" />}

      {/* Filter pills */}
      <View style={[st.pills, !isMobile && { paddingHorizontal: 24 }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[st.pill, filter === tab.key && st.pillActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[st.pillText, filter === tab.key && st.pillTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[st.pillBadge, filter === tab.key && st.pillBadgeActive]}>
                <Text style={[st.pillBadgeText, filter === tab.key && { color: Colors.primary }]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {isMobile ? listContent : (
        <View style={st.desktopWrap}>
          {listContent}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  pills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.backgroundGrey,
  },
  pillActive: { backgroundColor: Colors.primaryLight10 },
  pillText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  pillTextActive: { color: Colors.primary },
  pillBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  pillBadgeActive: { backgroundColor: Colors.primary + '22' },
  pillBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textSecondary },

  listContent: { padding: 16, gap: 12 },

  desktopWrap: { flex: 1, maxWidth: 720, alignSelf: 'center', width: '100%' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  avatar: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.primaryLight10,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.primary },

  cardInfo: { flex: 1, gap: 2 },
  storeName: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text },
  docType: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  submittedDate: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontFamily: Fonts.bold },

  reasonBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: 10, gap: 2,
  },
  reasonLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#DC2626' },
  reasonText: { fontSize: 13, fontFamily: Fonts.regular, color: '#DC2626', lineHeight: 18 },

  docLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight10,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  docLinkText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },

  actions: { flexDirection: 'row', gap: 10 },

  verifyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#16A34A',
    borderRadius: 10, paddingVertical: 10,
  },
  verifyText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },

  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, paddingVertical: 10,
  },
  rejectText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.bold },

  rejectBox: { gap: 10 },
  rejectInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.text,
    backgroundColor: Colors.background,
    minHeight: 64, textAlignVertical: 'top',
  },
  rejectActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 8, backgroundColor: Colors.backgroundGrey,
  },
  cancelText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  confirmRejectBtn: {
    flex: 1, backgroundColor: '#DC2626',
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  confirmRejectText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
