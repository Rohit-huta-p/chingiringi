import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Colors, Fonts } from '../../constants/theme';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { MobileAuthScaffold, AuthField, AuthCTA } from '../../components/MobileAuthScaffold';

export const MobileLoginScreen = ({ navigation }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  // Auto-dismiss when user transitions null → truthy (Google, OTP, any async path).
  useEffect(() => {
    if (user && navigation.canGoBack()) navigation.goBack();
  }, [user]);

  const [identifier, setIdentifier] = useState('');   // username or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => {
      setErrorMsg('');
      await hydrate();
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Invalid credentials');
    },
  });

  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setErrorMsg);

  const handleSignIn = () => {
    setErrorMsg('');
    if (!identifier.trim() || !password) {
      setErrorMsg('Enter username and password');
      return;
    }
    loginMutation.mutate({ identifier: identifier.trim(), password });
  };

  // Toggle → signup. Route is 'AuthSignup' in the guest stack, 'Signup' under AuthNavigator.
  const goSignup = () => {
    const names = navigation.getState()?.routeNames ?? [];
    navigation.navigate((names.includes('AuthSignup') ? 'AuthSignup' : 'Signup') as never);
  };

  return (
    <MobileAuthScaffold
      mode="login"
      onSwitch={goSignup}
      onGoogle={googleSignIn}
      googleLoading={googleLoading}
      footer={
        <Text style={st.terms}>
          By continuing, you agree to our <Text style={st.termsLink}>Terms of Service</Text>
          {' & '}<Text style={st.termsLink}>Privacy Policy</Text>
        </Text>
      }
    >
      <AuthField
        label="Username"
        icon={Mail}
        placeholder="your username"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AuthField
        label="Password"
        icon={Lock}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        right={
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            {showPassword ? <EyeOff size={16} color="#98a2b3" /> : <Eye size={16} color="#98a2b3" />}
          </TouchableOpacity>
        }
      />

      <TouchableOpacity style={st.forgotWrap} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={st.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      {errorMsg ? <Text style={st.errorText}>{errorMsg}</Text> : null}

      <AuthCTA label="Sign in" onPress={handleSignIn} loading={loginMutation.isPending} />
    </MobileAuthScaffold>
  );
};

const st = StyleSheet.create({
  forgotWrap: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14 },
  forgotText: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary },
  errorText: { color: '#ef4444', fontSize: 13, fontFamily: Fonts.semiBold, textAlign: 'center', marginBottom: 8 },
  terms: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', textAlign: 'center', marginTop: 20, lineHeight: 16 },
  termsLink: { color: '#64748b', fontFamily: Fonts.semiBold, textDecorationLine: 'underline' },
});
