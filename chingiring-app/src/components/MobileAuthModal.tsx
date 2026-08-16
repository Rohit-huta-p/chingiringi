import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, User, AtSign, Phone, Gift, X, MailOpen } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { authAPI } from '../api/auth';
import { profileAPI } from '../api/profile';
import { referralsAPI } from '../api/referrals';
import { useAuthStore } from '../store';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { openMailInbox } from '../lib/openMail';
import { navigationRef } from '../lib/navigationRef';
import { MobileAuthScaffold, AuthField, AuthCTA } from './MobileAuthScaffold';
import type { AuthGateOpts } from '../context/AuthGateContext';

// Mobile guest auth — the whole flow (login / signup / email-OTP verify) inline
// in one full-screen modal, the phone counterpart to DesktopAuthModal. Rendered
// by AuthGateProvider on mobile; completion is modal-driven (onComplete/onCancel).
//
// ponytail: the state machine below mirrors DesktopAuthModal (different layout,
// same logic). If this pair drifts, lift it into a shared useAuthGateFlow hook.

interface Props {
  visible: boolean;
  opts?: AuthGateOpts;
  onComplete: () => void; // authed + done (login / verify / "later") → fire pending action + close
  onCancel: () => void;   // dismissed without authenticating → just close
}

export const MobileAuthModal: React.FC<Props> = ({ visible, onComplete, onCancel }) => {
  // `opts` (contextual title/subtitle) is accepted for parity with DesktopAuthModal;
  // the mobile hero stays the fixed brand statement, so it's not shown here yet.
  const hydrate = useAuthStore((s) => s.hydrate);
  const setShowWelcome = useAuthStore((s) => s.setShowWelcome);
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');

  // Verify step
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const isNewUserRef = useRef(false);

  // Fresh state each time the modal opens.
  useEffect(() => {
    if (visible) { setStep('form'); setError(''); setOtp(''); setOtpErr(''); setOtpInfo(''); }
  }, [visible]);

  // Auto-complete on login / Google success (form step only — the verify step
  // manages its own close so signup can pause on the OTP).
  useEffect(() => {
    if (user && visible && step === 'form') onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // After verify success or "I'll verify later": mark welcome, fire pending action.
  const finish = () => { setShowWelcome(true); onComplete(); };

  const sendOtp = async () => {
    setOtpErr(''); setSending(true);
    try {
      await profileAPI.sendEmailOtp();
      setOtpInfo(`We sent a 6-digit code to ${email}.`);
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || e?.message || 'Could not send the code. Try again.');
    } finally { setSending(false); }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setOtpErr('Enter the 6-digit code.'); return; }
    setOtpErr(''); setVerifying(true);
    try {
      await profileAPI.verifyEmailOtp(otp);
      finish();
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || e?.message || 'Invalid or expired code.');
    } finally { setVerifying(false); }
  };

  const loginMut = useMutation({
    mutationFn: authAPI.login,
    onSuccess: () => { setError(''); hydrate(); }, // useEffect completes on user set
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Invalid credentials'),
  });
  const signupMut = useMutation({
    mutationFn: authAPI.signup,
    onSuccess: async (data: any) => {
      setError('');
      // Apply referral BEFORE hydrate — hydrate()'s claim only confirms a pending referral.
      const code = referralCode.trim();
      if (code) { try { await referralsAPI.apply(code); } catch { /* bad code: ignore */ } }
      if (email.trim()) {
        // Pause on the OTP step. Set step BEFORE hydrate so the auto-complete
        // effect doesn't fire when the user becomes authenticated.
        isNewUserRef.current = !!data?.isNewUser;
        setStep('verify');
        await hydrate();
        sendOtp();
      } else {
        if (data?.isNewUser) setShowWelcome(true);
        await hydrate(); // effect completes on user set (step still 'form')
      }
    },
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Could not create account'),
  });
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn(setError);

  const busy = loginMut.isPending || signupMut.isPending;

  const submit = () => {
    setError('');
    if (mode === 'login') {
      if (!identifier.trim() || !password) { setError('Enter username and password'); return; }
      loginMut.mutate({ identifier: identifier.trim(), password });
    } else {
      if (!name.trim() || !username.trim() || !password) { setError('Fill name, username and password'); return; }
      if (!email && !phone) { setError('Enter an email or phone number'); return; }
      signupMut.mutate({ name: name.trim(), username: username.trim(), email: email || undefined, phone: phone || undefined, password });
    }
  };

  const goForgot = () => { onCancel(); setTimeout(() => navigationRef.navigate('ForgotPassword' as never), 60); };

  const isLogin = mode === 'login';
  const inVerify = step === 'verify';
  const close = inVerify ? finish : onCancel;

  const passwordField = (placeholder: string) => (
    <AuthField
      label="Password" icon={Lock} placeholder={placeholder}
      value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none"
      right={
        <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8}>
          {showPw ? <EyeOff size={16} color="#98a2b3" /> : <Eye size={16} color="#98a2b3" />}
        </TouchableOpacity>
      }
    />
  );

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <TouchableOpacity style={st.close} onPress={close} hitSlop={8} activeOpacity={0.8}>
        <X size={18} color="#fff" strokeWidth={2.4} />
      </TouchableOpacity>

      {inVerify ? (
        <MobileAuthScaffold mode="signup" hideChrome>
          <Text style={st.vHead}>Verify your email</Text>
          <Text style={st.vSub}>{otpInfo || (sending ? 'Sending a code…' : `Enter the 6-digit code sent to ${email}.`)}</Text>
          <TextInput
            style={st.otp}
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor="#94a3b8"
            autoFocus
          />
          {otpErr ? <Text style={st.err}>{otpErr}</Text> : null}
          <AuthCTA label="Verify" onPress={verifyOtp} loading={verifying} />
          <View style={st.vRow}>
            <TouchableOpacity style={st.openMail} onPress={() => openMailInbox(email)} activeOpacity={0.85}>
              <MailOpen size={15} color={Colors.primary} strokeWidth={2} />
              <Text style={st.openMailTxt}>Open mail</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sendOtp} disabled={sending}>
              <Text style={st.link}>{sending ? 'Sending…' : 'Resend code'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={finish} style={st.laterWrap} hitSlop={8}>
            <Text style={st.later}>I'll verify later</Text>
          </TouchableOpacity>
        </MobileAuthScaffold>
      ) : (
        <MobileAuthScaffold
          mode={mode}
          onSwitch={() => { setMode(isLogin ? 'signup' : 'login'); setError(''); }}
          onGoogle={googleSignIn}
          googleLoading={googleLoading}
        >
          {isLogin ? (
            <>
              <AuthField label="Username or email" icon={Mail} placeholder="your username" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} />
              {passwordField('Enter your password')}
              <TouchableOpacity style={st.forgotWrap} onPress={goForgot}>
                <Text style={st.forgot}>Forgot Password?</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <AuthField label="Full name" icon={User} placeholder="Your name" value={name} onChangeText={setName} />
              <AuthField label="Username" icon={AtSign} placeholder="Your username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
              <AuthField label="Email" icon={Mail} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <AuthField label="Phone (optional if email given)" icon={Phone} placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              {passwordField('At least 6 characters')}
              <AuthField label="Referral code (optional)" icon={Gift} placeholder="e.g. A1B2C3D4" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
            </>
          )}
          {error ? <Text style={st.err}>{error}</Text> : null}
          <AuthCTA label={isLogin ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        </MobileAuthScaffold>
      )}
    </Modal>
  );
};

const st = StyleSheet.create({
  close: { position: 'absolute', top: 44, right: 18, zIndex: 10, width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  vHead: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.text, letterSpacing: -0.3 },
  vSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 6, lineHeight: 19, marginBottom: 16 },
  otp: { height: 54, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, textAlign: 'center', fontSize: 24, letterSpacing: 10, fontFamily: Fonts.bold, color: Colors.text, backgroundColor: '#f8fafc', marginBottom: 12 },
  err: { color: '#ef4444', fontSize: 12.5, fontFamily: Fonts.medium, marginTop: 2, marginBottom: 6 },
  vRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  openMail: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  openMailTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  link: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  laterWrap: { alignItems: 'center', marginTop: 16 },
  later: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 6 },
  forgot: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary },
});

export default MobileAuthModal;
