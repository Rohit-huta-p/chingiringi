/**
 * MobileOTPScreen
 *
 * Mockup: https://claude.ai/code/artifact/db97775a-7836-48b4-be98-2a24bca0a616
 * (shown as the "OTP entry" toggle state of the same frame as MobileLoginScreen —
 * same gradient hero, so this screen matches it rather than using the older
 * MobileAuthHeader chrome.)
 *
 * Visual restyle only. Kept exactly as before: OTP_LENGTH = 6 (the mockup's
 * 4 boxes are its own placeholder, not a change to how many digits the
 * backend actually issues), the route.params.identifier contract, and both
 * mutations unchanged.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingBag } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Colors, Fonts } from '../../constants/theme';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export const MobileOTPScreen = ({ navigation, route }: any) => {
  const { identifier } = route.params || { identifier: '' };
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [errorMsg, setErrorMsg] = useState('');
  const inputs = useRef<TextInput[]>([]);

  const hydrate = useAuthStore((state) => state.hydrate);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const verifyOtpMutation = useMutation({
    mutationFn: authAPI.verifyOtp,
    onSuccess: async (data) => {
      setErrorMsg('');
      if (data?.data?.isLogin) {
        await hydrate();
      } else {
        setErrorMsg('Verification failed. Please try again.');
      }
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Invalid OTP. Please try again.');
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => {
      setTimer(RESEND_SECONDS);
      setErrorMsg('');
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Failed to resend OTP.');
    },
  });

  const handleOtpChange = useCallback(
    (value: string, index: number) => {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < OTP_LENGTH - 1) {
        inputs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (e: any, index: number) => {
      if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    },
    [otp],
  );

  const handleSubmit = () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      setErrorMsg(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setErrorMsg('');
    verifyOtpMutation.mutate({ identifier, otp: code });
  };

  const handleResend = () => {
    if (timer > 0) return;
    resendOtpMutation.mutate({ phone: identifier });
  };

  const formattedPhone = identifier.startsWith('+91')
    ? identifier
    : `+91${identifier}`;

  const isComplete = otp.join('').length === OTP_LENGTH;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Hero — matches MobileLoginScreen's gradient frame ── */}
      <LinearGradient colors={[Colors.navy, '#1E3A8A', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={styles.hero}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={[styles.backBtn, { top: insets.top + 8 }]}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <ShoppingBag size={26} color="#fff" />
        </View>
        <Text style={styles.appName}>Chingiringi</Text>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.heading}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit code to
        </Text>
        <Text style={styles.phoneText}>{formattedPhone}</Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref: any) => (inputs.current[i] = ref)}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : styles.otpBoxEmpty,
              ]}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(v) => handleOtpChange(v, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {/* Resend timer */}
        <TouchableOpacity onPress={handleResend} disabled={timer > 0}>
          <Text style={styles.resendText}>
            {timer > 0 ? (
              <>Didn't receive it? <Text style={styles.resendTextMuted}>Resend OTP in {timer}s</Text></>
            ) : (
              <>Didn't receive it? <Text style={styles.resendTextLink}>Resend OTP</Text></>
            )}
          </Text>
        </TouchableOpacity>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!isComplete || verifyOtpMutation.isPending) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isComplete || verifyOtpMutation.isPending}
          activeOpacity={0.9}
        >
          {verifyOtpMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Verify &amp; Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  hero: {
    paddingTop: 56,
    paddingBottom: 26,
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute', left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  appName: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 28,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  otpBoxEmpty: {
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight10,
  },
  resendText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  resendTextMuted: { fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  resendTextLink: { fontFamily: Fonts.bold, color: Colors.primary, textDecorationLine: 'underline' },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
});
