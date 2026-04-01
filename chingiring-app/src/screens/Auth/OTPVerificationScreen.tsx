import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';

export const OTPVerificationScreen = ({ navigation, route }: any) => {
  const { identifier } = route.params || { identifier: 'Unknown' };
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<TextInput[]>([]);
  
  const hydrate = useAuthStore((state) => state.hydrate);

  const verifyOtpMutation = useMutation({
    mutationFn: authAPI.verifyOtp,
    onSuccess: async (data, variables) => {
      // If server returns isLogin it means cookies were injected
      if (data?.data?.isLogin) {
        await hydrate();
      } else {
        // If no login intent, it's a password reset flow
        navigation.navigate('ResetPassword', { identifier, otp: otp.join('') });
      }
    },
    onError: (error: any) => {
      console.warn('Verify OTP Error:', error.message);
    }
  });

  const handleVerify = () => {
    verifyOtpMutation.mutate({ identifier, otp: otp.join('') });
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // move focus
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const Header = (
    <>
      <View style={styles.iconPill}>
        {/* Placeholder for phone icon */}
        <View style={styles.iconInner} />
      </View>
      <Text style={styles.title}>Verify OTP</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>We sent a 6-digit code to <Text style={styles.strong}>{identifier}</Text></Text>
  );

  return (
    <AuthLayout 
      title={Header} 
      subtitle={Subtitle}
      showBackButton
      onBackPress={() => navigation.goBack()}
    >
      <View style={styles.floatingInput}>
        <Text style={styles.floatingInputText}>Enter any 6 digits to continue</Text>
      </View>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref: any) => inputs.current[index] = ref}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(v: string) => handleOtpChange(v, index)}
            onKeyPress={(e: any) => handleKeyPress(e, index)}
          />
        ))}
      </View>

      <Text style={styles.resendText}>
        Resend OTP in <Text style={styles.strongText}>27s</Text>
      </Text>

      <Button 
        title="Verify & Continue ->" 
        onPress={handleVerify} 
        style={styles.mainButton} 
        disabled={otp.join('').length < 6 || verifyOtpMutation.isPending} 
        loading={verifyOtpMutation.isPending}
      />

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Didn't receive the code? </Text>
        <Button title="Try another method" variant="text" onPress={() => {}} />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  iconPill: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconInner: {
    width: 20,
    height: 20,
    backgroundColor: Colors.primary, // Placeholder for actual icon vector
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  strong: {
    color: Colors.text,
    fontWeight: '700',
  },
  floatingInput: {
    backgroundColor: '#faf5ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  floatingInputText: {
    color: '#9333ea',
    fontWeight: '600',
    fontSize: 13,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  resendText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  strongText: {
    fontWeight: '700',
    color: Colors.text,
  },
  mainButton: {
    marginBottom: 24,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
