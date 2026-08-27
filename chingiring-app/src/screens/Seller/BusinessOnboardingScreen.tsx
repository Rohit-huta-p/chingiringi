/**
 * BusinessOnboardingScreen — 4-step wizard for new sellers.
 *
 * Step 1 — Details:  store name + short name + category
 * Step 2 — Location:  address + area + city
 * Step 3 — Media:     logo (optional) + WhatsApp phone
 * Step 4 — Review:    summary card + submit
 *
 * On finish: POST /api/stores/seller → navigate to StoreVerificationScreen.
 * All active elements, the progress bar, and CTAs use Colors.orange (#F97316).
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Input } from '../../components/Input';
import { ImageUploader } from '../../components/ImageUploader';
import apiClient from '../../api/client';

// ── Store categories (predefined; CategoryPicker is admin-only) ───────────
// CategoryPicker uses adminAPI.getCategories() which is gated to admin role.
// We use a simple single-select grid of the canonical store categories instead.
// NB: must match backend STORE_CATEGORIES enum exactly (storeModel.js) — no
// 'Other' option, since the schema would 400 on an unrecognised value.
const STORE_CATEGORIES = [
  { label: 'Fashion',     emoji: '👗' },
  { label: 'Electronics', emoji: '📱' },
  { label: 'Grocery',     emoji: '🛒' },
  { label: 'Food & Cafe', emoji: '☕' },
  { label: 'Health',      emoji: '💊' },
  { label: 'Jewellery',   emoji: '💍' },
  { label: 'Sports',      emoji: '⚽' },
  { label: 'Beauty',      emoji: '💄' },
] as const;

type StoreCategory = (typeof STORE_CATEGORIES)[number]['label'];

const TOTAL_STEPS = 4;
const STEP_LABELS = ['Details', 'Location', 'Media', 'Review'] as const;

// ── Sticky progress header ─────────────────────────────────────────────────
const ProgressHeader: React.FC<{ step: number; top: number }> = ({ step, top }) => (
  <View style={[styles.progressHeader, { paddingTop: top + 12 }]}>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
    </View>
    <View style={styles.stepLabelsRow}>
      {STEP_LABELS.map((label, i) => {
        const active = i + 1 === step;
        return (
          <Text key={label} style={[styles.stepLabel, active && styles.stepLabelActive]}>
            {label}
          </Text>
        );
      })}
    </View>
  </View>
);

// ── Step header (title + sub, inside the card) ────────────────────────────
const StepHeader: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <View style={styles.stepHead}>
    <Text style={styles.stepTitle}>{title}</Text>
    <Text style={styles.stepSub}>{sub}</Text>
  </View>
);

// ── Summary row (Step 4 review card) ───────────────────────────────────────
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [storeName,  setStoreName]  = useState('');
  const [shortName,  setShortName]  = useState('');
  const [shortNameTouched, setShortNameTouched] = useState(false);
  const [category,   setCategory]   = useState<StoreCategory | ''>('');
  const [address,    setAddress]    = useState('');
  const [area,       setArea]       = useState('');
  const [city,       setCity]       = useState('Bengaluru');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [phone,      setPhone]      = useState('');
  const [website,    setWebsite]    = useState('');

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

  // ── Validation ──────────────────────────────────────────────────────────
  const step1Valid = storeName.trim().length >= 2 && shortName.trim().length >= 1 && category !== '';
  const step2Valid = address.trim().length >= 5 && city.trim().length >= 1;
  const phoneDigits = phone.trim().replace(/\D/g, '');
  const step3Valid = phoneDigits.length >= 10;

  const canAdvance = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

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
        address:   address.trim(),
        area:      area.trim() || undefined,
        city:      city.trim() || undefined,
        logoUrl:   logoUrl || undefined,
        phone:     formatted,
        website:   website.trim() || undefined,
      });
      const store = res.data?.data?.store ?? res.data?.store;
      // The seller tabs mounted before this store existed, so ['seller','myStore']
      // is cached as null. Invalidate it so the Dashboard / My Store refetch and
      // show the freshly-created (unverified) store.
      queryClient.invalidateQueries({ queryKey: ['seller', 'myStore'] });
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
    if (step === 4) { handleSubmit(); return; }
    setStep((s) => (s + 1) as any);
  };
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as any) : s));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <ProgressHeader step={step} top={insets.top} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <View style={styles.card}>
              <StepHeader
                title="Tell us about your store"
                sub="Choose a name and category that customers will see."
              />

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

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.catGrid}>
                {STORE_CATEGORIES.map(({ label, emoji }) => {
                  const active = category === label;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setCategory(label)}
                      style={({ pressed }) => [
                        styles.catCard,
                        active && styles.catCardActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={styles.catEmoji}>{emoji}</Text>
                      <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <View style={styles.card}>
              <StepHeader
                title="Where is your store?"
                sub="Customers will use this to find and visit you."
              />

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
                <Text style={styles.fieldLabel}>Address</Text>
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
            <View style={styles.card}>
              <StepHeader
                title="Logo & contact number"
                sub="A great logo helps customers recognise you instantly."
              />

              <ImageUploader
                value={logoUrl}
                onChange={setLogoUrl}
                label="Store logo"
                folder="seller-logos"
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

          {/* ── Step 4: Review & Submit ── */}
          {step === 4 && (
            <View style={styles.card}>
              <StepHeader
                title="Review your details"
                sub="Make sure everything looks right before you submit."
              />

              <View style={styles.summaryCard}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.summaryLogo} resizeMode="cover" />
                ) : null}
                <SummaryRow label="Store name" value={storeName} />
                <SummaryRow label="Short name" value={shortName} />
                <SummaryRow label="Category" value={category} />
                <SummaryRow label="Address" value={address} />
                <SummaryRow label="Area" value={area} />
                <SummaryRow label="City" value={city} />
                <SummaryRow label="WhatsApp" value={phone ? `+91 ${phoneDigits}` : ''} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Bottom nav: Back ghost link + Next/Submit ── */}
        <View style={[styles.navRow, { paddingBottom: insets.bottom + 12 }]}>
          {step > 1 ? (
            <Pressable onPress={goBack} hitSlop={10} style={styles.backLink}>
              <ChevronLeft size={18} color={Colors.textSecondary} />
              <Text style={styles.backLinkText}>Back</Text>
            </Pressable>
          ) : <View />}

          <Pressable
            onPress={goNext}
            disabled={!canAdvance || submitting}
            style={[styles.nextBtn, (!canAdvance || submitting) && styles.nextBtnDisabled]}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.nextBtnText}>{step === 4 ? 'Create My Store' : 'Next →'}</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Sticky progress header
  progressHeader: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.backgroundGrey,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.backgroundGrey,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.orange,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  stepLabelActive: {
    fontFamily: Fonts.semiBold,
    color: Colors.orange,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Step card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  stepHead: { gap: 6, marginBottom: -4 },
  stepTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  fieldWrap: { gap: 8, marginBottom: -8 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.backgroundGrey,
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },

  // Category grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catCard: {
    width: '30%',
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catCardActive: {
    borderColor: Colors.orange,
    backgroundColor: '#FFF7ED',
  },
  catEmoji: { fontSize: 22 },
  catLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    textAlign: 'center',
  },
  catLabelActive: { color: Colors.orange },

  // Location button
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: -4,
  },
  locationBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.orange,
  },

  // Review summary
  summaryCard: {
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  summaryLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 4,
    backgroundColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },

  // Bottom nav
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundGrey,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  nextBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },

  // Misc
  dialCode: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    paddingLeft: 4,
  },
  hint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -8,
  },
});
