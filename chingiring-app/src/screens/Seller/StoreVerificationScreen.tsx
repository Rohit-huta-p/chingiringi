/**
 * StoreVerificationScreen — seller submits GST / Aadhaar for store verification.
 *
 * Reachable from:
 *   • BusinessOnboardingScreen (after store creation)
 *   • GoLiveTabScreen (when seller tries to go live but is unverified)
 *
 * Route params:
 *   store?: SellerStore   — the seller's store object (may be null if creation 403'd)
 *
 * Status banner variants:
 *   unverified → blue info
 *   pending    → yellow "under review"
 *   verified   → green success (shows done state, no upload)
 *   rejected   → red with rejectionReason + resubmit mode
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
import {
  ChevronLeft, ShieldCheck, ShieldAlert, Clock, XCircle, FileText, CreditCard,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { MultiImageUploader } from '../../components/MultiImageUploader';
import { verificationAPI, type SellerStore, type VerificationStatus, type DocType } from '../../api/verification';

// ── Status banner config ───────────────────────────────────────────────────
interface BannerConfig {
  bg: string;
  border: string;
  icon: React.ReactNode;
  text: string;
}

function getBannerConfig(
  status: VerificationStatus,
  rejectionReason?: string,
): BannerConfig {
  switch (status) {
    case 'pending':
      return {
        bg: '#FFFBEB', border: '#F59E0B',
        icon: <Clock size={18} color="#D97706" />,
        text: "Your documents are under review — we'll notify you within 1–2 business days.",
      };
    case 'verified':
      return {
        bg: '#F0FDF4', border: '#22C55E',
        icon: <ShieldCheck size={18} color="#16A34A" />,
        text: 'Your store is verified! You can now go live and show the verified badge.',
      };
    case 'rejected':
      return {
        bg: '#FEF2F2', border: '#EF4444',
        icon: <XCircle size={18} color="#DC2626" />,
        text: rejectionReason
          ? `Verification rejected: ${rejectionReason}`
          : 'Your verification was rejected. Please resubmit with a clearer document.',
      };
    default: // unverified
      return {
        bg: '#EFF6FF', border: '#3B82F6',
        icon: <ShieldAlert size={18} color="#2563EB" />,
        text: 'Verify your store to unlock live streaming and earn the verified badge.',
      };
  }
}

// ── Doc type radio card ────────────────────────────────────────────────────
interface DocCardProps {
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}

const DocCard: React.FC<DocCardProps> = ({ selected, onPress, icon, title, sub }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.docCard,
      selected && styles.docCardSelected,
      pressed && { opacity: 0.85 },
    ]}
  >
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected && <View style={styles.radioDot} />}
    </View>
    <View style={styles.docCardIcon}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.docCardTitle, selected && styles.docCardTitleSelected]}>{title}</Text>
      <Text style={styles.docCardSub}>{sub}</Text>
    </View>
  </Pressable>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const StoreVerificationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const passedStore: SellerStore | null = route.params?.store ?? null;
  const initialStatus: VerificationStatus =
    passedStore?.verificationStatus ?? 'unverified';
  const rejectionReason: string | undefined =
    passedStore?.verificationDoc?.rejectionReason;

  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [docType, setDocType] = useState<DocType>('gst');
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const banner = getBannerConfig(status, rejectionReason);
  const canSubmit = status !== 'pending' && status !== 'verified';
  const isResubmit = status === 'rejected';

  // ── Navigate out (skip or after success) ──────────────────────────────
  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
    );
  };

  // ── Submit verification ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!passedStore?._id) {
      // Store creation 403'd earlier — skip verification for now
      goToMain();
      return;
    }
    if (docUrls.length === 0) {
      Alert.alert('No document', 'Please upload a photo or PDF of your document.');
      return;
    }

    setSubmitting(true);
    try {
      await verificationAPI.submitVerification(passedStore._id, {
        docType,
        docUrl: docUrls[0],
      });
      setStatus('pending');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Submission failed.';
      Alert.alert('Could not submit', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.canGoBack() ? navigation.goBack() : goToMain()} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify Your Store</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status banner ── */}
        <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
          {banner.icon}
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>

        {/* ── Verified / Pending — no upload needed ── */}
        {(status === 'verified' || status === 'pending') && (
          <View style={styles.doneBlock}>
            {status === 'verified' && (
              <Pressable onPress={goToMain} style={styles.ctaVerified}>
                <Text style={styles.ctaVerifiedText}>Go to My Store →</Text>
              </Pressable>
            )}
            {status === 'pending' && (
              <Pressable onPress={goToMain} style={styles.skipBtn}>
                <Text style={styles.skipText}>Continue to Dashboard</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Upload form (unverified / rejected) ── */}
        {canSubmit && (
          <>
            {/* Doc type picker */}
            <Text style={styles.sectionTitle}>
              {isResubmit ? 'Resubmit Document' : 'Choose Document Type'}
            </Text>

            <View style={styles.docCards}>
              <DocCard
                selected={docType === 'gst'}
                onPress={() => setDocType('gst')}
                icon={<FileText size={20} color={docType === 'gst' ? Colors.orange : Colors.textSecondary} />}
                title="GST Certificate"
                sub="Government-issued GST registration document"
              />
              <DocCard
                selected={docType === 'aadhaar'}
                onPress={() => setDocType('aadhaar')}
                icon={<CreditCard size={20} color={docType === 'aadhaar' ? Colors.orange : Colors.textSecondary} />}
                title="Aadhaar Card"
                sub="Your Aadhaar (front + back, max 5 MB)"
              />
            </View>

            {/* Upload zone */}
            <Text style={styles.sectionTitle}>Upload Document</Text>
            <Text style={styles.sectionSub}>
              Clear photo or PDF — must show your name and{' '}
              {docType === 'gst' ? 'GSTIN number' : 'Aadhaar number'}.
            </Text>

            <MultiImageUploader
              value={docUrls}
              onChange={setDocUrls}
              max={1}
              folder="seller-verification"
              coverLabel="Document"
            />

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || docUrls.length === 0}
              style={[
                styles.cta,
                (submitting || docUrls.length === 0) && styles.ctaDisabled,
              ]}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.ctaText}>
                    {isResubmit ? 'Resubmit for Verification' : 'Submit for Verification'}
                  </Text>}
            </Pressable>

            {/* Skip */}
            <Pressable onPress={goToMain} style={styles.skipBtn}>
              <Text style={styles.skipText}>
                {passedStore ? 'Skip for now — verify later' : 'Continue to Dashboard'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },

  scroll: {
    padding: 20,
    gap: 20,
  },

  // Status banner
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.text,
    lineHeight: 19,
  },

  doneBlock: { gap: 12 },

  // Doc type cards
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: -12,
  },

  docCards: { gap: 10 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  docCardSelected: {
    borderColor: Colors.orange,
    backgroundColor: '#FFF7ED',
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.orange },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.orange,
  },

  docCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.backgroundGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCardTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  docCardTitleSelected: { color: Colors.orange },
  docCardSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // CTA
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  ctaVerified: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaVerifiedText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },

  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
});
