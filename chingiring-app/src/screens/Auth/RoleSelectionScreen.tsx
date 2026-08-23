/**
 * RoleSelectionScreen
 *
 * Mockup: https://claude.ai/code/artifact/2fe661ec-a510-4e3f-b515-bafc363b5353
 *
 * Shown to authenticated users who have no role yet (role === null/undefined).
 * Tapping a card selects it (radio + feature bullets, doesn't submit); a
 * "Get Started" button confirms the currently-selected role:
 *  1. PATCH /api/profile/role  { role }
 *  2. setRole() in Zustand → triggers RootNavigator re-render
 *  3. Navigate (via role fork in RootNavigator):
 *     - buyer  → BuyerTabNavigator  (via BuyerOnboarding stub)
 *     - seller → SellerTabNavigator (via BusinessOnboarding stub)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ShoppingBag, Store, ArrowRight } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { useAuthStore } from '../../store';
import apiClient from '../../api/client';
import { navigationRef } from '../../lib/navigationRef';

type Role = 'buyer' | 'seller';

const ROLE_COPY: Record<Role, { title: string; desc: string; features: string[] }> = {
  buyer: {
    title: "I want to buy",
    desc: 'Discover local stores, watch live streams, and chat with sellers near you.',
    features: [
      'Browse verified stores nearby',
      'Watch live streams from shops',
      'Earn cashback on purchases',
    ],
  },
  seller: {
    title: "I want to sell",
    desc: 'List your store, showcase products, go live, and reach buyers around you.',
    features: [
      'Set up your store profile',
      'Go live and engage buyers',
      'Get WhatsApp inquiries directly',
    ],
  },
};

/**
 * Navigate to `routeName` once the navigation tree is ready.
 *
 * After setRole() the RootNavigator unmounts RoleSelectionScreen and mounts the
 * role-specific navigator. The new navigator may not have registered itself with
 * navigationRef yet when this code runs. Rather than betting on a fixed 200ms
 * delay (fragile on low-end devices), we poll isReady() with growing intervals
 * up to MAX_ATTEMPTS times (~3.6 s total budget) and silently give up if it
 * never becomes ready — the user lands on the correct tab navigator's default
 * screen, which is a valid fallback.
 */
function navigateWhenReady(routeName: string, maxAttempts = 8, baseDelayMs = 100) {
  let attempt = 0;
  const tryNavigate = () => {
    attempt += 1;
    if (navigationRef.isReady()) {
      navigationRef.navigate(routeName as never);
    } else if (attempt < maxAttempts) {
      // Linear back-off: 100ms, 200ms, 300ms … 700ms (total ~3.6s)
      setTimeout(tryNavigate, baseDelayMs * attempt);
    }
    // Silently give up after maxAttempts — the role navigator already mounted,
    // so the user is on the correct tab; onboarding can be reached from the
    // My Store / Profile tab if they choose.
  };
  setTimeout(tryNavigate, baseDelayMs);
}

export default function RoleSelectionScreen() {
  const setRole = useAuthStore((s) => s.setRole);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<Role>('buyer');
  const [submitting, setSubmitting] = useState(false);

  const handleGetStarted = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      await apiClient.patch('/api/profile/role', { role: selected });
      // Update Zustand — this causes RootNavigator to swap in the correct navigator
      setRole(selected);
      // Deep-link into the onboarding screen once the new navigator has mounted.
      // navigateWhenReady() retries with growing delays instead of a fixed 200ms bet.
      if (selected === 'buyer') {
        navigateWhenReady('BuyerOnboarding');
      } else {
        navigateWhenReady('BusinessOnboarding');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Something went wrong. Please try again.';
      Alert.alert('Could not set role', message);
    } finally {
      setSubmitting(false);
    }
  };

  const accent = selected === 'buyer' ? Colors.primary : Colors.orange;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logo}>
            <MapPin size={28} color="#fff" />
          </View>
          <Text style={styles.logoName}>Chingiringi</Text>
          <Text style={styles.logoTag}>Your local store, online</Text>
        </View>

        {/* Heading */}
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>How will you use the app?</Text>
          <Text style={styles.headingSub}>
            Choose your role to get the right experience. You can always change this later.
          </Text>
        </View>

        {/* Role cards */}
        <View style={styles.cards}>
          {(['buyer', 'seller'] as Role[]).map((role) => {
            const isSelected = selected === role;
            const roleAccent = role === 'buyer' ? Colors.primary : Colors.orange;
            const copy = ROLE_COPY[role];
            return (
              <Pressable
                key={role}
                onPress={() => setSelected(role)}
                style={[
                  styles.card,
                  isSelected && { borderColor: roleAccent, backgroundColor: role === 'buyer' ? Colors.primaryLight10 : '#FFF7ED' },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.roleIcon, { backgroundColor: role === 'buyer' ? '#EBF2FF' : '#FFF7ED' }]}>
                  {role === 'buyer' ? (
                    <ShoppingBag size={24} color={Colors.primary} strokeWidth={2} />
                  ) : (
                    <Store size={24} color={Colors.orange} strokeWidth={2} />
                  )}
                </View>
                <View style={styles.roleText}>
                  <Text style={styles.roleTitle}>{copy.title}</Text>
                  <Text style={styles.roleDesc}>{copy.desc}</Text>
                  <View style={styles.roleFeatures}>
                    {copy.features.map((f) => (
                      <View key={f} style={styles.roleFeatRow}>
                        <View style={[styles.roleFeatDot, { backgroundColor: roleAccent }]} />
                        <Text style={styles.roleFeatText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={[styles.radio, isSelected && { borderColor: roleAccent, backgroundColor: roleAccent }]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleGetStarted}
            disabled={submitting}
            style={[styles.cta, { backgroundColor: accent }, submitting && styles.ctaDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Get Started</Text>
                <ArrowRight size={18} color="#fff" />
              </>
            )}
          </Pressable>
          {!!user?.email && (
            <Text style={styles.signinNote}>Signed in as <Text style={styles.signinNoteBold}>{user.email}</Text></Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },

  logoArea: { alignItems: 'center', paddingTop: 20, paddingBottom: 24 },
  logo: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
  },
  logoName: { fontFamily: Fonts.extraBold, fontSize: 20, color: Colors.text, letterSpacing: -0.3 },
  logoTag: { fontFamily: Fonts.regular, fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },

  heading: { alignItems: 'center', marginBottom: 22 },
  headingTitle: { fontFamily: Fonts.extraBold, fontSize: 21, color: Colors.text, textAlign: 'center', marginBottom: 7 },
  headingSub: { fontFamily: Fonts.regular, fontSize: 13.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },

  cards: { gap: 12 },
  card: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  roleIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleText: { flex: 1 },
  roleTitle: { fontFamily: Fonts.bold, fontSize: 15.5, color: Colors.text, marginBottom: 4 },
  roleDesc: { fontFamily: Fonts.regular, fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18 },
  roleFeatures: { marginTop: 9, gap: 4 },
  roleFeatRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleFeatDot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  roleFeatText: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.text },

  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2, flexShrink: 0,
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  footer: { marginTop: 24 },
  cta: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  signinNote: { textAlign: 'center', marginTop: 14, fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
  signinNoteBold: { fontFamily: Fonts.bold, color: Colors.text },
});
