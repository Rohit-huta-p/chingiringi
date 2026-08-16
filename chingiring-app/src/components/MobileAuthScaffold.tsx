import React from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, ScrollView,
  Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

// Editorial mobile auth chrome — "Direction A: hero band" from the approved
// mockup. Gradient hero (brand + Shop. Share. Earn.) with a white sheet pulled
// over it, a Sign in / Create account toggle, and the OR + Google block.
// Shared by MobileLoginScreen and the mobile branch of SignupScreen so the
// hero, toggle, fields, and Google button live in exactly one place.

// ── Reusable field ────────────────────────────────────────────────────────────
export const AuthField = ({ icon: Icon, label, right, ...props }: any) => (
  <View style={{ marginBottom: 12 }}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <View style={s.field}>
      <Icon size={16} color="#98a2b3" />
      <TextInput style={s.input} placeholderTextColor="#9aa6b8" {...props} />
      {right}
    </View>
  </View>
);

// ── Primary CTA (arrow, spinner) ──────────────────────────────────────────────
export const AuthCTA = ({ label, onPress, loading }: any) => (
  <TouchableOpacity
    style={[s.cta, loading && { opacity: 0.7 }]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.9}
  >
    {loading ? <ActivityIndicator color="#fff" /> : (
      <View style={s.ctaRow}>
        <Text style={s.ctaTxt}>{label}</Text>
        <ArrowRight size={17} color="#fff" strokeWidth={2.3} />
      </View>
    )}
  </TouchableOpacity>
);

interface ScaffoldProps {
  mode: 'login' | 'signup';
  onSwitch?: () => void;       // toggle to the other mode (omit when hideChrome)
  onGoogle?: () => void;
  googleLoading?: boolean;
  hideChrome?: boolean;        // hide the toggle + OR + Google (e.g. the verify step)
  children: React.ReactNode;   // fields + forgot/error + CTA
  footer?: React.ReactNode;    // terms text etc.
}

export const MobileAuthScaffold: React.FC<ScaffoldProps> = ({
  mode, onSwitch, onGoogle, googleLoading, hideChrome, children, footer,
}) => {
  const isLogin = mode === 'login';
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Editorial hero ─────────────────────────────────────────── */}
        <View style={s.hero}>
          <LinearGradient colors={['#5B3AA8', '#3A6FC9', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['transparent', 'rgba(6,10,20,0.34)']} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={s.brand}>
            <View style={s.btile}><Text style={s.btileTxt}>C</Text></View>
            <Text style={s.bname}>ChingiRingi</Text>
          </View>
          <Text style={s.eyebrow}>Passive income, simplified</Text>
          <Text style={s.htitle}>Shop. Share. Earn.</Text>
          <Text style={s.hsub}>Join thousands earning cashback and coins on everyday purchases.</Text>
        </View>

        {/* ── White sheet ────────────────────────────────────────────── */}
        <View style={s.sheet}>
          {!hideChrome && (
            <View style={s.seg}>
              <TouchableOpacity style={[s.segBtn, isLogin && s.segOn]} onPress={isLogin ? undefined : onSwitch} activeOpacity={0.9}>
                <Text style={[s.segTxt, isLogin && s.segTxtOn]}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.segBtn, !isLogin && s.segOn]} onPress={!isLogin ? undefined : onSwitch} activeOpacity={0.9}>
                <Text style={[s.segTxt, !isLogin && s.segTxtOn]}>Create account</Text>
              </TouchableOpacity>
            </View>
          )}

          {children}

          {!hideChrome && (
            <>
              <View style={s.orRow}><View style={s.orLine} /><Text style={s.orTxt}>OR</Text><View style={s.orLine} /></View>

              <TouchableOpacity style={[s.google, googleLoading && { opacity: 0.7 }]} onPress={onGoogle} disabled={googleLoading} activeOpacity={0.9}>
                {googleLoading ? <ActivityIndicator color={Colors.primary} /> : (
                  <>
                    <View style={s.gG}><Text style={s.gGtxt}>G</Text></View>
                    <Text style={s.googleTxt}>{isLogin ? 'Continue with Google' : 'Sign up with Google'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flexGrow: 1 },

  hero: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 46, overflow: 'hidden' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 32 },
  btile: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  btileTxt: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 17 },
  bname: { color: '#fff', fontFamily: Fonts.bold, fontSize: 15 },
  eyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.4, textTransform: 'uppercase' },
  htitle: { color: '#fff', fontSize: 30, fontFamily: Fonts.extraBold, letterSpacing: -0.6, marginTop: 8 },
  hsub: { color: 'rgba(255,255,255,0.86)', fontSize: 12.5, fontFamily: Fonts.regular, marginTop: 8, lineHeight: 18, maxWidth: 250 },

  sheet: { backgroundColor: '#fff', marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 30, minHeight: 380 },
  seg: { flexDirection: 'row', backgroundColor: '#eef2f8', borderRadius: 11, padding: 4, marginBottom: 18 },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  segOn: { backgroundColor: '#fff' },
  segTxt: { fontSize: 12.5, fontFamily: Fonts.bold, color: '#68727f' },
  segTxtOn: { color: Colors.text },

  label: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: '#0f172a', marginBottom: 7 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 13, backgroundColor: '#f8fafc' },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: '#0f172a', padding: 0, height: '100%' },

  cta: { height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 15 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e6eaf0' },
  orTxt: { color: '#94a3b8', fontSize: 11.5, fontFamily: Fonts.medium },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 47, borderRadius: 12, borderWidth: 1, borderColor: '#dfe4ea', backgroundColor: '#fff' },
  gG: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  gGtxt: { fontFamily: Fonts.extraBold, fontSize: 12, color: '#4285F4' },
  googleTxt: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#26313f' },
});

export default MobileAuthScaffold;
