import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');

  const forgotMutation = useMutation({
    mutationFn: authAPI.forgotPassword,
    onSuccess: () => {
      navigation.navigate('OTPVerification', { identifier: email });
    },
    onError: (error: any) => {
      console.warn('Forgot Password Error:', error.message);
    }
  });

  const handleForgot = () => {
    forgotMutation.mutate({ email });
  };

  const Header = (
    <>
      <View style={styles.iconPill}>
        {/* Placeholder for email icon */}
        <View style={styles.iconInner} />
      </View>
      <Text style={styles.title}>Forgot Password?</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>Enter your email to receive a password reset OTP</Text>
  );

  return (
    <AuthLayout 
      title={Header} 
      subtitle={Subtitle}
      showBackButton
      onBackPress={() => navigation.goBack()}
    >
      <Text style={styles.inputLabel}>Email Address</Text>
      <Input placeholder="your@email.com" keyboardType="email-address" value={email} onChangeText={setEmail} />

      <Button 
        title="Send OTP ->" 
        onPress={handleForgot} 
        style={styles.mainButton} 
        loading={forgotMutation.isPending}
        disabled={forgotMutation.isPending}
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  mainButton: {
    marginTop: 16,
  },
});
