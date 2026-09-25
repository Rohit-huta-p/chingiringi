import React, { useState } from 'react';
import { Phone } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthField, AuthCTA, AuthLink, AuthError, AuthTerms, authErrorMessage, normalizeIndianMobile,
} from '../../components/AuthParts';
import { goToAuthScreen } from './authNavigation';

// Passwordless phone sign-in / sign-up — step 1 of 2. Sends an SMS code
// (MSG91), then OTPVerification verifies it; the backend creates the account
// on first verify. The identifier passed forward is the raw 10-digit string
// the backend stores and verifies against (authService.verifyUserOTP).
export const PhoneAuthScreen = ({ navigation, route }: any) => {
  const mode: 'login' | 'signup' = route?.params?.mode === 'signup' ? 'signup' : 'login';
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setError);

  const sendMut = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: (_data, vars) => {
      setError('');
      navigation.navigate('OTPVerification', { identifier: vars.phone, channel: 'phone' });
    },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not send the code. Please try again.')),
  });

  const submit = () => {
    const digits = normalizeIndianMobile(phone);
    if (digits.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setError('');
    sendMut.mutate({ phone: digits });
  };

  const emailScreen = mode === 'signup' ? 'Signup' : 'Login';

  return (
    <AuthScaffold
      mode={mode}
      heading={mode === 'signup' ? 'Sign up with phone' : 'Sign in with phone'}
      subheading="Sign in or create an account with just your mobile number."
      onSwitch={() => goToAuthScreen(navigation, mode === 'signup' ? 'Login' : 'Signup')}
      onGoogle={googleSignIn}
      googleLoading={googleLoading}
      footer={<AuthTerms verb="continuing" />}
    >
      <AuthField
        label="Mobile number"
        icon={Phone}
        prefix="+91"
        placeholder="10-digit mobile number"
        hint="We'll text you a 6-digit code. No password needed."
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={15}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <AuthLink label="Use email & password instead" align="right" onPress={() => goToAuthScreen(navigation, emailScreen)} />
      <AuthError text={error} />
      <AuthCTA label="Send code" onPress={submit} loading={sendMut.isPending} />
    </AuthScaffold>
  );
};
