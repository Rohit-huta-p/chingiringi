import React, { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthField, AuthCTA, AuthCodeInput, AuthLink, AuthLinkRow, AuthError, AuthNotice, PasswordToggle,
  authErrorMessage, useCountdown, EMAIL_RE, RESEND_SECONDS,
} from '../../components/AuthParts';
import { authBack, goToAuthScreen } from './authNavigation';

// Password reset step 2 of 2: the emailed code + the new password, submitted
// together to /auth/reset-password (which checks the code itself).
//
// Don't route the code through /auth/verify-otp first: for an existing account
// that endpoint signs the user in and deletes the code, so the reset that
// follows fails with "OTP not found or expired".
export const ResetPasswordScreen = ({ navigation, route }: any) => {
  const email = String(route?.params?.email ?? route?.params?.identifier ?? '').trim();

  const [code, setCode] = useState(String(route?.params?.otp ?? '').replace(/\D/g, '').slice(0, 6));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const { remaining, start: startCooldown } = useCountdown(RESEND_SECONDS);

  useEffect(() => {
    // No email (e.g. a bare /reset-password URL): start from the first step.
    if (!EMAIL_RE.test(email)) navigation.replace('ForgotPassword');
    else startCooldown(); // a code was just sent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMut = useMutation({
    mutationFn: authAPI.resetPassword,
    onSuccess: () => goToAuthScreen(navigation, 'Login', { notice: 'Password updated. Sign in with your new password.' }),
    onError: (e: any) => setError(authErrorMessage(e, 'Could not update your password. Please try again.')),
  });

  const resendMut = useMutation({
    mutationFn: authAPI.forgotPassword,
    onSuccess: () => { setError(''); setCode(''); setInfo('We sent you a new code.'); startCooldown(); },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not resend the code. Try again.')),
  });

  const submit = () => {
    if (code.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError(''); setInfo('');
    resetMut.mutate({ email, otp: code, newPassword: password });
  };

  return (
    <AuthScaffold
      mode="login"
      hideChrome
      compact
      onBack={() => authBack(navigation, 'ForgotPassword')}
      heading="Set a new password"
      subheading={`If there's an account for ${email}, we've emailed it a 6-digit code. Enter it with your new password.`}
    >
      <AuthCodeInput
        value={code}
        onChangeText={(t) => { setCode(t); if (error) setError(''); }}
        onComplete={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="New password"
        icon={Lock}
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        right={<PasswordToggle visible={showPw} onToggle={() => setShowPw((v) => !v)} />}
      />
      <AuthField
        ref={confirmRef}
        label="Confirm new password"
        icon={Lock}
        placeholder="Type it again"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {info ? <AuthNotice text={info} /> : null}
      <AuthError text={error} />
      <AuthCTA label="Update password" onPress={submit} loading={resetMut.isPending} />
      <AuthLinkRow>
        <AuthLink label="Use a different email" onPress={() => authBack(navigation, 'ForgotPassword')} />
        <AuthLink
          label={resendMut.isPending ? 'Sending…' : remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}
          onPress={() => resendMut.mutate({ email })}
          disabled={resendMut.isPending || remaining > 0}
        />
      </AuthLinkRow>
    </AuthScaffold>
  );
};
