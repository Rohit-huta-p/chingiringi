import React, { useState } from 'react';
import { Mail } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthField, AuthCTA, AuthLink, AuthError, authErrorMessage, EMAIL_RE,
} from '../../components/AuthParts';
import { authBack, goToAuthScreen } from './authNavigation';

// Password reset step 1 of 2: email a 6-digit reset code. The backend answers
// the same whether or not the account exists (no email enumeration).
export const ForgotPasswordScreen = ({ navigation, route }: any) => {
  const [email, setEmail] = useState(String(route?.params?.email ?? ''));
  const [error, setError] = useState('');

  const forgotMut = useMutation({
    mutationFn: authAPI.forgotPassword,
    onSuccess: (_data, vars) => {
      setError('');
      navigation.navigate('ResetPassword', { email: vars.email });
    },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not send the reset code. Please try again.')),
  });

  const submit = () => {
    const em = email.trim();
    if (!EMAIL_RE.test(em)) { setError('Enter the email address you signed up with.'); return; }
    setError('');
    forgotMut.mutate({ email: em });
  };

  return (
    <AuthScaffold
      mode="login"
      hideChrome
      compact
      onBack={() => authBack(navigation)}
      heading="Forgot your password?"
      subheading="Enter the email you signed up with and we'll send you a 6-digit code to reset it."
    >
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
        autoFocus
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <AuthError text={error} />
      <AuthCTA label="Send reset code" onPress={submit} loading={forgotMut.isPending} />
      <AuthLink label="Back to sign in" align="center" onPress={() => goToAuthScreen(navigation, 'Login')} />
    </AuthScaffold>
  );
};
