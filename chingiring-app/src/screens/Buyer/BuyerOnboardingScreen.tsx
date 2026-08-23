/**
 * BuyerOnboardingScreen — 2-step onboarding for new buyers.
 *
 * Mockup: https://claude.ai/code/artifact/a78970ac-d161-404c-9abf-e336ad22869b
 *
 * Step 1 — Location permission (expo-location foreground), animated map-pin
 *          illustration.
 * Step 2 — Category preferences (3-col multi-select grid). Kept to the
 *          app's real 8-category StoreCategory taxonomy rather than the
 *          mockup's 12 illustrative labels — several of those (Groceries,
 *          Home & Decor, Books, Toys & Kids, Textiles, Ayurveda) aren't
 *          store categories anywhere else in the app, so sending them as
 *          preferredCategories would silently break the personalization
 *          they're meant to drive. Continue stays tappable at 0 selections
 *          (existing skippable behavior) — the mockup's dimmed state is
 *          applied as a nudge, not a hard gate.
 * On complete — PATCH /users/me with { location, preferredCategories },
 *               then reset nav stack to BuyerTabNavigator.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MapPin, ChevronRight, Store, Shirt, Gem, Check } from 'lucide-react-native';
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
      <View key={i} style={[styles.dot, i + 1 <= step && styles.dotActive]} />
    ))}
  </View>
);

// ── Location illustration — gradient circle, slow-spinning dashed ring,
// 3 satellite store icons, centered pin + pulse. ───────────────────────────
const LocationIllustration: React.FC = () => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.illoWrap}>
      <Animated.View style={[styles.illoRing, { transform: [{ rotate }] }]} />
      <View style={styles.illoRing2} />
      <View style={styles.illoCircle}>
        <View style={[styles.illoSatellite, styles.illoSat1]}><Store size={13} color={Colors.primary} /></View>
        <View style={[styles.illoSatellite, styles.illoSat2]}><Shirt size={13} color={Colors.primary} /></View>
        <View style={[styles.illoSatellite, styles.illoSat3]}><Gem size={13} color={Colors.primary} /></View>
        <MapPin size={44} color={Colors.primary} fill={Colors.primaryLight10} />
        <View style={styles.illoPulse} />
      </View>
    </View>
  );
};

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
          <LocationIllustration />
          <Text style={styles.stepTitle}>Find stores right around you</Text>
          <Text style={styles.stepSub}>
            Chingiringi shows you verified local stores and live streams in your area. Your location is never shared with sellers.
          </Text>

          <Pressable onPress={requestLocation} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MapPin size={17} color="#fff" />
                <Text style={styles.primaryBtnText}>Allow Location</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={skipLocation} style={styles.skipBtn} disabled={loading}>
            <Text style={styles.skipBtnText}>or <Text style={styles.skipBtnTextLink}>skip for now</Text></Text>
          </Pressable>
        </View>
      ) : (
        /* ── Step 2: Categories ── */
        <ScrollView contentContainerStyle={styles.catScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>What are you shopping for?</Text>
          <Text style={styles.stepSub}>
            Pick your interests — we'll show you the right stores and streams first.
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
                  {active && <View style={styles.catCheck}><Check size={10} color="#fff" strokeWidth={3} /></View>}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.catFooter}>
            <Text style={styles.selectedCount}>
              {selected.size === 0 ? (
                'Select at least one category'
              ) : (
                <><Text style={styles.selectedCountBold}>{selected.size} selected</Text> — tap to add more</>
              )}
            </Text>
            <Pressable
              onPress={finish}
              disabled={loading}
              style={[styles.primaryBtn, styles.primaryBtnWide, selected.size === 0 && styles.primaryBtnDim, loading && styles.btnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={selected.size === 0 ? Colors.textSecondary : '#fff'} />
              ) : (
                <>
                  <Text style={[styles.primaryBtnText, selected.size === 0 && styles.primaryBtnTextDim]}>Continue</Text>
                  <ChevronRight size={18} color={selected.size === 0 ? Colors.textSecondary : '#fff'} />
                </>
              )}
            </Pressable>
          </View>
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

  // Illustration
  illoWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  illoRing: {
    position: 'absolute', width: 208, height: 208, borderRadius: 104,
    borderWidth: 2, borderColor: Colors.primaryLight, borderStyle: 'dashed',
  },
  illoRing2: {
    position: 'absolute', width: 236, height: 236, borderRadius: 118,
    borderWidth: 1.5, borderColor: Colors.primaryLight10, borderStyle: 'dashed',
  },
  illoCircle: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.primaryLight10,
    alignItems: 'center', justifyContent: 'center',
  },
  illoSatellite: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff', borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  illoSat1: { top: 22, left: 30 },
  illoSat2: { top: 52, right: 14 },
  illoSat3: { bottom: 30, left: 20 },
  illoPulse: { width: 36, height: 9, borderRadius: 18, backgroundColor: Colors.primaryLight10, marginTop: -6 },

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
  primaryBtnDim: { backgroundColor: Colors.border },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  primaryBtnTextDim: { color: Colors.textSecondary },
  btnDisabled: { opacity: 0.6 },

  skipBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  skipBtnText: { color: Colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
  skipBtnTextLink: { color: Colors.text, fontFamily: Fonts.semiBold, textDecorationLine: 'underline' },

  catScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },

  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 18,
    marginBottom: 6,
  },
  catCard: {
    width: '31.5%',
    backgroundColor: Colors.backgroundGrey,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 7,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  catCardActive: {
    backgroundColor: Colors.primaryLight10,
    borderColor: Colors.primary,
  },
  catCardPressed: { opacity: 0.8 },
  catEmoji: { fontSize: 24 },
  catLabel: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.text, textAlign: 'center' },
  catLabelActive: { color: Colors.primary },
  catCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  catFooter: { marginTop: 14 },
  selectedCount: { textAlign: 'center', fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSecondary, marginBottom: 12 },
  selectedCountBold: { fontFamily: Fonts.bold, color: Colors.primary },
});
