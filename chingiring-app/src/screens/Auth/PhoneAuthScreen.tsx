import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';

// Passwordless phone login/signup — step 1 of 2. Collects a mobile number,
// asks the backend to send an SMS OTP (MSG91), then hands off to the shared
// OTPVerification screen which verifies the code and logs the user in. The
// identifier passed forward is the raw 10-digit string the backend stores and
// verifies against (see authService.verifyUserOTP) — keep it un-formatted.
export const PhoneAuthScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const digits = phone.replace(/\D/g, '');

  const sendMutation = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => {
      setErrorMsg('');
      navigation.navigate('OTPVerification', { identifier: digits, channel: 'phone' });
    },
    onError: (error: any) => {
      setErrorMsg(error?.message || 'Could not send the code. Please try again.');
    },
  });

  const handleContinue = () => {
    setErrorMsg('');
    if (digits.length !== 10) {
      setErrorMsg('Enter a valid 10-digit mobile number.');
      return;
    }
    sendMutation.mutate({ phone: digits });
  };

  const Header = (
    <>
      <View style={styles.iconPill}>
        <View style={styles.iconInner} />
      </View>
      <Text style={styles.title}>Continue with phone</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>We'll text you a 6-digit code to sign in — no password needed.</Text>
  );

  return (
    <AuthLayout
      title={Header}
      subtitle={Subtitle}
      showBackButton
      onBackPress={() => navigation.goBack()}
    >
      <Input
        label="Mobile number"
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        maxLength={15}
      />

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <Button
        title="Send code ->"
        onPress={handleContinue}
        style={styles.mainButton}
        loading={sendMutation.isPending}
        disabled={sendMutation.isPending}
      />
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
    backgroundColor: Colors.primary,
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
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  mainButton: {
    marginTop: 16,
  },
});
