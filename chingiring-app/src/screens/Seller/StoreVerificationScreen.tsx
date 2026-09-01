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
import React, { useState, useEffect } from 'react';
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
  CreditCard, Fingerprint, Car, Plane,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { KycUploader, type KycValue } from '../../components/KycUploader';
import { verificationAPI, type SellerStore, type VerificationStatus, type DocType, type IdentityType, type KycUrls } from '../../api/verification';
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

const ID_TYPES: { value: IdentityType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'aadhaar',  label: 'Aadhaar',         icon: Fingerprint },
  { value: 'pan',      label: 'PAN',             icon: CreditCard },
  { value: 'dl',       label: 'Driving Licence', icon: Car },
  { value: 'passport', label: 'Passport',        icon: Plane },
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

  const idd0 = passedStore?.identityDoc;
  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [docType, setDocType] = useState<DocType>('gst');
  const [doc, setDoc] = useState<KycValue | null>(
    passedStore?.verificationDoc?.publicId
      ? { publicId: passedStore.verificationDoc.publicId, format: passedStore.verificationDoc.format }
      : null,
  );
  // Personal identity — pre-filled if onboarding already captured it.
  const [idType, setIdType] = useState<IdentityType>((idd0?.type as IdentityType) || 'aadhaar');
  const [idDoc, setIdDoc] = useState<KycValue | null>(
    idd0?.docPublicId ? { publicId: idd0.docPublicId, format: idd0.docFormat } : null,
  );
  const [selfie, setSelfie] = useState<KycValue | null>(
    idd0?.selfiePublicId ? { publicId: idd0.selfiePublicId, format: idd0.selfieFormat } : null,
  );
  const [previews, setPreviews] = useState<KycUrls>({ doc: null, id: null, selfie: null });
  const [submitting, setSubmitting] = useState(false);

  // Fetch signed preview URLs so a returning seller sees what they already
  // submitted (private assets aren't reachable via a plain URL).
  useEffect(() => {
    const sid = passedStore?._id;
    const hasAny = !!(passedStore?.verificationDoc?.publicId || idd0?.docPublicId || idd0?.selfiePublicId);
    if (!sid || !hasAny) return;
    let alive = true;
    verificationAPI.getStoreKycUrls(sid)
      .then((u) => { if (alive) setPreviews(u); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedStore?._id]);

  const rejectionReason = passedStore?.verificationDoc?.rejectionReason;
  const submittedAt = passedStore?.verificationDoc?.submittedAt as any;
  const docSub = DOC_TYPES.find((d) => d.value === docType)?.label ?? 'document';
  const idSub = ID_TYPES.find((d) => d.value === idType)?.label ?? 'ID';
  const canSubmit = !!doc && !!idDoc && !!selfie;

  const goToMain = () => {
    // Ensure the Dashboard / My Store show the latest store + status (created or
    // just submitted for verification) rather than a stale cache.
    queryClient.invalidateQueries({ queryKey: MY_STORE_QUERY_KEY });
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
  };

  const handleSubmit = async () => {
    if (!passedStore?._id) { goToMain(); return; }
    if (!canSubmit) {
      Alert.alert('Almost there', 'Upload your store document, a government ID, and a selfie to submit.');
      return;
    }
    setSubmitting(true);
    try {
      await verificationAPI.submitVerification(passedStore._id, {
        docType,
        docPublicId: doc!.publicId,
        docFormat: doc!.format,
        identityType: idType,
        identityDocPublicId: idDoc!.publicId,
        identityDocFormat: idDoc!.format,
        selfiePublicId: selfie!.publicId,
        selfieFormat: selfie!.format,
      });
      setStatus('pending');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Submission failed.';
      Alert.alert('Could not submit', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = () => {
    setDoc(null);
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
              <Text style={styles.stateSub}>Submit your store document and a personal ID to unlock live streaming</Text>

              {/* ── Store document ── */}
              <Text style={styles.fieldLabel}>Store document</Text>
              <View style={styles.chipRow}>
                {DOC_TYPES.map((d) => (
                  <DocChip key={d.value} selected={docType === d.value} onPress={() => setDocType(d.value)} icon={d.icon} label={d.label} />
                ))}
              </View>
              <Text style={[styles.fieldHint, { marginTop: 10 }]}>Clear photo showing your {docSub.toLowerCase()} number.</Text>
              <KycUploader label="store document" value={doc} onChange={setDoc} previewUrl={previews.doc} disabled={submitting} />

              {/* ── Personal identity (ID + selfie) ── */}
              <Text style={[styles.fieldLabel, { marginTop: 26 }]}>Personal identity</Text>
              <View style={styles.chipRow}>
                {ID_TYPES.map((d) => (
                  <DocChip key={d.value} selected={idType === d.value} onPress={() => setIdType(d.value)} icon={d.icon} label={d.label} />
                ))}
              </View>
              <Text style={[styles.fieldHint, { marginTop: 10 }]}>A clear photo of your {idSub}.</Text>
              <KycUploader label="ID photo" value={idDoc} onChange={setIdDoc} previewUrl={previews.id} disabled={submitting} />
              <Text style={[styles.fieldHint, { marginTop: 14 }]}>A selfie so we can match it to your ID.</Text>
              <KycUploader label="selfie" value={selfie} onChange={setSelfie} previewUrl={previews.selfie} disabled={submitting} />

              <Pressable
                onPress={handleSubmit}
                disabled={submitting || !canSubmit}
                style={[styles.cta, (submitting || !canSubmit) && styles.ctaDisabled]}
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
