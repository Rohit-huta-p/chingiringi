/**
 * BusinessOnboardingScreen — 5-step wizard for new sellers.
 *
 * Step 1 — Details:       store name + short name + category + store type
 * Step 2 — Location:      address (optional for online) + area + city
 * Step 3 — Media:         logo (optional) + WhatsApp phone
 * Step 4 — Verification:  store document (physical: GST/FSSAI/trade licence ·
 *                         online: GST/PAN/Udyam/FSSAI) + govt ID + selfie
 * Step 5 — Review:        summary card + submit
 *
 * Verification is optional in the wizard — the seller can skip and finish it
 * later on StoreVerificationScreen. But when the store document AND the identity
 * (ID + selfie) are all provided, the KYC is submitted on finish and the store
 * lands on that screen already 'pending' (backend flips status only once all
 * three are on file).
 *
 * On finish: POST /api/stores/seller → (optional) PATCH /:id/verification →
 * navigate to StoreVerificationScreen.
 *
 * Look ("hybrid" redesign): a dark navy→charcoal HERO band (with an orange glow)
 * carries the back button, the segmented progress and the step headline; the
 * body sits on the light app ground. Selections use a BOLD solid-orange fill
 * (navy text) — store type as rich list rows, documents as a tilt-on-select
 * grid. One full-width orange CTA; back lives in the hero.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin, Fingerprint, CreditCard, Car, Plane, FileText, Receipt, Truck, Store as StoreIcon, Globe, Layers, Building2, CheckCircle2, Flag } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Input } from '../../components/Input';
import { CategorySelect } from '../../components/CategorySelect';
import { ImageUploader } from '../../components/ImageUploader';
import { KycUploader, type KycValue } from '../../components/KycUploader';
import apiClient from '../../api/client';
import { verificationAPI, type IdentityType, type DocType } from '../../api/verification';
import { MY_STORE_QUERY_KEY } from '../../hooks/useMyStore';
import { cloudFolder } from '../../constants/cloudinaryFolders';

// Store type — drives the address requirement (Step 2) and the verification
// document set (Step 4). Mirrors the backend storeType enum (storeModel.js).
type StoreType = 'physical' | 'online' | 'both';
const STORE_TYPES: { value: StoreType; label: string; sub: string; icon: React.ComponentType<any> }[] = [
  { value: 'physical', label: 'Physical shop', sub: 'Customers visit your store', icon: StoreIcon },
  { value: 'online',   label: 'Online only',   sub: 'You sell & ship online',    icon: Globe },
  { value: 'both',     label: 'Both',          sub: 'A shop and online',         icon: Layers },
];

// Store document types by store type — must match backend DocType (verification.ts).
// Online sellers have no municipal premises, so Trade Licence is replaced by PAN /
// Udyam; 'both' uses the physical set. FSSAI is offered to everyone (there's no
// canonical food category to gate on). Short labels keep the grid compact.
const DOC_TYPES_PHYSICAL: { value: DocType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'gst',          label: 'GST',           icon: FileText },
  { value: 'fssai',        label: 'FSSAI',         icon: Receipt },
  { value: 'tradeLicence', label: 'Trade Licence', icon: Truck },
];
const DOC_TYPES_ONLINE: { value: DocType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'gst',   label: 'GST',   icon: FileText },
  { value: 'pan',   label: 'PAN',   icon: CreditCard },
  { value: 'udyam', label: 'Udyam', icon: Building2 },
  { value: 'fssai', label: 'FSSAI', icon: Receipt },
];
const docTypesFor = (t: StoreType) => (t === 'online' ? DOC_TYPES_ONLINE : DOC_TYPES_PHYSICAL);

const ID_TYPES: { value: IdentityType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'aadhaar',  label: 'Aadhaar',         icon: Fingerprint },
  { value: 'pan',      label: 'PAN',             icon: CreditCard },
  { value: 'dl',       label: 'Driving Licence', icon: Car },
  { value: 'passport', label: 'Passport',        icon: Plane },
];

const TOTAL_STEPS = 5;

// ── Dark hero band: back + segmented progress + step headline ────────────────
const HeroHeader: React.FC<{ step: number; title: string; sub: string; top: number; onBack: () => void }> = ({ step, title, sub, top, onBack }) => (
  <LinearGradient
    colors={['#13233F', '#0C1830', '#0A1226']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[styles.hero, { paddingTop: top + 10 }]}
  >
    {/* Warm radial-ish glow, top-right */}
    <LinearGradient
      colors={['rgba(249,115,22,0.30)', 'rgba(249,115,22,0)']}
      start={{ x: 1, y: 0 }}
      end={{ x: 0.15, y: 0.9 }}
      style={styles.heroGlow}
      pointerEvents="none"
    />
    <View style={styles.heroTop}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.heroBack}>
        <ChevronLeft size={22} color="#fff" />
      </Pressable>
      <View style={styles.progress}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progSeg, i + 1 === step && styles.progSegOn]} />
        ))}
      </View>
    </View>
    <Text style={styles.heroTitle}>{title}</Text>
    <Text style={styles.heroSub}>{sub}</Text>
  </LinearGradient>
);

// ── Summary row (Step 5 review card) ───────────────────────────────────────
const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={2}>{value || '—'}</Text>
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────
export const BusinessOnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form state
  const [storeName,  setStoreName]  = useState('');
  const [shortName,  setShortName]  = useState('');
  const [shortNameTouched, setShortNameTouched] = useState(false);
  const [category,   setCategory]   = useState<string>('');
  const [storeType,  setStoreType]  = useState<StoreType>('physical');
  const [address,    setAddress]    = useState('');
  const [area,       setArea]       = useState('');
  const [city,       setCity]       = useState('Bengaluru');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [phone,      setPhone]      = useState('');
  const [website,    setWebsite]    = useState('');
  // KYC — optional here; required before go-live on the verification screen.
  // Store document + personal identity (govt ID + selfie).
  const [docType,    setDocType]    = useState<DocType>('gst');
  const [doc,        setDoc]        = useState<KycValue | null>(null);
  const [idType,     setIdType]     = useState<IdentityType>('aadhaar');
  const [idDoc,      setIdDoc]      = useState<KycValue | null>(null);
  const [selfie,     setSelfie]     = useState<KycValue | null>(null);

  const [locationBusy, setLocationBusy] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // Auto-suggest short name from the first 2 words of the store name, until
  // the seller edits it manually — then their choice always wins.
  const handleStoreNameChange = (t: string) => {
    setStoreName(t);
    if (!shortNameTouched) {
      setShortName(t.trim().split(/\s+/).slice(0, 2).join(' '));
    }
  };
  const handleShortNameChange = (t: string) => {
    setShortNameTouched(true);
    setShortName(t);
  };

  // Store type drives the address requirement (Step 2) and the doc set (Step 4).
  const isOnline = storeType === 'online';
  const docTypes = docTypesFor(storeType);
  const handleStoreTypeChange = (t: StoreType) => {
    setStoreType(t);
    // Keep the selected document valid for the new set ('gst' is in both).
    if (!docTypesFor(t).some((d) => d.value === docType)) setDocType('gst');
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const step1Valid = storeName.trim().length >= 2 && shortName.trim().length >= 1 && category !== '';
  const step2Valid = isOnline ? true : address.trim().length >= 5 && city.trim().length >= 1;
  const phoneDigits = phone.trim().replace(/\D/g, '');
  const step3Valid = phoneDigits.length >= 10;
  // Online stores have no premises, so identity (ID + selfie) is the anchor and is
  // required to finish onboarding; physical/both may still add it later.
  const step4Valid = isOnline ? !!idDoc && !!selfie : true;

  const canAdvance = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : step === 4 ? step4Valid : true;

  // ── Per-step hero copy (title + sub shown in the dark band) ───────────────
  const [heroTitle, heroSub] = ({
    1: ['Tell us about your store', 'Choose a name and category customers will see.'],
    2: isOnline
      ? ['Where do you ship from?', 'Optional for online stores — add a ships-from area if you like.']
      : ['Where is your store?', 'Customers will use this to find and visit you.'],
    3: ['Logo & contact number', 'A great logo helps customers recognise you instantly.'],
    4: ['Verify your store', isOnline
      ? 'Online stores add a government ID and selfie to continue.'
      : 'Add a store document and a personal ID — required before you go live.'],
    5: ["You're all set!", 'One last look before you create your store.'],
  } as Record<number, [string, string]>)[step];

  // ── Step 2: Use my location ─────────────────────────────────────────────
  const handleUseLocation = async () => {
    setLocationBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Enable location access in Settings to autofill your address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo) {
        setAddress([geo.name, geo.street].filter(Boolean).join(', '));
        setArea([geo.district, geo.subregion].filter(Boolean).join(', '));
        if (geo.city) setCity(geo.city);
      }
    } catch {
      Alert.alert('Could not get location', 'Please type your address manually.');
    } finally {
      setLocationBusy(false);
    }
  };

  // ── Final submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (phoneDigits.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit WhatsApp number.');
      setStep(3);
      return;
    }
    if (isOnline && !(idDoc && selfie)) {
      Alert.alert('Identity required', 'Online stores must add a government ID and a selfie before creating the store.');
      setStep(4);
      return;
    }
    const formatted = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;

    setSubmitting(true);
    try {
      // POST /api/stores/seller — seller-accessible route (no admin middleware).
      // Returns 200 with existing store if one already exists for this account,
      // or 201 with the newly-created store.
      const res = await apiClient.post('/api/stores/seller', {
        name:      storeName.trim(),
        shortName: shortName.trim(),
        category,
        storeType,
        address:   address.trim() || undefined,
        area:      area.trim() || undefined,
        city:      city.trim() || undefined,
        logoUrl:   logoUrl || undefined,
        phone:     formatted,
        website:   website.trim() || undefined,
      });
      const store = res.data?.data?.store ?? res.data?.store;
      // Submit whatever KYC the seller provided in the Verification step so the
      // store lands on the verification screen pre-filled. The backend flips the
      // store to 'pending' only once the store document AND the identity (ID +
      // selfie) are all on file; a partial submission stays 'unverified' and is
      // finished later on StoreVerificationScreen.
      const hasIdentity = !!idDoc && !!selfie;
      if (store?._id && (doc || hasIdentity)) {
        try {
          await verificationAPI.submitVerification(store._id, {
            ...(doc ? { docType, docPublicId: doc.publicId, docFormat: doc.format } : {}),
            ...(hasIdentity ? {
              identityType: idType,
              identityDocPublicId: idDoc!.publicId,
              identityDocFormat: idDoc!.format,
              selfiePublicId: selfie!.publicId,
              selfieFormat: selfie!.format,
            } : {}),
          });
          if (doc) {
            store.verificationDoc = { type: docType, publicId: doc.publicId, format: doc.format };
          }
          if (hasIdentity) {
            store.identityDoc = {
              type: idType,
              docPublicId: idDoc!.publicId, docFormat: idDoc!.format,
              selfiePublicId: selfie!.publicId, selfieFormat: selfie!.format,
            };
          }
          // Mirror the backend: full KYC → 'pending' so the screen opens on the
          // under-review state instead of the (now completed) upload form.
          if (doc && hasIdentity) store.verificationStatus = 'pending';
        } catch { /* non-fatal — they can finish on the verification screen */ }
      }
      // The seller tabs mounted before this store existed, so MY_STORE_QUERY_KEY
      // is cached as null. Invalidate it so the Dashboard / My Store refetch and
      // show the freshly-created (unverified) store.
      queryClient.invalidateQueries({ queryKey: MY_STORE_QUERY_KEY });
      navigation.replace('StoreVerification', { store });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';
      Alert.alert('Could not create store', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (!canAdvance) return;
    if (step === 5) { handleSubmit(); return; }
    setStep((s) => (s + 1) as any);
  };
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as any) : s));
  // Hero chevron: step back through the wizard, or leave onboarding on Step 1.
  const onHeroBack = () => {
    if (step > 1) { goBack(); return; }
    if (navigation.canGoBack()) navigation.goBack();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <HeroHeader step={step} title={heroTitle} sub={heroSub} top={insets.top} onBack={onHeroBack} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <View style={styles.stepBody}>
              <Input
                label="Store name"
                placeholder="e.g. Rohit's Boutique"
                value={storeName}
                onChangeText={handleStoreNameChange}
                autoCapitalize="words"
                maxLength={60}
              />
              <Input
                label="Short name"
                placeholder="Shown in compact displays"
                value={shortName}
                onChangeText={handleShortNameChange}
                autoCapitalize="words"
                maxLength={24}
              />

              <CategorySelect label="Category" value={category} onChange={setCategory} />

              <Text style={styles.fieldLabel}>Store type</Text>
              <View style={styles.rows}>
                {STORE_TYPES.map(({ value, label, sub, icon: Icon }) => {
                  const active = storeType === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => handleStoreTypeChange(value)}
                      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.9 }]}
                    >
                      <View style={[styles.rowIcon, active && styles.rowIconActive]}>
                        <Icon size={20} color={active ? Colors.navy : Colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{label}</Text>
                        <Text style={[styles.rowDesc, active && styles.rowDescActive]}>{sub}</Text>
                      </View>
                      {active && <CheckCircle2 size={20} color={Colors.navy} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <View style={styles.stepBody}>
              <Pressable
                onPress={handleUseLocation}
                disabled={locationBusy}
                style={styles.locationBtn}
              >
                {locationBusy
                  ? <ActivityIndicator size="small" color={Colors.orange} />
                  : <MapPin size={16} color={Colors.orange} />}
                <Text style={styles.locationBtnText}>
                  {locationBusy ? 'Getting location…' : 'Use my location'}
                </Text>
              </Pressable>

              {/* Address — custom multiline field (Input.tsx is single-line only) */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{isOnline ? 'Address (optional)' : 'Address'}</Text>
                <TextInput
                  style={styles.multilineInput}
                  placeholder="Shop no. / building name, street"
                  placeholderTextColor={Colors.textSecondary}
                  value={address}
                  onChangeText={setAddress}
                  autoCapitalize="sentences"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <Input
                label="Area / Neighbourhood"
                placeholder="e.g. Koramangala, Indiranagar"
                value={area}
                onChangeText={setArea}
                autoCapitalize="sentences"
              />
              <Input
                label="City"
                placeholder="Bengaluru"
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* ── Step 3: Media ── */}
          {step === 3 && (
            <View style={styles.stepBody}>
              <ImageUploader
                value={logoUrl}
                onChange={setLogoUrl}
                label="Store logo"
                folder={cloudFolder.storeLogo()}
                hint="Square works best — at least 512 × 512 px (PNG or JPG)."
              />

              <Input
                label="WhatsApp number"
                placeholder="98765 43210"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^\d\s+\-()]/g, ''))}
                keyboardType="phone-pad"
                leftIcon={<Text style={styles.dialCode}>+91</Text>}
                maxLength={15}
              />
              <Text style={styles.hint}>
                Buyers can tap to message you directly from your store page.
              </Text>

              <Input
                label="Website (optional)"
                placeholder="https://…"
                value={website}
                onChangeText={setWebsite}
                keyboardType="url"
              />
            </View>
          )}

          {/* ── Step 4: Verification (store document + govt ID + selfie) ── */}
          {step === 4 && (
            <View style={styles.stepBody}>
              <Text style={styles.fieldLabel}>Store document</Text>
              <View style={styles.grid}>
                {docTypes.map(({ value, label, icon: Icon }) => {
                  const active = docType === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setDocType(value)}
                      style={({ pressed }) => [styles.gcell, active && styles.gcellActive, pressed && !active && { opacity: 0.9 }]}
                    >
                      <View style={[styles.gIcon, active && styles.gIconActive]}>
                        <Icon size={20} color={active ? Colors.navy : Colors.textSecondary} />
                      </View>
                      <Text style={styles.gLabel}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <KycUploader kind="doc" label="store document" value={doc} onChange={setDoc} disabled={submitting} />

              <Text style={styles.fieldLabel}>ID type</Text>
              <View style={styles.idChipRow}>
                {ID_TYPES.map(({ value, label, icon: Icon }) => {
                  const active = idType === value;
                  return (
                    <Pressable key={value} onPress={() => setIdType(value)} style={[styles.idChip, active && styles.idChipActive]}>
                      <Icon size={15} color={active ? Colors.navy : Colors.textSecondary} />
                      <Text style={[styles.idChipText, active && styles.idChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>ID document</Text>
              <KycUploader kind="id" label="ID photo" value={idDoc} onChange={setIdDoc} disabled={submitting} />

              <Text style={styles.fieldLabel}>Selfie</Text>
              <KycUploader kind="selfie" label="selfie" value={selfie} onChange={setSelfie} disabled={submitting} />
            </View>
          )}

          {/* ── Step 5: Review & Submit ── */}
          {step === 5 && (
            <View style={styles.stepBody}>
              <View style={styles.callout}>
                <View style={styles.calloutIcon}><Flag size={20} color={Colors.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calloutTitle}>Ready to submit</Text>
                  <Text style={styles.calloutText}>
                    {doc && idDoc && selfie
                      ? "We'll review your store in 2–3 days. You can start setting up while you wait."
                      : 'Create your store now — you can finish verification anytime before going live.'}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.summaryLogo} resizeMode="cover" />
                ) : null}
                <SummaryRow label="Store name" value={storeName} />
                <SummaryRow label="Short name" value={shortName} />
                <SummaryRow label="Category" value={category} />
                <SummaryRow label="Store type" value={STORE_TYPES.find((t) => t.value === storeType)?.label ?? ''} />
                <SummaryRow label="Address" value={address ? address : (isOnline ? 'Not applicable (online)' : '')} />
                <SummaryRow label="Area" value={area} />
                <SummaryRow label="City" value={city} />
                <SummaryRow label="WhatsApp" value={phone ? `+91 ${phoneDigits}` : ''} />
                <SummaryRow label="Store document" value={doc ? (docTypes.find((d) => d.value === docType)?.label ?? 'Document') : 'Add later'} />
                <SummaryRow label="Identity" value={idDoc && selfie ? `${ID_TYPES.find((d) => d.value === idType)?.label ?? 'ID'} + selfie` : 'Add later'} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom CTA (back lives in the hero) ── */}
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={goNext}
            disabled={!canAdvance || submitting}
            style={[styles.cta, (!canAdvance || submitting) && styles.ctaDisabled]}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>{step === 5 ? 'Create my store' : 'Continue'}</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Dark hero band
  hero: { paddingHorizontal: 20, paddingBottom: 22, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  heroBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  progress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  progSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  progSegOn: { flex: 2.2, backgroundColor: Colors.orange },
  heroTitle: { marginTop: 20, fontSize: 26, lineHeight: 31, fontFamily: Fonts.extraBold, color: '#fff', letterSpacing: -0.3 },
  heroSub: { marginTop: 8, fontSize: 13.5, lineHeight: 19, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.72)' },

  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  stepBody: { gap: 16 },

  fieldLabel: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.navy },

  // Store-type list rows
  rows: { gap: 10, marginTop: -6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  rowActive: {
    backgroundColor: Colors.orange, borderColor: Colors.orange,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 4,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  rowIconActive: { backgroundColor: 'rgba(12,26,61,0.14)' },
  rowTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.navy },
  rowDesc: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  rowDescActive: { color: 'rgba(12,26,61,0.72)' },

  // Doc-type grid cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: -6 },
  gcell: {
    width: '48%', backgroundColor: Colors.surface, borderRadius: 16, padding: 14,
    gap: 10, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'flex-start',
  },
  gcellActive: {
    backgroundColor: Colors.orange, borderColor: Colors.orange,
    transform: [{ rotate: '-2.5deg' }, { scale: 1.04 }],
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 5,
  },
  gIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  gIconActive: { backgroundColor: 'rgba(12,26,61,0.14)' },
  gLabel: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy },

  // ID type chips
  idChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  idChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  idChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  idChipText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  idChipTextActive: { color: Colors.navy },

  // Location button
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: Colors.orange,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
  },
  locationBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },

  fieldWrap: { gap: 8 },
  multilineInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    backgroundColor: Colors.surface, minHeight: 80,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, fontFamily: Fonts.regular, color: Colors.text,
  },

  // Review callout + summary
  callout: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: Colors.orange, borderRadius: 18, padding: 15,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 4,
  },
  calloutIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(12,26,61,0.14)', alignItems: 'center', justifyContent: 'center' },
  calloutTitle: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.navy },
  calloutText: { fontSize: 12.5, fontFamily: Fonts.regular, color: 'rgba(12,26,61,0.8)', lineHeight: 17, marginTop: 3 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryLogo: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginBottom: 4, backgroundColor: Colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  summaryValue: { flex: 1, textAlign: 'right', fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.navy },

  // Bottom CTA
  ctaBar: {
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cta: {
    backgroundColor: Colors.orange, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 3,
  },
  ctaDisabled: { opacity: 0.45, shadowOpacity: 0 },
  ctaText: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },

  // Misc
  dialCode: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text, paddingLeft: 4 },
  hint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 17, marginTop: -8 },
});
