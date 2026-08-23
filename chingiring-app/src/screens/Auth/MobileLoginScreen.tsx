/**
 * MobileLoginScreen
 *
 * Mockup: https://claude.ai/code/artifact/db97775a-7836-48b4-be98-2a24bca0a616
 *
 * Visual restyle only — per explicit decision, sign-in stays username +
 * password (+ Google); the mockup's phone-number/OTP flow was NOT adopted
 * here since it would change the actual auth mechanism and could lock out
 * any account with no phone on file. Built as its own bespoke hero+sheet
 * layout rather than reusing the shared MobileAuthScaffold, so this restyle
 * doesn't also change SignupScreen's mobile branch (out of this project's
 * scope) which depends on that same shared component.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ShoppingBag, ArrowRight } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Colors, Fonts } from '../../constants/theme';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';

export const MobileLoginScreen = ({ navigation }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  // Auto-dismiss when user transitions null → truthy (Google, OTP, any async path).
  useEffect(() => {
    if (user && navigation.canGoBack()) navigation.goBack();
  }, [user]);

  const [identifier, setIdentifier] = useState('');   // username or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => {
      setErrorMsg('');
      await hydrate();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Invalid credentials');
    },
  });

  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setErrorMsg);

  const handleSignIn = () => {
    setErrorMsg('');
    if (!identifier.trim() || !password) {
      setErrorMsg('Enter username and password');
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  // Toggle → signup. Route is 'AuthSignup' in the guest stack, 'Signup' under AuthNavigator.
  const goSignup = () => {
    const names = navigation.getState()?.routeNames ?? [];
    navigation.navigate((names.includes('AuthSignup') ? 'AuthSignup' : 'Signup') as never);
  };

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <LinearGradient colors={[Colors.navy, '#1E3A8A', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={st.hero}>
          <View style={st.heroBlob1} pointerEvents="none" />
          <View style={st.heroBlob2} pointerEvents="none" />
          <View style={st.logoWrap}>
            <ShoppingBag size={32} color="#fff" />
          </View>
          <Text style={st.appName}>Chingiringi</Text>
          <Text style={st.appTagline}>Local stores. Live streams.{'\n'}Shop what's near you.</Text>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={st.body}>
          <Text style={st.welcome}>Welcome</Text>
          <Text style={st.welcomeSub}>Sign in to discover stores and live deals in your area.</Text>

          {/* Google */}
          <TouchableOpacity style={[st.googleBtn, googleLoading && { opacity: 0.7 }]} onPress={googleSignIn} disabled={googleLoading} activeOpacity={0.9}>
            {googleLoading ? <ActivityIndicator color={Colors.primary} /> : (
              <>
                <View style={st.googleG}><Text style={st.googleGText}>G</Text></View>
                <Text style={st.googleLabel}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={st.divider}>
            <View style={st.dividerLine} />
            <Text style={st.dividerText}>OR</Text>
            <View style={st.dividerLine} />
          </View>

          {/* Fields */}
          <View style={{ marginBottom: 12 }}>
            <Text style={st.label}>Username</Text>
            <View style={st.field}>
              <Mail size={16} color="#98a2b3" />
              <TextInput
                style={st.input}
                placeholder="your username"
                placeholderTextColor="#9aa6b8"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={st.label}>Password</Text>
            <View style={st.field}>
              <Lock size={16} color="#98a2b3" />
              <TextInput
                style={st.input}
                placeholder="Enter your password"
                placeholderTextColor="#9aa6b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                {showPassword ? <EyeOff size={16} color="#98a2b3" /> : <Eye size={16} color="#98a2b3" />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={st.forgotWrap} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={st.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {errorMsg ? <Text style={st.errorText}>{errorMsg}</Text> : null}

          {/* Continue */}
          <TouchableOpacity
            style={[st.cta, loginMutation.isPending && { opacity: 0.7 }]}
            onPress={handleSignIn}
            disabled={loginMutation.isPending}
            activeOpacity={0.9}
          >
            {loginMutation.isPending ? <ActivityIndicator color="#fff" /> : (
              <View style={st.ctaRow}>
                <Text style={st.ctaText}>Sign in</Text>
                <ArrowRight size={17} color="#fff" strokeWidth={2.3} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={goSignup} style={{ marginTop: 18 }}>
            <Text style={st.switchText}>Don't have an account? <Text style={st.switchTextBold}>Create one</Text></Text>
          </TouchableOpacity>

          <Text style={st.terms}>
            By continuing, you agree to our <Text style={st.termsLink}>Terms of Service</Text>
            {' & '}<Text style={st.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1 },

  hero: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40,
    alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  heroBlob1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -50 },
  heroBlob2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -40, left: -30 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  appName: { fontFamily: Fonts.extraBold, fontSize: 27, color: '#fff', letterSpacing: -0.6, marginBottom: 8 },
  appTagline: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 19 },

  body: { paddingHorizontal: 24, paddingTop: 26 },
  welcome: { fontFamily: Fonts.extraBold, fontSize: 22, color: Colors.text, marginBottom: 6 },
  welcomeSub: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginBottom: 26, lineHeight: 19 },

  googleBtn: {
    height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1,
  },
  googleG: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  googleGText: { fontFamily: Fonts.extraBold, fontSize: 13, color: '#4285F4' },
  googleLabel: { fontSize: 14.5, fontFamily: Fonts.semiBold, color: Colors.text },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary, letterSpacing: 0.6 },

  label: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 7 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, backgroundColor: Colors.backgroundGrey },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text, padding: 0, height: '100%' },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14 },
  forgotText: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary },
  errorText: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.semiBold, textAlign: 'center', marginBottom: 8 },

  cta: { height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semiBold },

  switchText: { textAlign: 'center', fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  switchTextBold: { fontFamily: Fonts.bold, color: Colors.primary },

  terms: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', textAlign: 'center', marginTop: 22, lineHeight: 16 },
  termsLink: { color: '#64748b', fontFamily: Fonts.semiBold, textDecorationLine: 'underline' },
});
