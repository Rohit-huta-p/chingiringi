/**
 * BusinessOnboardingScreen — 4-step wizard for new sellers.
 *
 * Step 1 — Store basics: name + category
 * Step 2 — Location: address + "Use my location" autofill
 * Step 3 — Logo: ImageUploader (optional — can skip)
 * Step 4 — WhatsApp: +91 phone number
 *
 * On finish: POST /api/stores → navigate to StoreVerificationScreen.
 * All active elements, progress dots, and CTAs use Colors.orange (#F97316).
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Input } from '../../components/Input';
import { ImageUploader } from '../../components/ImageUploader';
import apiClient from '../../api/client';

// ── Store categories (predefined; CategoryPicker is admin-only) ───────────
// CategoryPicker uses adminAPI.getCategories() which is gated to admin role.
// We use a simple single-select grid of the canonical store categories instead.
const STORE_CATEGORIES = [
  { label: 'Fashion',     emoji: '👗' },
  { label: 'Electronics', emoji: '📱' },
  { label: 'Grocery',     emoji: '🛒' },
  { label: 'Food & Cafe', emoji: '☕' },
  { label: 'Health',      emoji: '💊' },
  { label: 'Jewellery',   emoji: '💍' },
  { label: 'Sports',      emoji: '⚽' },
  { label: 'Beauty',      emoji: '💄' },
  { label: 'Other',       emoji: '🏪' },
] as const;

type StoreCategory = (typeof STORE_CATEGORIES)[number]['label'];

// ── Progress dots ─────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const ProgressDots: React.FC<{ step: number }> = ({ step }) => (
  <View style={styles.dots}>
    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
      <View key={i} style={[styles.dot, i + 1 <= step && styles.dotActive]} />
    ))}
  </View>
);

// ── Step header ───────────────────────────────────────────────────────────
const StepHeader: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <View style={styles.stepHead}>
    <Text style={styles.stepTitle}>{title}</Text>
    <Text style={styles.stepSub}>{sub}</Text>
  </View>
);

// ── Orange CTA button ─────────────────────────────────────────────────────
const OrangeBtn: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, loading, disabled }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading}
    style={[styles.cta, (disabled || loading) && styles.ctaDisabled]}
  >
    {loading
      ? <ActivityIndicator color="#fff" />
      : <Text style={styles.ctaText}>{label}</Text>}
  </Pressable>
);

// ── Main screen ───────────────────────────────────────────────────────────
export const BusinessOnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [storeName,  setStoreName]  = useState('');
  const [category,   setCategory]   = useState<StoreCategory | ''>('');
  const [address,    setAddress]    = useState('');
  const [area,       setArea]       = useState('');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [phone,      setPhone]      = useState('');

  const [locationBusy, setLocationBusy] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────
  const step1Valid = storeName.trim().length >= 2 && category !== '';
  const step2Valid = address.trim().length >= 5;
  const step4Valid = phone.trim().replace(/\D/g, '').length >= 10;

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
      // Reverse-geocode to get a human-readable address
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo) {
        setAddress([geo.name, geo.street].filter(Boolean).join(', '));
        setArea([geo.district, geo.subregion, geo.city].filter(Boolean).join(', '));
      }
    } catch {
      Alert.alert('Could not get location', 'Please type your address manually.');
    } finally {
      setLocationBusy(false);
    }
  };

  // ── Final submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const raw = phone.trim().replace(/\D/g, '');
    if (raw.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit WhatsApp number.');
      return;
    }
    const formatted = raw.length === 10 ? `+91${raw}` : `+${raw}`;

    setSubmitting(true);
    try {
      // POST /api/stores/seller — seller-accessible route (no admin middleware).
      // Returns 200 with existing store if one already exists for this account,
      // or 201 with the newly-created store.
      const res = await apiClient.post('/api/stores/seller', {
        name:     storeName.trim(),
        category,
        address:  address.trim(),
        area:     area.trim() || undefined,
        logoUrl:  logoUrl || undefined,
        phone:    formatted,
      });
      const store = res.data?.data?.store ?? res.data?.store;
      // Navigate to verification screen with the new (or existing) store
      navigation.replace('StoreVerification', { store });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';
      Alert.alert('Could not create store', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Back arrow (hidden on step 1 — user got here from RoleSelection) */}
        {step > 1 && (
          <Pressable
            onPress={() => setStep((s) => (s - 1) as any)}
            hitSlop={10}
            style={styles.backBtn}
          >
            <ChevronLeft size={22} color={Colors.text} />
          </Pressable>
        )}

        <ProgressDots step={step} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Store basics ── */}
          {step === 1 && (
            <View style={styles.stepBody}>
              <StepHeader
                title="Tell us about your store"
                sub="Choose a name and category that customers will see."
              />

              <Input
                label="Store name"
                placeholder="e.g. Rohit's Boutique"
                value={storeName}
                onChangeText={setStoreName}
                autoCapitalize="words"
                maxLength={60}
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

              <OrangeBtn
                label="Next →"
                onPress={() => setStep(2)}
                disabled={!step1Valid}
              />
            </View>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <View style={styles.stepBody}>
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

              <Input
                label="Street address"
                placeholder="Shop no. / building name, street"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="sentences"
              />
              <Input
                label="Area / Locality (optional)"
                placeholder="e.g. Koramangala, Indiranagar"
                value={area}
                onChangeText={setArea}
                autoCapitalize="sentences"
              />

              <OrangeBtn
                label="Next →"
                onPress={() => setStep(3)}
                disabled={!step2Valid}
              />
            </View>
          )}

          {/* ── Step 3: Logo ── */}
          {step === 3 && (
            <View style={styles.stepBody}>
              <StepHeader
                title="Add your store logo"
                sub="A great logo helps customers recognise you instantly."
              />

              <ImageUploader
                value={logoUrl}
                onChange={setLogoUrl}
                label="Store logo"
                folder="seller-logos"
              />

              <OrangeBtn
                label="Next →"
                onPress={() => setStep(4)}
              />
              <Pressable onPress={() => setStep(4)} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 4: WhatsApp ── */}
          {step === 4 && (
            <View style={styles.stepBody}>
              <StepHeader
                title="Your WhatsApp number"
                sub="Buyers can tap to message you directly from your store page."
              />

              <Input
                label="WhatsApp number"
                placeholder="98765 43210"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^\d\s+\-()]/g, ''))}
                keyboardType="phone-pad"
                leftIcon={
                  <Text style={styles.dialCode}>+91</Text>
                }
                maxLength={15}
              />
              <Text style={styles.hint}>
                Enter your 10-digit mobile number. We'll format it as +91 automatically.
              </Text>

              <OrangeBtn
                label="Create My Store"
                onPress={handleSubmit}
                loading={submitting}
                disabled={!step4Valid}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.orange,
    width: 22,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  stepBody: { gap: 16 },

  stepHead: { gap: 6, marginBottom: 4 },
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

  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: -8,
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
    marginBottom: 4,
  },
  locationBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.orange,
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

  // Skip
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
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
