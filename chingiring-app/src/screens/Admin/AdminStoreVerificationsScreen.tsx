/**
 * AdminStoreVerificationsScreen
 *
 * Lists stores with verificationStatus in ['pending', 'rejected'] so admin
 * can review the submitted document and either verify or reject each request.
 *
 * Works on both mobile (via AdminNavigator tab) and desktop (via DesktopAdminDrawer).
 */
import React, { useState, useCallback, useEffect } from 'react';
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
  Modal,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Clock, XCircle, FileText, ExternalLink,
  Check, X, Inbox, Maximize2, Mail, Phone, MapPin, User, RotateCcw,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { verificationAPI, type SellerStore, type VerificationStatus } from '../../api/verification';
import { MobileAdminNav } from '../../components/MobileAdminNav';

// ── Types ──────────────────────────────────────────────────────────────────
type FilterTab = 'pending' | 'rejected' | 'verified' | 'all';

// ── Helpers ────────────────────────────────────────────────────────────────
const DOC_LABEL: Record<string, string> = {
  gst:          'GST Certificate',
  fssai:        'FSSAI Licence',
  tradeLicence: 'Trade Licence',
};

// Quick-pick rejection reasons — tapping one appends it to the reason box.
const CANNED_REASONS = [
  'Document is blurry or unreadable',
  'Name on the ID does not match the owner',
  'Selfie does not match the ID photo',
  'Document has expired',
  'Wrong document type submitted',
  'Store details are incomplete',
];

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

const isPdfUrl = (url: string) => /\.pdf($|\?)/i.test(url);

type MediaItem = { url: string; label: string };

// ── Full-screen media viewer (tap-to-zoom; external fallback for PDFs) ───────
function MediaViewer({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const win = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => { setZoomed(false); }, [item?.url]);
  if (!item) return null;

  const pdf = isPdfUrl(item.url);
  const imgW = win.width;
  const imgH = win.height - 140;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={vw.backdrop}>
        <View style={vw.bar}>
          <Text style={vw.barLabel} numberOfLines={1}>{item.label}</Text>
          <View style={vw.barBtns}>
            <Pressable style={vw.barBtn} onPress={() => Linking.openURL(item.url).catch(() => {})} hitSlop={8}>
              <ExternalLink size={18} color="#fff" />
            </Pressable>
            <Pressable style={vw.barBtn} onPress={onClose} hitSlop={8}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        {pdf ? (
          <View style={vw.pdfBox}>
            <FileText size={60} color="rgba(255,255,255,0.55)" />
            <Text style={vw.pdfText}>This document is a PDF and can't preview here.</Text>
            <Pressable style={vw.pdfBtn} onPress={() => Linking.openURL(item.url).catch(() => {})}>
              <ExternalLink size={15} color="#fff" />
              <Text style={vw.pdfBtnText}>Open document</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={vw.imgScroll}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setZoomed((z) => !z)}>
              <Image
                source={{ uri: item.url }}
                style={{ width: imgW, height: imgH, transform: [{ scale: zoomed ? 2 : 1 }] }}
                resizeMode="contain"
              />
            </Pressable>
          </ScrollView>
        )}

        <Text style={vw.hint}>{pdf ? 'Opens in your browser' : 'Tap image to zoom · pinch to zoom in'}</Text>
      </View>
    </Modal>
  );
}

// ── Media thumbnail tile ─────────────────────────────────────────────────────
function MediaTile({ url, label, onOpen, style }: {
  url: string; label: string; onOpen: (item: MediaItem) => void; style?: any;
}) {
  const pdf = isPdfUrl(url);
  return (
    <Pressable style={[st.tile, style]} onPress={() => onOpen({ url, label })}>
      {pdf
        ? <View style={st.tilePdf}><FileText size={26} color={Colors.primary} /></View>
        : <Image source={{ uri: url }} style={st.tileImg} resizeMode="cover" />}
      <View style={st.tileLabelWrap}>
        <Text style={st.tileLabel} numberOfLines={1}>{label}</Text>
        {pdf ? <ExternalLink size={11} color="#fff" /> : <Maximize2 size={11} color="#fff" />}
      </View>
    </Pressable>
  );
}

// A slot showing a missing required piece (mirrors the approve-guard). */
function MissingTile({ label, style }: { label: string; style?: any }) {
  return (
    <View style={[st.tile, st.tileMissing, style]}>
      <XCircle size={20} color="#DC2626" />
      <Text style={st.tileMissingText}>{label}</Text>
    </View>
  );
}

// ── Store verification card ────────────────────────────────────────────────
interface CardProps {
  store: SellerStore;
  onVerify: (storeId: string) => void;
  onReject: (storeId: string, reason: string) => void;
  onReopen: (storeId: string) => void;
  onOpenMedia: (item: MediaItem) => void;
  verifying: boolean;
}

function VerificationCard({ store, onVerify, onReject, onReopen, onOpenMedia, verifying }: CardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const addReason = (r: string) =>
    setReason((prev) => (prev.trim() ? `${prev.trim()}; ${r}` : r));

  const confirmRevoke = () =>
    Alert.alert(
      'Revoke verification?',
      "This removes the store's verified badge and moves it back to Pending for re-review.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => onReopen(store._id) },
      ],
    );

  const cfg = STATUS_CONFIG[store.verificationStatus ?? 'pending'];
  const StatusIcon = cfg.Icon;
  const docLabel = DOC_LABEL[store.verificationDoc?.type ?? ''] ?? 'Document';
  const docUrl = store.verificationDoc?.url ?? '';
  const submittedAt = store.verificationDoc?.submittedAt as any;
  const rejectionReason = store.verificationDoc?.rejectionReason;
  const idDocUrl = store.identityDoc?.docUrl ?? '';
  const selfieUrl = store.identityDoc?.selfieUrl ?? '';
  const idLabel = ({ aadhaar: 'Aadhaar', pan: 'PAN', dl: 'Driving Licence', passport: 'Passport' } as Record<string, string>)[store.identityDoc?.type ?? ''] ?? 'Government ID';
  const canVerify = !!docUrl && !!idDocUrl && !!selfieUrl;

  const owner = store.owner;
  const locationText = [store.area, store.city].filter(Boolean).join(', ');
  const hasOwnerInfo = !!(owner?.name || owner?.email || owner?.phone || locationText);

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
          {!!store.category && <Text style={st.docType}>{store.category}</Text>}
          <Text style={st.submittedDate}>Submitted {fmtDate(submittedAt as string)}</Text>
        </View>

        <View style={[st.statusBadge, { backgroundColor: cfg.color + '20' }]}>
          <StatusIcon size={12} color={cfg.color} />
          <Text style={[st.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* ── Owner / account details (for matching against the govt ID) ── */}
      {hasOwnerInfo && (
        <View style={st.ownerBox}>
          {!!owner?.name && (
            <View style={st.ownerRow}>
              <User size={13} color={Colors.textSecondary} />
              <Text style={st.ownerVal} numberOfLines={1}>{owner.name}</Text>
            </View>
          )}
          {!!owner?.email && (
            <Pressable style={st.ownerRow} onPress={() => Linking.openURL(`mailto:${owner.email}`).catch(() => {})}>
              <Mail size={13} color={Colors.textSecondary} />
              <Text style={[st.ownerVal, st.ownerLink]} numberOfLines={1}>{owner.email}</Text>
            </Pressable>
          )}
          {!!owner?.phone && (
            <Pressable style={st.ownerRow} onPress={() => Linking.openURL(`tel:${owner.phone}`).catch(() => {})}>
              <Phone size={13} color={Colors.textSecondary} />
              <Text style={[st.ownerVal, st.ownerLink]} numberOfLines={1}>{owner.phone}</Text>
            </Pressable>
          )}
          {!!locationText && (
            <View style={st.ownerRow}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={st.ownerVal} numberOfLines={1}>{locationText}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Rejection reason (if rejected) ── */}
      {store.verificationStatus === 'rejected' && !!rejectionReason && (
        <View style={st.reasonBox}>
          <Text style={st.reasonLabel}>Rejection reason:</Text>
          <Text style={st.reasonText}>{rejectionReason}</Text>
        </View>
      )}

      {/* ── Store document ── */}
      {!!docUrl && (
        <View style={st.mediaSection}>
          <Text style={st.mediaHead}>Store document · {docLabel}</Text>
          <MediaTile url={docUrl} label={docLabel} onOpen={onOpenMedia} style={st.tileWide} />
        </View>
      )}

      {/* ── Identity check: government ID + selfie, side by side ── */}
      {(!!idDocUrl || !!selfieUrl) && (
        <View style={st.mediaSection}>
          <Text style={st.mediaHead}>Identity check</Text>
          <View style={st.tileRow}>
            {idDocUrl
              ? <MediaTile url={idDocUrl} label={idLabel} onOpen={onOpenMedia} style={st.tileHalf} />
              : <MissingTile label="No ID" style={st.tileHalf} />}
            {selfieUrl
              ? <MediaTile url={selfieUrl} label="Selfie" onOpen={onOpenMedia} style={st.tileHalf} />
              : <MissingTile label="No selfie" style={st.tileHalf} />}
          </View>
        </View>
      )}

      {/* ── Reject input (expanded) ── */}
      {rejectOpen && (
        <View style={st.rejectBox}>
          <Text style={st.chipsLabel}>Quick reasons — tap to add</Text>
          <View style={st.chipsWrap}>
            {CANNED_REASONS.map((r) => (
              <Pressable key={r} style={st.chip} onPress={() => addReason(r)}>
                <Text style={st.chipText}>{r}</Text>
              </Pressable>
            ))}
          </View>
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

      {/* ── Actions ── */}
      {!rejectOpen && (
        <View style={st.actionsWrap}>
          {verifying ? (
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 8 }} />
          ) : store.verificationStatus === 'verified' ? (
            // Verified → allow revoke (back to Pending for re-review)
            <Pressable style={st.revokeBtn} onPress={confirmRevoke}>
              <RotateCcw size={15} color="#B45309" strokeWidth={2.5} />
              <Text style={st.revokeText}>Revoke verification</Text>
            </Pressable>
          ) : (
            <>
              <View style={st.actions}>
                <Pressable
                  style={[st.verifyBtn, !canVerify && { opacity: 0.4 }]}
                  onPress={() => onVerify(store._id)}
                  disabled={!canVerify}
                >
                  <Check size={15} color="#fff" strokeWidth={2.5} />
                  <Text style={st.verifyText}>Verify</Text>
                </Pressable>
                <Pressable style={st.rejectBtn} onPress={() => setRejectOpen(true)}>
                  <X size={15} color="#DC2626" strokeWidth={2.5} />
                  <Text style={st.rejectText}>Reject</Text>
                </Pressable>
              </View>
              {/* Rejected → offer a neutral re-open without approving */}
              {store.verificationStatus === 'rejected' && (
                <Pressable style={st.reopenLink} onPress={() => onReopen(store._id)}>
                  <RotateCcw size={13} color={Colors.textSecondary} />
                  <Text style={st.reopenText}>Re-open — move back to Pending</Text>
                </Pressable>
              )}
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
  const [viewer, setViewer] = useState<MediaItem | null>(null);

  const qc = useQueryClient();

  // Fetch pending + rejected + verified (the verification-relevant stores); we
  // filter locally per tab so counts stay live and a decided store moves tabs
  // instead of vanishing.
  const { data: allStores = [], isLoading, isRefetching, refetch } = useQuery<SellerStore[]>({
    queryKey: ['admin', 'verifications'],
    queryFn: () => verificationAPI.adminListVerifications(['pending', 'rejected', 'verified']),
    staleTime: 30_000,
  });

  const pending  = allStores.filter((s) => s.verificationStatus === 'pending');
  const rejected = allStores.filter((s) => s.verificationStatus === 'rejected');
  const verified = allStores.filter((s) => s.verificationStatus === 'verified');
  const displayed =
    filter === 'pending' ? pending
    : filter === 'rejected' ? rejected
    : filter === 'verified' ? verified
    : allStores;

  const { mutate: setStatus } = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'verified' | 'rejected' | 'pending'; reason?: string }) =>
      verificationAPI.adminSetStatus(id, status, reason),
    onMutate: ({ id }) => setActionStoreId(id),
    onError: (err: any) => {
      Alert.alert('Could not update', err?.response?.data?.message ?? err?.message ?? 'Please try again.');
    },
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

  const handleReopen = useCallback((id: string) => {
    setStatus({ id, status: 'pending' });
  }, [setStatus]);

  // ── Filter tab pills ────────────────────────────────────────────────────
  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending',  label: 'Pending',  count: pending.length  },
    { key: 'rejected', label: 'Rejected', count: rejected.length },
    { key: 'verified', label: 'Verified', count: verified.length },
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
                  {filter === 'pending' ? 'No pending verifications'
                    : filter === 'rejected' ? 'No rejected stores'
                    : filter === 'verified' ? 'No verified stores yet'
                    : 'No verifications to review'}
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
          onReopen={handleReopen}
          onOpenMedia={setViewer}
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

      <MediaViewer item={viewer} onClose={() => setViewer(null)} />
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

  // Owner / account details
  ownerBox: {
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 10, padding: 12, gap: 8,
  },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ownerVal: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.text, flexShrink: 1 },
  ownerLink: { color: Colors.primary, fontFamily: Fonts.semiBold },

  // Media (documents / identity)
  mediaSection: { gap: 8 },
  mediaHead: {
    fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundGrey,
  },
  tileWide: { alignSelf: 'stretch', height: 150 },
  tileHalf: { flex: 1, height: 132 },
  tileImg: { width: '100%', height: '100%' },
  tilePdf: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight10,
  },
  tileLabelWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileLabel: { color: '#fff', fontSize: 11.5, fontFamily: Fonts.semiBold, flexShrink: 1 },
  tileMissing: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderStyle: 'dashed', borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  tileMissingText: { color: '#DC2626', fontSize: 12, fontFamily: Fonts.semiBold },

  // Actions (revoke / re-open)
  actionsWrap: { gap: 8 },
  revokeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 10, paddingVertical: 10,
  },
  revokeText: { color: '#B45309', fontSize: 14, fontFamily: Fonts.bold },
  reopenLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 6,
  },
  reopenText: { color: Colors.textSecondary, fontSize: 12.5, fontFamily: Fonts.semiBold },

  // Canned reject-reason chips
  chipsLabel: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: Colors.backgroundGrey, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.text },
});

// ── Media viewer styles ──────────────────────────────────────────────────────
const vw = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingTop: 44, paddingBottom: 12,
  },
  barLabel: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold, flex: 1 },
  barBtns: { flexDirection: 'row', gap: 8 },
  barBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  imgScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  pdfBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  pdfText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10,
  },
  pdfBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: 14 },
});
