import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';

export const ResetPasswordScreen = ({ navigation, route }: any) => {
  const { identifier, otp } = route.params || { identifier: '', otp: '' };
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetMutation = useMutation({
    mutationFn: authAPI.resetPassword,
    onSuccess: () => {
      navigation.navigate('Login');
    },
    onError: (error: any) => {
      console.warn('Reset Error:', error.message);
    }
  });

  const handleReset = () => {
    if (password !== confirmPassword) {
      console.warn('Passwords do not match');
      return;
    }
    resetMutation.mutate({ email: identifier, otp, newPassword: password });
  };

  const Header = (
    <>
      <View style={styles.iconPill}>
        {/* Placeholder for email icon */}
        <View style={styles.iconInner} />
      </View>
      <Text style={styles.title}>Update Password</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>Enter your email to receive a password reset OTP</Text> // Using text from forgot screen per design standard, or a custom one
  );

  return (
    <AuthLayout 
      title={Header} 
      subtitle={Subtitle}
      showBackButton
      onBackPress={() => navigation.goBack()}
    >
      <Text style={styles.inputLabel}>Set New Password</Text>
      <Input placeholder="New Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Input placeholder="Re-type New Password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

      <Button 
        title="Reset ->" 
        onPress={handleReset} 
        style={styles.mainButton} 
        loading={resetMutation.isPending}
        disabled={resetMutation.isPending || !password}
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  mainButton: {
    marginTop: 16,
  },
});
