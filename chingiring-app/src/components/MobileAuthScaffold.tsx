import React from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import {
  AuthLayoutContext, AuthBrandMark, AuthSegToggle, AuthAltOptions, type AuthScaffoldProps,
} from './AuthParts';

// Kept here so existing imports (MobileAuthModal) keep working.
export { AuthField, AuthCTA } from './AuthParts';

// Editorial phone auth chrome — "Direction A: hero band" from the approved
// mockup. Gradient hero (brand + Shop. Share. Earn.) with a white sheet pulled
// over it, a Sign in / Create account toggle, and the OR + Google block.
// Every auth screen renders through this on phones (native + narrow web) via
// AuthScaffold; sub-steps pass `hideChrome` + `compact` + `onBack`.
//
// The hero runs full-bleed under the status bar (light icons), so the screen
// must NOT sit inside a top-edge SafeAreaView — the insets are applied here.

export const MobileAuthScaffold: React.FC<AuthScaffoldProps> = ({
  mode, heading, subheading, onSwitch, onGoogle, googleLoading, onPhone, phoneLoading,
  hideChrome, compact, onBack, children, footer,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <AuthLayoutContext.Provider value="mobile">
      {/* Padding on both platforms: Android is edge-to-edge (Expo 54), so the
          window no longer resizes for the keyboard on its own. */}
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        {Platform.OS !== 'web' && <StatusBar style="light" />}
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* ── Editorial hero ─────────────────────────────────────────── */}
          <View style={[s.hero, compact && s.heroCompact, { paddingTop: Math.max(insets.top, 24) + 16 }]}>
            <LinearGradient colors={['#5B3AA8', '#3A6FC9', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(6,10,20,0.34)']} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[s.brand, compact && s.brandCompact]}>
              {onBack ? (
                <TouchableOpacity style={s.back} onPress={onBack} hitSlop={8} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Back">
                  <ArrowLeft size={18} color="#fff" strokeWidth={2.4} />
                </TouchableOpacity>
              ) : null}
              <AuthBrandMark size={38} />
              <Text style={s.bname}>ChingiRingi</Text>
            </View>
            {!compact && (
              <>
                <Text style={s.eyebrow}>Passive income, simplified</Text>
                <Text style={s.htitle}>Shop. Share. Earn.</Text>
                <Text style={s.hsub}>Join thousands earning cashback and coins on everyday purchases.</Text>
              </>
            )}
          </View>

          {/* ── White sheet ────────────────────────────────────────────── */}
          <View style={[s.sheet, { paddingBottom: 30 + insets.bottom }]}>
            {!hideChrome && <AuthSegToggle mode={mode} onSwitch={onSwitch} />}
            {hideChrome && heading ? <Text style={s.head} accessibilityRole="header">{heading}</Text> : null}
            {hideChrome && subheading ? <Text style={s.sub}>{subheading}</Text> : null}

            {children}

            {!hideChrome && (
              <AuthAltOptions
                isLogin={mode === 'login'}
                onGoogle={onGoogle}
                googleLoading={googleLoading}
                onPhone={onPhone}
                phoneLoading={phoneLoading}
              />
            )}

            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLayoutContext.Provider>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flexGrow: 1 },

  hero: { paddingHorizontal: 24, paddingBottom: 46, overflow: 'hidden' },
  heroCompact: { paddingBottom: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 32 },
  brandCompact: { marginBottom: 0 },
  back: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  bname: { color: '#fff', fontFamily: Fonts.bold, fontSize: 16 },
  eyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.4, textTransform: 'uppercase' },
  htitle: { color: '#fff', fontSize: 30, fontFamily: Fonts.extraBold, letterSpacing: -0.6, marginTop: 8 },
  hsub: { color: 'rgba(255,255,255,0.86)', fontSize: 12.5, fontFamily: Fonts.regular, marginTop: 8, lineHeight: 18, maxWidth: 250 },

  sheet: { flexGrow: 1, backgroundColor: '#fff', marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 24, minHeight: 380 },
  head: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.text, letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 6, marginBottom: 18, lineHeight: 19 },
});

export default MobileAuthScaffold;
