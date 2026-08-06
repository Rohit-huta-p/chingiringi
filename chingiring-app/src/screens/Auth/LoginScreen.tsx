import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthLayout } from './AuthLayout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';

export const LoginScreen = ({ navigation }: any) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hydrate = useAuthStore((state) => state.hydrate);

  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => {
      setErrorMsg('');
      await hydrate();
    },
    onError: (error: any) => {
      setErrorMsg(error.message || 'Login failed. Please try again.');
    }
  });

  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setErrorMsg);

  const handleLogin = () => {
    setErrorMsg('');
    loginMutation.mutate({ identifier, password });
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

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <Button
        title="Sign In ->"
        onPress={handleLogin}
        style={styles.mainButton}
        loading={loginMutation.isPending}
        disabled={loginMutation.isPending}
      />

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>

      <Button
        title="Continue with Google"
        variant="outline"
        onPress={googleSignIn}
        loading={googleLoading}
        disabled={googleLoading}
        style={styles.googleButton}
      />

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
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
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
