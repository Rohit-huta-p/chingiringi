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
} from 'react-native';
import { Button } from '../../components/Button';
import { ProductGridBackground } from '../../components/ProductGridBackground';
import { Colors } from '../../constants/theme';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';

const logo = require('../../../assets/icon.png');

export const MobileLoginScreen = ({ navigation }: any) => {
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const sendOtpMutation = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => {
      setErrorMsg('');
      navigation.navigate('OTPVerification', { identifier: phone });
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Failed to send OTP.');
    },
  });

  const handleContinue = () => {
    setErrorMsg('');
    if (phone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    sendOtpMutation.mutate({ phone });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ProductGridBackground />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top link to password login */}
        <TouchableOpacity
          style={styles.topLink}
          onPress={() => navigation.navigate('PasswordLogin')}
        >
          <Text style={styles.topLinkText}>Username / Password</Text>
        </TouchableOpacity>

        {/* Spacer to push content down behind grid */}
        <View style={styles.spacer} />

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>
          Indian's largest passive{'\n'}income earning ecosystem
        </Text>

        {/* Phone input */}
        <View style={styles.phoneRow}>
          <Text style={styles.countryCode}>+91</Text>
          <TextInput
            style={styles.phoneInput}
            placeholder="Enter mobile number"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        {/* Continue button */}
        <Button
          title="Continue"
          onPress={handleContinue}
          style={styles.continueBtn}
          loading={sendOtpMutation.isPending}
          disabled={sendOtpMutation.isPending}
        />

        {/* Terms footer */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {'  '}& {'  '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4fa',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  topLink: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  topLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  spacer: {
    flex: 1,
    minHeight: 80,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  tagline: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 28,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 8,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    height: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  continueBtn: {
    marginTop: 8,
    borderRadius: 10,
    height: 52,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
