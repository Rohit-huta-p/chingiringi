import React, { useEffect, useRef, useState } from 'react';
import { User, Mail, Phone, Lock, Gift } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth';
import { profileAPI } from '../../api/profile';
import { referralsAPI } from '../../api/referrals';
import { useAuthStore } from '../../store';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { REFEREE_REWARD_LABEL } from '../../constants/referral';
import { AuthScaffold } from '../../components/AuthScaffold';
import {
  AuthField, AuthCTA, AuthCodeInput, AuthLink, AuthLinkRow, AuthError, AuthNotice, AuthTerms,
  OpenMailButton, PasswordToggle, authErrorMessage, normalizeIndianMobile, useCountdown,
  EMAIL_RE, RESEND_SECONDS,
} from '../../components/AuthParts';
import { goToAuthScreen } from './authNavigation';

// Create account — one screen for every platform (hero band on phones, split
// card on desktop). With an email, it then pauses on an inline email-code step.
export const SignupScreen = ({ navigation, route }: any) => {
  const hydrate = useAuthStore((s) => s.hydrate);
  const setShowWelcome = useAuthStore((s) => s.setShowWelcome);
  const user = useAuthStore((s) => s.user);
  // Invite code stashed from a referral link (lib/referralCapture). Web invite
  // links land on `/?ref=CODE`, so the code is rarely in this route's params.
  const pendingRef = useAuthStore((s) => s.pendingReferralCode);

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [referralCode, setReferralCode] = useState(String(route?.params?.ref ?? pendingRef ?? ''));
  const [error, setError] = useState('');
  const isNewUserRef = useRef(false);

  // Email-code step
  const [code, setCode] = useState('');
  const [codeInfo, setCodeInfo] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { remaining, start: startCooldown } = useCountdown(RESEND_SECONDS);

  // The stash restores asynchronously at launch; fill the field if it lands later.
  useEffect(() => {
    if (pendingRef && !referralCode) setReferralCode(pendingRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRef]);

  useEffect(() => {
    if (user && navigation.canGoBack()) navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const referred = !!(route?.params?.ref || pendingRef) && !!referralCode.trim();

  const sendCode = async () => {
    setCodeErr(''); setSending(true);
    try {
      await profileAPI.sendEmailOtp();
      setCodeInfo(`We sent a 6-digit code to ${email.trim()}.`);
      startCooldown();
    } catch (e: any) {
      setCodeErr(authErrorMessage(e, 'Could not send the code. Try again.'));
    } finally {
      setSending(false);
    }
  };

  // Verified or "later": mark the welcome, then hydrate — `user` flips truthy
  // and the root swaps to the signed-in app.
  const finish = async () => {
    if (isNewUserRef.current) setShowWelcome(true);
    await hydrate();
  };

  const verifyCode = async (value = code) => {
    if (value.length !== 6) { setCodeErr('Enter the 6-digit code.'); return; }
    if (verifying) return;
    setCodeErr(''); setVerifying(true);
    try {
      await profileAPI.verifyEmailOtp(value);
      await finish();
    } catch (e: any) {
      setCodeErr(authErrorMessage(e, 'That code is invalid or has expired.'));
      setVerifying(false);
    }
  };

  const signupMut = useMutation({
    mutationFn: authAPI.signup,
    onSuccess: async (data: any) => {
      setError('');
      // Apply the referral BEFORE hydrate — hydrate()'s native claim() can
      // only confirm a referral that's already pending.
      const ref = referralCode.trim();
      if (ref) {
        try { await referralsAPI.apply(ref); } catch { /* bad code: ignore, signup still succeeds */ }
        useAuthStore.getState().clearPendingReferral();
      }
      isNewUserRef.current = !!data?.isNewUser;
      if (email.trim()) {
        // Pause on the email-code step. Do NOT hydrate yet: the root swaps
        // navigators the instant `user` is set. The token from signup is
        // already stored, so the code endpoints are authorized.
        setStep('verify');
        sendCode();
      } else {
        await finish();
      }
    },
    onError: (e: any) => setError(authErrorMessage(e, 'Could not create your account. Please try again.')),
  });
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setError);

  const submit = () => {
    const n = name.trim();
    const em = email.trim();
    const ph = normalizeIndianMobile(phone);
    if (!n) { setError('Enter your name.'); return; }
    if (!em && !ph) { setError('Enter an email or a mobile number.'); return; }
    if (em && !EMAIL_RE.test(em)) { setError('Enter a valid email address.'); return; }
    if (phone.trim() && ph.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    signupMut.mutate({ name: n, email: em || undefined, phone: ph || undefined, password });
  };

  if (step === 'verify') {
    return (
      <AuthScaffold
        mode="signup"
        hideChrome
        compact
        heading="Verify your email"
        subheading={codeInfo || (sending ? 'Sending a code…' : `Enter the 6-digit code sent to ${email.trim()}.`)}
      >
        <AuthCodeInput value={code} onChangeText={(t) => { setCode(t); if (codeErr) setCodeErr(''); }} onComplete={verifyCode} />
        <AuthError text={codeErr} />
        <AuthCTA label="Verify email" onPress={() => verifyCode()} loading={verifying} disabled={code.length !== 6} />
        <AuthLinkRow>
          <OpenMailButton email={email.trim()} />
          <AuthLink
            label={sending ? 'Sending…' : remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}
            onPress={sendCode}
            disabled={sending || remaining > 0}
          />
        </AuthLinkRow>
        <AuthLink label="I'll verify later" align="center" muted onPress={finish} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      mode="signup"
      heading="Create your account"
      subheading="Start earning cashback in minutes."
      onSwitch={() => goToAuthScreen(navigation, 'Login')}
      onGoogle={googleSignIn}
      googleLoading={googleLoading}
      onPhone={() => navigation.navigate('PhoneLogin', { mode: 'signup' })}
      footer={<AuthTerms verb="signing up" />}
    >
      {referred ? (
        <AuthNotice tone="referral" text={`You've been invited. Create your account to claim ${REFEREE_REWARD_LABEL}.`} />
      ) : null}
      <AuthField
        label="Full name"
        icon={User}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
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
      />
      <AuthField
        label="Phone (optional if email given)"
        icon={Phone}
        prefix="+91"
        placeholder="10-digit mobile number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={15}
      />
      <AuthField
        label="Password"
        icon={Lock}
        placeholder="At least 6 characters"
        desktopPlaceholder="Create a password (6+ characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        right={<PasswordToggle visible={showPw} onToggle={() => setShowPw((v) => !v)} />}
      />
      <AuthField
        label="Referral code (optional)"
        icon={Gift}
        placeholder="e.g. A1B2C3D4"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <AuthError text={error} />
      <AuthCTA label="Create account" onPress={submit} loading={signupMut.isPending} />
    </AuthScaffold>
  );
};
