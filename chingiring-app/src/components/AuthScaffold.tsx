import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { MobileAuthScaffold } from './MobileAuthScaffold';
import {
  AuthLayoutContext, AuthBrandMark, AuthSegToggle, AuthAltOptions, type AuthScaffoldProps,
} from './AuthParts';

// Same breakpoint as RootNavigator / AuthGateContext: web ≥ 768 is desktop.
const DESKTOP_MIN_WIDTH = 768;
// Below this the brand panel tightens its padding and headline.
const WIDE_DESKTOP = 1100;

/**
 * Chrome for every auth screen. Phones (native, and web under 768px) get the
 * hero-band MobileAuthScaffold; desktop web gets the full-page split from the
 * DesktopAuthModal design. Screens keep their state, so crossing the
 * breakpoint only swaps the chrome.
 */
export const AuthScaffold: React.FC<AuthScaffoldProps> = (props) => {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
  return isDesktop ? <DesktopAuthShell {...props} /> : <MobileAuthScaffold {...props} />;
};

// ── Desktop: full-page split ──────────────────────────────────────────────────

/** Left side of the desktop page: full-height brand gradient + tagline. */
export const DesktopAuthHero = () => {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_DESKTOP;
  return (
    <View style={[d.left, !wide && d.leftTight]}>
      <LinearGradient colors={['#5B3AA8', '#3A6FC9', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', 'rgba(6,10,20,0.62)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={d.leftLogo}>
        <AuthBrandMark size={46} />
        <Text style={d.leftBrand}>ChingiRingi</Text>
      </View>
      <View style={d.leftCap}>
        <Text style={d.leftEy}>Passive income, simplified</Text>
        {/* One word per line: an intentional stack at every width, never a stray "Earn." */}
        <Text style={[d.leftH, !wide && d.leftHTight]}>{'Shop.\nShare.\nEarn.'}</Text>
        <Text style={d.leftP}>Join thousands earning cashback and coins on everyday purchases.</Text>
      </View>
    </View>
  );
};

/**
 * Desktop auth page: the DesktopAuthModal split, full-bleed. Brand panel fills
 * the left side top to bottom; the form sits centred in the white right side
 * at a readable width and scrolls on its own when it's taller than the window.
 */
export const DesktopAuthShell: React.FC<AuthScaffoldProps> = ({
  mode, heading, subheading, onSwitch, onGoogle, googleLoading, onPhone, phoneLoading,
  hideChrome, onBack, children, footer,
}) => {
  const isLogin = mode === 'login';
  return (
    <AuthLayoutContext.Provider value="desktop">
      <View style={d.page}>
        <DesktopAuthHero />

        <ScrollView style={d.right} contentContainerStyle={d.rightInner} keyboardShouldPersistTaps="handled">
          <View style={d.form}>
            {onBack ? (
              <TouchableOpacity style={d.back} onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
                <ArrowLeft size={15} color={Colors.textSecondary} strokeWidth={2.2} />
                <Text style={d.backTxt}>Back</Text>
              </TouchableOpacity>
            ) : null}
            {heading ? <Text style={d.fhead} accessibilityRole="header">{heading}</Text> : null}
            {subheading ? <Text style={d.fsub}>{subheading}</Text> : null}

            {!hideChrome && <AuthSegToggle mode={mode} onSwitch={onSwitch} />}

            {children}

            {!hideChrome && (
              <>
                <AuthAltOptions
                  isLogin={isLogin}
                  onGoogle={onGoogle}
                  googleLoading={googleLoading}
                  onPhone={onPhone}
                  phoneLoading={phoneLoading}
                />
                {onSwitch ? (
                  <Text style={d.foot}>
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <Text style={d.footLink} onPress={onSwitch} accessibilityRole="link">
                      {isLogin ? 'Create one' : 'Sign in'}
                    </Text>
                  </Text>
                ) : null}
              </>
            )}

            {footer}
          </View>
        </ScrollView>
      </View>
    </AuthLayoutContext.Provider>
  );
};

const d = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },

  left: { flex: 0.45, paddingHorizontal: 56, paddingVertical: 48, justifyContent: 'space-between', overflow: 'hidden' },
  leftTight: { paddingHorizontal: 36, paddingVertical: 36 },
  leftLogo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leftBrand: { color: '#fff', fontFamily: Fonts.bold, fontSize: 19 },
  leftCap: { maxWidth: 440 },
  leftEy: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1.6, textTransform: 'uppercase' },
  leftH: { color: '#fff', fontSize: 52, lineHeight: 56, fontFamily: Fonts.extraBold, letterSpacing: -1.4, marginTop: 14 },
  leftHTight: { fontSize: 40, lineHeight: 45, letterSpacing: -1 },
  leftP: { color: 'rgba(255,255,255,0.86)', fontSize: 15.5, fontFamily: Fonts.regular, marginTop: 14, lineHeight: 23, maxWidth: 380 },

  right: { flex: 0.55 },
  rightInner: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  form: { width: '100%', maxWidth: 400 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 16 },
  backTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  fhead: { fontSize: 28, fontFamily: Fonts.extraBold, letterSpacing: -0.6, color: Colors.text },
  fsub: { fontSize: 14.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 6, marginBottom: 22, lineHeight: 21 },
  foot: { textAlign: 'center', fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 18 },
  footLink: { color: Colors.primary, fontFamily: Fonts.bold },
});

export default AuthScaffold;
