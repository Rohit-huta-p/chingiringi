import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { DiagonalImageScroll } from '../../components/DiagonalImageScroll';
import { Colors, Fonts } from '../../constants/theme';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';

const logo = require('../../../assets/chingi-logo.png');

export const MobileLoginScreen = ({ navigation }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  // Auto-dismiss when user transitions null → truthy (covers Google sign-in,
  // OTP flows, and any other async auth path that lands here as a modal).
  useEffect(() => {
    if (user && navigation.canGoBack()) navigation.goBack();
  }, [user]);

  const [identifier, setIdentifier] = useState('');   // username or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Mutations ─────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => {
      setErrorMsg('');
      await hydrate();
      // RootNavigator switches to authed stack automatically once store updates
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Invalid credentials');
    },
  });

  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setErrorMsg);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignIn = () => {
    setErrorMsg('');
    if (!identifier.trim() || !password) {
      setErrorMsg('Enter username and password');
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  const isLoading = loginMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Diagonal sliding product bg — two opposing bands ────────────── */}
      <DiagonalImageScroll
        top={0}
        height={150}
        tileSize={84}
        loopSeconds={20}
        direction="left"
        tiltDeg={-12}
        imageSeed={0}
        tileOpacity={0.92}
      />
      <DiagonalImageScroll
        top={278}
        height={150}
        tileSize={84}
        loopSeconds={24}
        direction="right"
        tiltDeg={-12}
        imageSeed={5}
        tileOpacity={0.92}
      />

      {/* White fade overlay so form area reads cleanly */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', '#ffffff']}
        locations={[0, 0.55, 0.85]}
        style={st.fadeOverlay}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={st.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo + tagline ─────────────────────────────────────────────── */}
        <View style={st.logoBadge}>
          <Image source={logo} style={st.logoImg} resizeMode="contain" />
        </View>

        <Text style={st.tagline}>
          Indian's largest passive{'\n'}income earning ecosystem
        </Text>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <Text style={st.label}>Username</Text>
        <View style={st.field}>
          <Mail size={16} color="#9ca3af" />
          <TextInput
            style={st.input}
            placeholder="your username"
            placeholderTextColor="#9ca3af"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={st.label}>Password</Text>
        <View style={st.field}>
          <Lock size={16} color="#9ca3af" />
          <TextInput
            style={st.input}
            placeholder="Enter your password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
            {showPassword
              ? <EyeOff size={16} color="#9ca3af" />
              : <Eye size={16} color="#9ca3af" />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={st.forgotWrap}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={st.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {errorMsg ? <Text style={st.errorText}>{errorMsg}</Text> : null}

        {/* ── Sign In button ─────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[st.signinBtn, isLoading && { opacity: 0.7 }]}
          onPress={handleSignIn}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={st.signinText}>Signin</Text>}
        </TouchableOpacity>

        {/* ── Continue with Google ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[st.googleBtn, googleLoading && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={googleSignIn}
          disabled={googleLoading}
        >
          {googleLoading
            ? <ActivityIndicator color="#0f172a" />
            : <Text style={st.googleText}>Continue with Google</Text>}
        </TouchableOpacity>

        {/* ── Sign up link ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={{ marginTop: 14, alignItems: 'center' }}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={st.signupHint}>
            Don't have an account? <Text style={st.signupLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <Text style={st.termsText}>
          By continuing, you agree to our{' '}
          <Text style={st.termsLink}>Terms of Service</Text>
          {' & '}
          <Text style={st.termsLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  fadeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 460,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 32,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoBadge: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 18,
  },
  logoImg: {
    width: 56,
    height: 56,
  },

  // ── Tagline ───────────────────────────────────────────────────────────────
  tagline: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#101828',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#0f172a',
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#0f172a',
    height: '100%',
    padding: 0,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  signinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signinText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  googleText: {
    color: '#0f172a',
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },

  // ── Misc ──────────────────────────────────────────────────────────────────
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  signupHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748b',
  },
  signupLink: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  termsText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
  },
  termsLink: {
    color: '#64748b',
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
  },
});
