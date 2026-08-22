/**
 * BuyerOnboardingScreen — 2-step onboarding for new buyers.
 *
 * Step 1 — Location permission (expo-location foreground).
 * Step 2 — Category preferences (multi-select grid).
 * On complete — PATCH /users/me with { location, preferredCategories },
 *               then reset nav stack to BuyerTabNavigator.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import apiClient from '../../api/client';
import type { StoreCategory } from '../../data/offlineStores';

// ── Store categories (mirrors offlineStores taxonomy) ─────────────────────
const CATEGORIES: { label: StoreCategory; emoji: string }[] = [
  { label: 'Fashion',      emoji: '👗' },
  { label: 'Electronics',  emoji: '📱' },
  { label: 'Grocery',      emoji: '🛒' },
  { label: 'Food & Cafe',  emoji: '☕' },
  { label: 'Health',       emoji: '💊' },
  { label: 'Jewellery',    emoji: '💍' },
  { label: 'Sports',       emoji: '⚽' },
  { label: 'Beauty',       emoji: '💄' },
];

// ── Helpers ───────────────────────────────────────────────────────────────
const TOTAL_STEPS = 2;

const StepDots: React.FC<{ step: number }> = ({ step }) => (
  <View style={styles.dots}>
    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
      <View key={i} style={[styles.dot, i + 1 === step && styles.dotActive]} />
    ))}
  </View>
);

// ── Main screen ────────────────────────────────────────────────────────────
export const BuyerOnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<1 | 2>(1);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationData, setLocationData] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<Set<StoreCategory>>(new Set());
  const [loading, setLoading] = useState(false);

  // ── Step 1: request location ──────────────────────────────────────────
  const requestLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocationData({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationGranted(true);
      }
      // proceed to step 2 regardless of grant/denial
      setStep(2);
    } catch {
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const skipLocation = () => setStep(2);

  // ── Step 2: toggle category ───────────────────────────────────────────
  const toggleCategory = (cat: StoreCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // ── Finish: persist + navigate ────────────────────────────────────────
  const finish = async () => {
    setLoading(true);
    try {
      await apiClient.patch('/api/profile', {
        ...(locationData ? { location: locationData } : {}),
        preferredCategories: [...selected],
      });
    } catch {
      // best-effort — don't block the user
    } finally {
      setLoading(false);
    }

    // Reset the nav stack to the main tabs (pops the onboarding screen)
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StepDots step={step} />

      {step === 1 ? (
        /* ── Step 1: Location ── */
        <View style={styles.centerBlock}>
          <View style={styles.iconCircle}>
            <MapPin size={36} color={Colors.primary} />
          </View>
          <Text style={styles.stepTitle}>Find stores near you</Text>
          <Text style={styles.stepSub}>
            Allow location access so we can show you live streams and deals from stores around you.
            You can change this anytime in Settings.
          </Text>

          <Pressable onPress={requestLocation} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Allow location</Text>
                <ChevronRight size={18} color="#fff" />
              </>
            )}
          </Pressable>

          <Pressable onPress={skipLocation} style={styles.skipBtn} disabled={loading}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        </View>
      ) : (
        /* ── Step 2: Categories ── */
        <ScrollView contentContainerStyle={styles.catScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>What do you love shopping?</Text>
          <Text style={styles.stepSub}>
            Pick your favourites — we'll show you live streams and deals tailored to your taste.
          </Text>

          <View style={styles.catGrid}>
            {CATEGORIES.map(({ label, emoji }) => {
              const active = selected.has(label);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleCategory(label)}
                  style={({ pressed }) => [
                    styles.catCard,
                    active && styles.catCardActive,
                    pressed && styles.catCardPressed,
                  ]}
                >
                  <Text style={styles.catEmoji}>{emoji}</Text>
                  <Text style={[styles.catLabel, active && styles.catLabelActive]}>{label}</Text>
                  {active && <View style={styles.catCheck}><Text style={styles.catCheckText}>✓</Text></View>}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={finish}
            disabled={loading}
            style={[styles.primaryBtn, styles.primaryBtnWide, loading && styles.btnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {selected.size === 0 ? 'Skip for now' : `Let's go →`}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 22 },

  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    textAlign: 'center',
  },
  stepSub: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  primaryBtnWide: { alignSelf: 'stretch', marginHorizontal: 0 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  btnDisabled: { opacity: 0.6 },

  skipBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  skipBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: Fonts.semiBold },

  catScroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  catCard: {
    width: '47%',
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  catCardActive: {
    backgroundColor: Colors.primaryLight10,
    borderColor: Colors.primary,
  },
  catCardPressed: { opacity: 0.8 },
  catEmoji: { fontSize: 28 },
  catLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text, textAlign: 'center' },
  catLabelActive: { color: Colors.primary },
  catCheck: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCheckText: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold },
});
