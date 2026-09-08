/**
 * StoreVerificationScreen — seller KYC for store verification.  (Redesign: "A · Stage")
 *
 * Reachable from:
 *   • BusinessOnboardingScreen (after store creation)
 *   • SellerDashboardScreen / MyStoreScreen / GoLiveTabScreen / Profile (verify
 *     banners + the Profile verification card)
 *
 * Route params:
 *   store?: SellerStore   — the seller's store object (may be null if creation 403'd)
 *
 * One screen, five views: unverified (upload form + Help accordions) → pending
 * (under review) → verified (done) or rejected (names the flagged item + a
 * targeted resubmit). "resubmit" is a focused local view — identity stays on
 * file, only the store document is re-uploaded.
 *
 * NOTE: support email/phone are PLACEHOLDERS pending real values.
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronDown, ShieldCheck, Clock, XCircle, FileText, Truck, Receipt,
  CreditCard, Fingerprint, Car, Plane, Mail, Phone, Lock, CheckCircle2,
  MessageCircle, FileCheck,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { KycUploader, type KycValue } from '../../components/KycUploader';
import { verificationAPI, type SellerStore, type VerificationStatus, type DocType, type IdentityType, type KycUrls } from '../../api/verification';
import { MY_STORE_QUERY_KEY } from '../../hooks/useMyStore';

// ⚠️ PLACEHOLDERS — replace with the real support channels.
const SUPPORT_EMAIL = 'support@chingiringi.com';
const SUPPORT_PHONE = '+91 XXXXX XXXXX';

// Status colors not in the shared theme — one-off semantic accents specific
// to this screen's states (amber/green/red), distinct from the brand palette.
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

// ── Doc / ID type chip ──────────────────────────────────────────────────────
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

// ── Help & support accordion ────────────────────────────────────────────────
const Accordion: React.FC<{
  icon: React.ComponentType<any>; title: string; defaultOpen?: boolean; children: React.ReactNode;
}> = ({ icon: Icon, title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.acc}>
      <Pressable style={styles.accHead} onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={title}>
        <Icon size={17} color={Colors.orange} strokeWidth={2} />
        <Text style={styles.accTitle}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={18} color={Colors.textSecondary} strokeWidth={2} />
        </View>
      </Pressable>
      {open ? <View style={styles.accBody}>{children}</View> : null}
    </View>
  );
};

// ── Contact-for-support card (email + phone) ────────────────────────────────
const ContactCard: React.FC = () => (
  <View style={styles.contactCard}>
    <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}>
      <View style={styles.contactIcon}><Mail size={15} color={Colors.orange} strokeWidth={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>Email</Text>
        <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
      </View>
    </Pressable>
    <View style={styles.contactDivider} />
    <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`).catch(() => {})}>
      <View style={styles.contactIcon}><Phone size={15} color={Colors.orange} strokeWidth={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>Phone</Text>
        <Text style={styles.contactValue}>{SUPPORT_PHONE}</Text>
      </View>
    </Pressable>
  </View>
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
  // Focused "re-upload just the store document" view (identity stays on file).
  const [resubmitMode, setResubmitMode] = useState(false);
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
  const identityOnFile = !!idDoc && !!selfie;

  const goToMain = () => {
    // Ensure the Dashboard / My Store show the latest store + status rather than
    // a stale cache.
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
      setResubmitMode(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Submission failed.';
      Alert.alert('Could not submit', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // From "rejected" → focused resubmit of only the flagged store document.
  const openResubmit = () => {
    setDoc(null);
    setResubmitMode(true);
  };

  const back = () => (navigation.canGoBack() ? navigation.goBack() : goToMain());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={resubmitMode ? () => setResubmitMode(false) : back} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{resubmitMode ? 'Resubmit document' : 'Store verification'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════ Resubmit (focused) ══════════ */}
        {resubmitMode ? (
          <>
            <View style={styles.intro}>
              <View style={[styles.introIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <FileCheck size={26} color={Colors.orange} strokeWidth={2} />
              </View>
              <Text style={styles.introTitle}>Resubmit store document</Text>
              <Text style={styles.introSub}>Your identity is verified and on file — just re-upload the store document.</Text>
            </View>

            {identityOnFile && (
              <View style={styles.lockedRow}>
                <Lock size={15} color="#059669" strokeWidth={2} />
                <Text style={styles.lockedText}>Identity verified & on file</Text>
                <CheckCircle2 size={16} color="#059669" strokeWidth={2} />
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Store document</Text>
              <View style={styles.chipRow}>
                {DOC_TYPES.map((d) => (
                  <DocChip key={d.value} selected={docType === d.value} onPress={() => setDocType(d.value)} icon={d.icon} label={d.label} />
                ))}
              </View>
              <Text style={styles.fieldHint}>Clear photo showing your {docSub.toLowerCase()} number.</Text>
              <KycUploader kind="doc" label="store document" value={doc} onChange={setDoc} previewUrl={null} disabled={submitting} />
            </View>

            <Pressable onPress={handleSubmit} disabled={submitting || !doc} style={[styles.cta, (submitting || !doc) && styles.ctaDisabled]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Resubmit for review</Text>}
            </Pressable>
          </>
        ) : status === 'unverified' ? (
          /* ══════════ Unverified: upload form ══════════ */
          <>
            <View style={styles.intro}>
              <View style={[styles.introIcon, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                <ShieldCheck size={26} color={Colors.orange} strokeWidth={2} />
              </View>
              <Text style={styles.introTitle}>Verify your store</Text>
              <Text style={styles.introSub}>Submit your store document and a personal ID to unlock live selling.</Text>
              <View style={styles.privacyChip}>
                <Lock size={12} color="#059669" strokeWidth={2.2} />
                <Text style={styles.privacyText}>Private & encrypted — reviewers only</Text>
              </View>
            </View>

            {/* Store document */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Store document</Text>
              <View style={styles.chipRow}>
                {DOC_TYPES.map((d) => (
                  <DocChip key={d.value} selected={docType === d.value} onPress={() => setDocType(d.value)} icon={d.icon} label={d.label} />
                ))}
              </View>
              <Text style={styles.fieldHint}>Clear photo showing your {docSub.toLowerCase()} number.</Text>
              <KycUploader kind="doc" label="store document" value={doc} onChange={setDoc} previewUrl={previews.doc} disabled={submitting} />
            </View>

            {/* Personal identity */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Personal identity</Text>
              <View style={styles.chipRow}>
                {ID_TYPES.map((d) => (
                  <DocChip key={d.value} selected={idType === d.value} onPress={() => setIdType(d.value)} icon={d.icon} label={d.label} />
                ))}
              </View>
              <Text style={styles.fieldHint}>A clear photo of your {idSub}.</Text>
              <KycUploader kind="id" label="ID photo" value={idDoc} onChange={setIdDoc} previewUrl={previews.id} disabled={submitting} />
              <Text style={[styles.fieldHint, { marginTop: 14 }]}>A selfie so we can match it to your ID.</Text>
              <KycUploader kind="selfie" label="selfie" value={selfie} onChange={setSelfie} previewUrl={previews.selfie} disabled={submitting} />
            </View>

            <Pressable onPress={handleSubmit} disabled={submitting || !canSubmit} style={[styles.cta, (submitting || !canSubmit) && styles.ctaDisabled]}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Submit for verification</Text>}
            </Pressable>
            <Pressable onPress={goToMain} style={styles.skipBtn}>
              <Text style={styles.skipText}>{passedStore ? 'Skip for now — verify later' : 'Continue to Dashboard'}</Text>
            </Pressable>

            {/* Help & support */}
            <Text style={styles.helpHeading}>Help & support</Text>
            <Accordion icon={FileCheck} title="Which documents are accepted?">
              <Text style={styles.accP}><Text style={styles.accB}>Store:</Text> GST certificate, FSSAI licence, or a municipal trade licence.</Text>
              <Text style={styles.accP}><Text style={styles.accB}>Identity:</Text> Aadhaar, PAN, driving licence, or passport — plus a selfie to match.</Text>
            </Accordion>
            <Accordion icon={CheckCircle2} title="Tips for quick approval">
              <Text style={styles.accP}>• Use a sharp, well-lit photo with all four corners visible.</Text>
              <Text style={styles.accP}>• The name should match your store details.</Text>
              <Text style={styles.accP}>• Avoid glare, blur, and cropped edges.</Text>
            </Accordion>
            <Accordion icon={MessageCircle} title="Contact for support" defaultOpen>
              <Text style={[styles.accP, { marginBottom: 10 }]}>Stuck or have a question about your documents? Reach us:</Text>
              <ContactCard />
            </Accordion>
          </>
        ) : status === 'pending' ? (
          /* ══════════ Pending ══════════ */
          <>
            <View style={styles.stateCard}>
              <View style={[styles.stateIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Clock size={30} color={STATE_COLOR.pending} strokeWidth={2} />
              </View>
              <Text style={styles.stateTitle}>Under review</Text>
              <Text style={styles.stateSub}>We usually review documents within 2–3 business days.</Text>
              {!!fmtDate(submittedAt) && <Text style={styles.dateRow}>Submitted on {fmtDate(submittedAt)}</Text>}
            </View>
            <Text style={styles.helpHeading}>Need help?</Text>
            <ContactCard />
            <Pressable onPress={goToMain} style={[styles.ctaOutline, { marginTop: 20 }]}>
              <Text style={styles.ctaOutlineText}>Continue to Dashboard</Text>
            </Pressable>
          </>
        ) : status === 'verified' ? (
          /* ══════════ Verified ══════════ */
          <>
            <View style={styles.stateCard}>
              <View style={[styles.stateIcon, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
                <ShieldCheck size={30} color={STATE_COLOR.verified} strokeWidth={2} />
              </View>
              <Text style={[styles.stateTitle, { color: STATE_COLOR.verified }]}>Store verified</Text>
              <Text style={styles.stateSub}>You're all set — you can now go live and reach buyers.</Text>
              {!!fmtDate((passedStore as any)?.updatedAt) && <Text style={styles.dateRow}>Verified on {fmtDate((passedStore as any)?.updatedAt)}</Text>}
            </View>
            <Pressable onPress={goToMain} style={styles.cta}>
              <Text style={styles.ctaText}>Go to My Store →</Text>
            </Pressable>
          </>
        ) : status === 'rejected' ? (
          /* ══════════ Rejected ══════════ */
          <>
            <View style={styles.stateCard}>
              <View style={[styles.stateIcon, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
                <XCircle size={30} color={STATE_COLOR.rejected} strokeWidth={2} />
              </View>
              <Text style={[styles.stateTitle, { color: STATE_COLOR.rejected }]}>Action needed</Text>
              <Text style={styles.stateSub}>One of your documents needs to be resubmitted.</Text>
            </View>

            {/* Per-item breakdown */}
            <View style={styles.breakItem}>
              <XCircle size={18} color={STATE_COLOR.rejected} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.breakTitle}>Store document — needs changes</Text>
                <Text style={styles.breakReason}>{rejectionReason || 'Please re-upload a clearer copy of your store document.'}</Text>
              </View>
            </View>
            {identityOnFile && (
              <View style={[styles.breakItem, styles.breakItemOk]}>
                <CheckCircle2 size={18} color="#059669" strokeWidth={2} />
                <Text style={[styles.breakTitle, { color: '#059669' }]}>Identity — verified & on file</Text>
              </View>
            )}

            <Pressable onPress={openResubmit} style={styles.cta}>
              <Text style={styles.ctaText}>Resubmit store document</Text>
            </Pressable>

            <Text style={styles.helpHeading}>Still stuck?</Text>
            <ContactCard />
            <Pressable onPress={goToMain} style={styles.skipBtn}>
              <Text style={styles.skipText}>Continue to Dashboard</Text>
            </Pressable>
          </>
        ) : null}
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

  scroll: { padding: 16, gap: 14 },

  // Intro
  intro: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 2 },
  introIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  introTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center' },
  introSub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 },
  privacyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  privacyText: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: '#059669' },

  // Section card
  section: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  sectionLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy, marginBottom: 12 },
  fieldHint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 12, marginBottom: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.backgroundGrey,
  },
  chipActive: { backgroundColor: Colors.orange },
  chipText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  // Locked identity row (resubmit)
  lockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  lockedText: { flex: 1, fontSize: 13.5, fontFamily: Fonts.semiBold, color: '#059669' },

  // CTAs
  cta: {
    backgroundColor: Colors.orange, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  ctaOutline: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  ctaOutlineText: { color: Colors.text, fontSize: 15, fontFamily: Fonts.bold },
  skipBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 2 },
  skipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },

  // Status card (pending / verified / rejected header)
  stateCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 26, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  stateIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stateTitle: { fontSize: 21, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center' },
  stateSub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 },
  dateRow: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 14 },

  // Rejected breakdown
  breakItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14,
  },
  breakItemOk: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', alignItems: 'center' },
  breakTitle: { fontSize: 13.5, fontFamily: Fonts.bold, color: '#DC2626' },
  breakReason: { fontSize: 12.5, fontFamily: Fonts.regular, color: '#b91c1c', marginTop: 3, lineHeight: 18 },

  // Help & support
  helpHeading: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.textSecondary, marginTop: 8, marginBottom: 2 },
  acc: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  accTitle: { flex: 1, fontSize: 13.5, fontFamily: Fonts.semiBold, color: Colors.text },
  accBody: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2, gap: 6 },
  accP: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 19 },
  accB: { fontFamily: Fonts.bold, color: Colors.text },

  // Contact card
  contactCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  contactIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  contactValue: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy, marginTop: 1 },
  contactDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 59 },
});
