/**
 * StoreVerificationScreen — seller submits a document for store verification.
 *
 * Reachable from:
 *   • BusinessOnboardingScreen (after store creation)
 *   • SellerDashboardScreen / MyStoreScreen / GoLiveTabScreen (verify banners)
 *
 * Route params:
 *   store?: SellerStore   — the seller's store object (may be null if creation 403'd)
 *
 * Renders one of 4 full-card states: unverified (upload form) → pending
 * (under review) → verified (done) or rejected (reason + resubmit, which
 * resets back to the unverified form).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ShieldCheck, Clock, XCircle, FileText, Truck, Receipt,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { MultiImageUploader } from '../../components/MultiImageUploader';
import { verificationAPI, type SellerStore, type VerificationStatus, type DocType } from '../../api/verification';
import { MY_STORE_QUERY_KEY } from '../../hooks/useMyStore';

// Status colors not in the shared theme — one-off semantic accents specific
// to this screen's four states (amber/green/red), distinct from the brand
// palette in constants/theme.
const STATE_COLOR = {
  pending: '#F59E0B',
  verified: '#16A34A',
  rejected: '#DC2626',
};

const DOC_TYPES: { value: DocType; label: string; sub: string; icon: React.ComponentType<any> }[] = [
  { value: 'gst', label: 'GST Certificate', sub: 'Government-issued GST registration document', icon: FileText },
  { value: 'fssai', label: 'FSSAI Licence', sub: 'Food safety licence (for food & grocery stores)', icon: Receipt },
  { value: 'tradeLicence', label: 'Trade Licence', sub: 'Municipal trade / shop licence', icon: Truck },
];

function fmtDate(d?: string | Date): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Doc type chip ──────────────────────────────────────────────────────────
const DocChip: React.FC<{
  selected: boolean; onPress: () => void; icon: React.ComponentType<any>; label: string;
}> = ({ selected, onPress, icon: Icon, label }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && { opacity: 0.85 }]}
  >
    <Icon size={16} color={selected ? '#fff' : Colors.textSecondary} />
    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const StoreVerificationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const route = useRoute<any>();

  const passedStore: SellerStore | null = route.params?.store ?? null;
  const initialStatus: VerificationStatus = passedStore?.verificationStatus ?? 'unverified';

  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [docType, setDocType] = useState<DocType>('gst');
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const rejectionReason = passedStore?.verificationDoc?.rejectionReason;
  const submittedAt = passedStore?.verificationDoc?.submittedAt as any;
  const docSub = DOC_TYPES.find((d) => d.value === docType)?.label ?? 'document';

  const goToMain = () => {
    // Ensure the Dashboard / My Store show the latest store + status (created or
    // just submitted for verification) rather than a stale cache.
    queryClient.invalidateQueries({ queryKey: MY_STORE_QUERY_KEY });
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
  };

  const handleSubmit = async () => {
    if (!passedStore?._id) { goToMain(); return; }
    if (docUrls.length === 0) {
      Alert.alert('No document', 'Please upload a photo or PDF of your document.');
      return;
    }
    setSubmitting(true);
    try {
      await verificationAPI.submitVerification(passedStore._id, { docType, docUrl: docUrls[0] });
      setStatus('pending');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Submission failed.';
      Alert.alert('Could not submit', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = () => {
    setDocUrls([]);
    setStatus('unverified');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => (navigation.canGoBack() ? navigation.goBack() : goToMain())} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Store Verification</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* ── Unverified: upload form ── */}
          {status === 'unverified' && (
            <>
              <FileText size={48} color={Colors.orange} style={styles.stateIcon} />
              <Text style={styles.stateTitle}>Verify Your Store</Text>
              <Text style={styles.stateSub}>Submit a document to unlock live streaming</Text>

              <Text style={styles.fieldLabel}>Document Type</Text>
              <View style={styles.chipRow}>
                {DOC_TYPES.map((d) => (
                  <DocChip
                    key={d.value}
                    selected={docType === d.value}
                    onPress={() => setDocType(d.value)}
                    icon={d.icon}
                    label={d.label}
                  />
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Upload Document</Text>
              <Text style={styles.fieldHint}>Clear photo or PDF showing your {docSub.toLowerCase()} number.</Text>
              <MultiImageUploader
                value={docUrls}
                onChange={setDocUrls}
                max={1}
                folder="seller-verification"
                coverLabel="Document"
              />

              <Pressable
                onPress={handleSubmit}
                disabled={submitting || docUrls.length === 0}
                style={[styles.cta, (submitting || docUrls.length === 0) && styles.ctaDisabled]}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.ctaText}>Submit for Verification</Text>}
              </Pressable>

              <Pressable onPress={goToMain} style={styles.skipBtn}>
                <Text style={styles.skipText}>
                  {passedStore ? 'Skip for now — verify later' : 'Continue to Dashboard'}
                </Text>
              </Pressable>
            </>
          )}

          {/* ── Pending ── */}
          {status === 'pending' && (
            <>
              <Clock size={48} color={STATE_COLOR.pending} style={styles.stateIcon} />
              <Text style={styles.stateTitle}>Under Review</Text>
              <Text style={styles.stateSub}>We'll review your document within 2–3 business days</Text>
              {!!fmtDate(submittedAt) && (
                <Text style={styles.dateRow}>Submitted on {fmtDate(submittedAt)}</Text>
              )}
              <Pressable onPress={goToMain} style={styles.skipBtn}>
                <Text style={styles.skipText}>Continue to Dashboard</Text>
              </Pressable>
            </>
          )}

          {/* ── Verified ── */}
          {status === 'verified' && (
            <>
              <ShieldCheck size={48} color={STATE_COLOR.verified} style={styles.stateIcon} />
              <Text style={[styles.stateTitle, { color: STATE_COLOR.verified }]}>Store Verified ✓</Text>
              <Text style={styles.stateSub}>You can now go live and reach buyers</Text>
              {!!fmtDate((passedStore as any)?.updatedAt) && (
                <Text style={styles.dateRow}>Verified on {fmtDate((passedStore as any)?.updatedAt)}</Text>
              )}
              <Pressable onPress={goToMain} style={styles.cta}>
                <Text style={styles.ctaText}>Go to My Store →</Text>
              </Pressable>
            </>
          )}

          {/* ── Rejected ── */}
          {status === 'rejected' && (
            <>
              <XCircle size={48} color={STATE_COLOR.rejected} style={styles.stateIcon} />
              <Text style={[styles.stateTitle, { color: STATE_COLOR.rejected }]}>Verification Rejected</Text>

              <View style={styles.reasonCard}>
                <Text style={styles.reasonText}>
                  Reason: {rejectionReason || 'No reason provided — please contact support.'}
                </Text>
              </View>

              <Pressable onPress={handleResubmit} style={styles.ctaOutline}>
                <Text style={styles.ctaOutlineText}>Resubmit Documents</Text>
              </Pressable>

              <Pressable onPress={goToMain} style={styles.skipBtn}>
                <Text style={styles.skipText}>Continue to Dashboard</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.text },

  scroll: { padding: 16 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    margin: 0,
    alignItems: 'center',
  },
  stateIcon: { marginBottom: 20 },
  stateTitle: {
    fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center',
  },
  stateSub: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  dateRow: {
    fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 14,
  },

  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text,
    marginTop: 24, marginBottom: 10,
  },
  fieldHint: {
    alignSelf: 'flex-start',
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary,
    marginBottom: 10, marginTop: -6,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'stretch' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.backgroundGrey,
  },
  chipActive: { backgroundColor: Colors.orange },
  chipText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  cta: {
    alignSelf: 'stretch',
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },

  ctaOutline: {
    alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: Colors.orange,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
  },
  ctaOutlineText: { color: Colors.orange, fontSize: 15, fontFamily: Fonts.bold },

  reasonCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, padding: 14, marginTop: 16,
  },
  reasonText: { fontSize: 14, fontFamily: Fonts.regular, color: '#DC2626', lineHeight: 20 },

  skipBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 12 },
  skipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
});
