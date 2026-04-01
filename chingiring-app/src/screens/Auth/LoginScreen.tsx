import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';

export const LoginScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  const hydrate = useAuthStore((state) => state.hydrate);

  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => {
      // API call sets the HTTP-Only cookie, we instantly fetch the profile to hydrate state
      await hydrate();
    },
    onError: (error: any) => {
      // Basic alert handling or UI state
      console.warn('Login Error:', error.message);
    }
  });

  const sendOtpMutation = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => {
      navigation.navigate('OTPVerification', { identifier: phone });
    },
    onError: (error: any) => {
      console.warn('OTP Error:', error.message);
    }
  });

  const handleLogin = () => {
    if (tab === 'password') {
      loginMutation.mutate({ identifier, password });
    } else {
      sendOtpMutation.mutate({ phone });
    }
  };

  const Header = (
    <>
      <View style={styles.logoPlaceholder} />
      <Text style={styles.title}>Welcome back</Text>
    </>
  );

  const Subtitle = (
    <Text style={styles.subtitle}>Sign in to continue earning cashback</Text>
  );

  return (
    <AuthLayout title={Header} subtitle={Subtitle}>
      <View style={styles.tabsContainer}>
        <Button 
          title="Username / Password" 
          variant={tab === 'password' ? 'pillActive' : 'pillInactive'} 
          onPress={() => setTab('password')}
          style={{ flex: 1, marginRight: 4, backgroundColor: tab === 'password' ? Colors.surface : '#f3f4f6' }}
          textStyle={{ color: Colors.text, fontWeight: tab === 'password' ? '700' : '500' }}
        />
        <Button 
          title="OTP Login" 
          variant={tab === 'otp' ? 'pillActive' : 'pillInactive'} 
          onPress={() => setTab('otp')}
          style={{ flex: 1, marginLeft: 4, backgroundColor: tab === 'otp' ? Colors.surface : '#f3f4f6' }}
          textStyle={{ color: Colors.text, fontWeight: tab === 'otp' ? '700' : '500' }}
        />
      </View>

      {tab === 'password' ? (
        <>
          <Input 
            label="Username or Email" 
            placeholder="your username" 
            value={identifier}
            onChangeText={setIdentifier}
          />
          <Input 
            label="Password" 
            placeholder="Enter your password" 
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
          />
          <View style={styles.forgotContainer}>
            <Button 
              title="Forgot Password?" 
              variant="text" 
              onPress={() => navigation.navigate('ForgotPassword')} 
              textStyle={styles.forgotText}
            />
          </View>
        </>
      ) : (
        <>
          <Input 
            label="Phone Number" 
            placeholder="Enter 10-digit mobile number" 
            keyboardType="phone-pad" 
            value={phone}
            onChangeText={setPhone}
          />
        </>
      )}

      <Button 
        title={tab === 'password' ? 'Sign In ->' : 'Send OTP ->'} 
        onPress={handleLogin} 
        style={styles.mainButton} 
        loading={loginMutation.isPending || sendOtpMutation.isPending}
        disabled={loginMutation.isPending || sendOtpMutation.isPending}
      />

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>

      <Button title="Continue with Google" variant="outline" onPress={() => {}} style={styles.googleButton} />
      
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Button title="Sign up" variant="text" onPress={() => navigation.navigate('Signup')} textStyle={styles.signupText} />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mainButton: {
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#94a3b8',
    fontSize: 12,
  },
  googleButton: {
    marginBottom: 24,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  signupText: {
    fontWeight: '700',
  },
});
