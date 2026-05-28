import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export const MobileOTPScreen = ({ navigation, route }: any) => {
  const { identifier } = route.params || { identifier: '' };
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Shared blue-gradient header (also used by ForgotPassword,
          ResetPassword, Signup, etc — see src/components/MobileAuthHeader). */}
      <MobileAuthHeader
        title="OTP Verification"
        subtitle={formattedPhone}
        onBack={() => navigation.goBack()}
      />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          We have sent a verification code to
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
                digit ? styles.otpBoxFilled : null,
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
            {timer > 0
              ? `Resend OTP in ${timer}`
              : 'Resend OTP'}
          </Text>
        </TouchableOpacity>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {/* Submit */}
        <Button
          title="Submit"
          onPress={handleSubmit}
          style={styles.submitBtn}
          loading={verifyOtpMutation.isPending}
          disabled={
            otp.join('').length < OTP_LENGTH || verifyOtpMutation.isPending
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  phoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
  },
  otpBox: {
    width: 58,
    height: 58,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: '#F5F8FF',
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  submitBtn: {
    width: '100%',
    marginTop: 8,
    borderRadius: 10,
    height: 52,
  },
});
