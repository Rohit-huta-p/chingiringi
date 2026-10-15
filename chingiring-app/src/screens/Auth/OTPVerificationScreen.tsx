import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthCTA, AuthCodeInput, AuthLink, AuthLinkRow, AuthError, AuthNotice,
  authErrorMessage, formatIndianMobile, useCountdown, RESEND_SECONDS,
} from '../../components/AuthParts';
import { authBack } from './authNavigation';

// Phone sign-in step 2 of 2: verify the SMS code. On success the backend
// returns tokens (the interceptor stores them) and hydrate() flips the app
// into the signed-in navigator. Password resets don't come through here —
// ResetPassword takes the emailed code directly.
export const OTPVerificationScreen = ({ navigation, route }: any) => {
  const rawIdentifier = String(route?.params?.identifier ?? '');
  const phone = rawIdentifier.replace(/\D/g, '');
  const hydrate = useAuthStore((s) => s.hydrate);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { remaining, start: startCooldown } = useCountdown(RESEND_SECONDS);

  useEffect(() => {
    // Opened without a usable number (e.g. a bare /otp URL): start over. An
    // email here is an old reset link — send it to the reset screen.
    if (rawIdentifier.includes('@')) navigation.replace('ResetPassword', { email: rawIdentifier });
    else if (phone.length !== 10) navigation.replace('PhoneLogin');
    else startCooldown(); // a code was just sent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyMut = useMutation({
    mutationFn: authAPI.verifyOtp,
    onSuccess: async (res: any) => {
      if (res?.data?.isLogin) { setError(''); await hydrate(); }
      else setError('Could not sign you in. Please try again.');
    },
    onError: (e: any) => {
      setError(authErrorMessage(e, 'That code is invalid or has expired.'));
      setCode('');
    },
  });

  const resendMut = useMutation({
    mutationFn: authAPI.sendOtp,
    onSuccess: () => { setError(''); setInfo('We sent you a new code.'); startCooldown(); },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not resend the code. Try again.')),
  });

  const verify = (value = code) => {
    if (value.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (verifyMut.isPending) return;
    setError(''); setInfo('');
    verifyMut.mutate({ identifier: phone, otp: value });
  };

  const back = () => authBack(navigation, 'PhoneLogin');

  return (
    <AuthScaffold
      mode="login"
      hideChrome
      compact
      onBack={back}
      heading="Verify your phone"
      subheading={`Enter the 6-digit code we sent to ${formatIndianMobile(phone)}.`}
    >
      <AuthCodeInput value={code} onChangeText={(t) => { setCode(t); if (error) setError(''); }} onComplete={verify} />
      {info ? <AuthNotice text={info} /> : null}
      <AuthError text={error} />
      <AuthCTA label="Verify & continue" onPress={() => verify()} loading={verifyMut.isPending} disabled={code.length !== 6} />
      <AuthLinkRow>
        <AuthLink label="Change number" onPress={back} />
        <AuthLink
          label={resendMut.isPending ? 'Sending…' : remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}
          onPress={() => resendMut.mutate({ phone })}
          disabled={resendMut.isPending || remaining > 0}
        />
      </AuthLinkRow>
    </AuthScaffold>
  );
};
