import React, { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Mail, Lock } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthField, AuthCTA, AuthLink, AuthError, AuthNotice, AuthTerms, PasswordToggle,
  authErrorMessage, EMAIL_RE,
} from '../../components/AuthParts';
import { goToAuthScreen } from './authNavigation';

// Email + password sign-in — one screen for every platform. AuthScaffold picks
// the hero-band layout on phones and the split card on desktop web.
export const LoginScreen = ({ navigation, route }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const notice: string | undefined = route?.params?.notice; // e.g. after a password reset

  // Guest stacks (AuthLogin route) close once signed in. Under AuthNavigator
  // the root swaps navigators on its own.
  useEffect(() => {
    if (user && navigation.canGoBack()) navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loginMut = useMutation({
    mutationFn: authAPI.login,
    onSuccess: async () => { setError(''); await hydrate(); },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not sign you in. Please try again.')),
  });
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setError);

  const submit = () => {
    const id = email.trim();
    if (!id || !password) { setError('Enter your email and password.'); return; }
    if (!EMAIL_RE.test(id)) { setError('Enter a valid email address.'); return; }
    setError('');
    loginMut.mutate({ identifier: id, password });
  };

  return (
    <AuthScaffold
      mode="login"
      heading="Welcome back"
      subheading="Sign in to continue earning cashback."
      onSwitch={() => goToAuthScreen(navigation, 'Signup')}
      onGoogle={googleSignIn}
      googleLoading={googleLoading}
      onPhone={() => navigation.navigate('PhoneLogin', { mode: 'login' })}
      footer={<AuthTerms verb="continuing" />}
    >
      {notice ? <AuthNotice text={notice} /> : null}
      <AuthField
        label="Email"
        icon={Mail}
        placeholder="your@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        icon={Lock}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        right={<PasswordToggle visible={showPw} onToggle={() => setShowPw((v) => !v)} />}
      />
      <AuthLink label="Forgot password?" align="right" onPress={() => navigation.navigate('ForgotPassword')} />
      <AuthError text={error} />
      <AuthCTA label="Sign in" onPress={submit} loading={loginMut.isPending} />
    </AuthScaffold>
  );
};
