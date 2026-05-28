import React, { useState } from 'react';
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

const logo = require('../../../assets/chingi-logo.png');

type AuthMode = 'password' | 'otp';

export const MobileLoginScreen = ({ navigation }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);

  const [mode, setMode] = useState<AuthMode>('password');
  const [identifier, setIdentifier] = useState('');   // username or email
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
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

  const sendOtpMutation = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => {
      setErrorMsg('');
      navigation.navigate('OTPVerification', { identifier: phone });
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to send OTP');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignIn = () => {
    setErrorMsg('');
    if (mode === 'password') {
      if (!identifier.trim() || !password) {
        setErrorMsg('Enter username and password');
        return;
      }
      loginMutation.mutate({ identifier: identifier.trim(), password });
    } else {
      if (phone.length !== 10) {
        setErrorMsg('Enter a valid 10-digit mobile number');
        return;
      }
      sendOtpMutation.mutate({ phone });
    }
  };

  const isLoading = loginMutation.isPending || sendOtpMutation.isPending;

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
        top={140}
        height={150}
        tileSize={84}
        loopSeconds={24}
        direction="right"
        tiltDeg={-5}
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

        {/* ── Tab segment ────────────────────────────────────────────────── */}
        <View style={st.segment}>
          <TouchableOpacity
            style={[st.segmentBtn, mode === 'password' && st.segmentBtnActive]}
            onPress={() => { setMode('password'); setErrorMsg(''); }}
            activeOpacity={0.85}
          >
            <Text style={[st.segmentText, mode === 'password' && st.segmentTextActive]}>
              Username / Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.segmentBtn, mode === 'otp' && st.segmentBtnActive]}
            onPress={() => { setMode('otp'); setErrorMsg(''); }}
            activeOpacity={0.85}
          >
            <Text style={[st.segmentText, mode === 'otp' && st.segmentTextActive]}>
              OTP Login
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        {mode === 'password' ? (
          <>
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
          </>
        ) : (
          <>
            <Text style={st.label}>Mobile Number</Text>
            <View style={st.field}>
              <Text style={st.countryCode}>+91</Text>
              <TextInput
                style={st.input}
                placeholder="Enter mobile number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            <View style={{ height: 20 }} />
          </>
        )}

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
            : <Text style={st.signinText}>{mode === 'password' ? 'Signin' : 'Send OTP'}</Text>}
        </TouchableOpacity>

        {/* ── Continue with Google ──────────────────────────────────────── */}
        <TouchableOpacity
          style={st.googleBtn}
          activeOpacity={0.85}
          onPress={() => setErrorMsg('Google sign-in coming soon')}
        >
          <Text style={st.googleText}>Continue with Google</Text>
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
    paddingTop: 180,
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

  // ── Tab segment ───────────────────────────────────────────────────────────
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 6,
    marginBottom: 22,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#101828',
    fontFamily: Fonts.bold,
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
  countryCode: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#0f172a',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    marginRight: 4,
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
