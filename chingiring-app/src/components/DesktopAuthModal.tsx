import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Pressable, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, User, AtSign, Phone, X, ArrowRight, MailOpen } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { authAPI } from '../api/auth';
import { profileAPI } from '../api/profile';
import { useAuthStore } from '../store';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import type { AuthGateOpts } from '../context/AuthGateContext';

// Desktop split-screen auth. Editorial image on the left, login/signup form on
// the right with a Sign-in / Create-account toggle — replaces the /login and
// /signup route hop on desktop. Rendered by AuthGateProvider (web ≥768 only).
// After signup (if an email was given) it stays open on an email-OTP step.
//
// To use a real photo on the left, replace the "photo" <LinearGradient> with:
//   <Image source={require('../../assets/auth-hero.jpg')}
//          style={StyleSheet.absoluteFill} resizeMode="cover" />

// Best-effort "open the inbox" for common providers; falls back to the OS mail app.
const MAIL_INBOX: Record<string, string> = {
  'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'outlook.com': 'https://outlook.live.com/mail/0/inbox',
  'hotmail.com': 'https://outlook.live.com/mail/0/inbox',
  'live.com': 'https://outlook.live.com/mail/0/inbox',
  'yahoo.com': 'https://mail.yahoo.com/',
  'icloud.com': 'https://www.icloud.com/mail',
  'proton.me': 'https://mail.proton.me/u/0/inbox',
  'protonmail.com': 'https://mail.proton.me/u/0/inbox',
};

interface Props {
  visible: boolean;
  opts?: AuthGateOpts;
  onComplete: () => void; // authed + done (login / verify / "later") → fire the pending action + close
  onCancel: () => void;   // dismissed without authenticating → just close
}

const GoogleG = () => (
  <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: Fonts.extraBold, fontSize: 13, color: '#4285F4' }}>G</Text>
  </View>
);

const Field = ({ icon: Icon, ...props }: any) => (
  <View style={st.field}>
    <Icon size={16} color="#9AA6B8" />
    <TextInput style={st.input} placeholderTextColor="#9AA6B8" {...props} />
  </View>
);

export const DesktopAuthModal: React.FC<Props> = ({ visible, opts, onComplete, onCancel }) => {
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
  const [error, setError] = useState('');

  // Verify step
  const [otp, setOtp] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Auto-close on login / Google success (only from the form step — the verify
  // step manages its own closing so signup can pause here for the OTP).
  useEffect(() => {
    if (user && visible && step === 'form') onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Signup completion — after verify success or "Later". Marks a new user for
  // the welcome modal, then fires the pending gated action.
  const finish = () => { setShowWelcome(true); onComplete(); };

  const sendOtp = async () => {
    setOtpErr(''); setSending(true);
    try {
      await profileAPI.sendEmailOtp();
      setOtpInfo(`We sent a 6-digit code to ${email}.`);
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || e?.message || 'Could not send the code. Try again.');
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setOtpErr('Enter the 6-digit code.'); return; }
    setOtpErr(''); setVerifying(true);
    try {
      await profileAPI.verifyEmailOtp(otp);
      finish();
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || e?.message || 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  const openMail = () => {
    const domain = (email.split('@')[1] || '').toLowerCase();
    Linking.openURL(MAIL_INBOX[domain] || 'mailto:').catch(() => {});
  };

  const loginMut = useMutation({
    mutationFn: authAPI.login,
    onSuccess: () => { setError(''); hydrate(); }, // useEffect closes on user set
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Invalid credentials'),
  });
  const signupMut = useMutation({
    mutationFn: authAPI.signup,
    onSuccess: async () => {
      setError('');
      if (email.trim()) {
        // Stay open for email verification. Set step BEFORE hydrate so the
        // auto-close effect doesn't fire when the user becomes authenticated.
        setStep('verify');
        await hydrate();
        sendOtp();
      } else {
        // Phone-only signup — nothing to verify.
        setShowWelcome(true);
        await hydrate(); // useEffect closes on user set (step still 'form')
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

  const isLogin = mode === 'login';
  const inVerify = step === 'verify';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={inVerify ? finish : onCancel}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={inVerify ? finish : onCancel} />

        <View style={st.card}>
          <TouchableOpacity style={st.close} onPress={inVerify ? finish : onCancel} hitSlop={8}>
            <X size={16} color="#475569" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* ── Left: editorial image ─────────────────────────────── */}
          <View style={st.left}>
            <LinearGradient colors={['#5B3AA8', '#3A6FC9', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(6,10,20,0.72)']} start={{ x: 0, y: 0.4 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={st.leftLogo}>
              <View style={st.leftLogoTile}><Text style={st.leftLogoTxt}>C</Text></View>
              <Text style={st.leftBrand}>ChingiRingi</Text>
            </View>
            <View style={st.leftCap}>
              <Text style={st.leftEy}>Passive income, simplified</Text>
              <Text style={st.leftH}>Shop. Share. Earn.</Text>
              <Text style={st.leftP}>Join thousands earning cashback and coins on everyday purchases.</Text>
            </View>
          </View>

          {/* ── Right ─────────────────────────────────────────────── */}
          <ScrollView style={st.right} contentContainerStyle={st.rightInner} keyboardShouldPersistTaps="handled">
            {inVerify ? (
              <>
                <Text style={st.fhead}>Verify your email</Text>
                <Text style={st.fsub}>{otpInfo || (sending ? 'Sending a code…' : `Enter the 6-digit code sent to ${email}.`)}</Text>

                <TextInput
                  style={st.otp}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="••••••"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                {otpErr ? <Text style={st.err}>{otpErr}</Text> : null}

                <TouchableOpacity style={[st.cta, (verifying || otp.length !== 6) && { opacity: 0.7 }]} onPress={verifyOtp} disabled={verifying || otp.length !== 6} activeOpacity={0.9}>
                  {verifying ? <ActivityIndicator color="#fff" /> : (
                    <View style={st.ctaRow}><Text style={st.ctaTxt}>Verify</Text><ArrowRight size={17} color="#fff" strokeWidth={2.4} /></View>
                  )}
                </TouchableOpacity>

                <View style={st.vRow}>
                  <TouchableOpacity style={st.openMail} onPress={openMail} activeOpacity={0.85}>
                    <MailOpen size={15} color={Colors.primary} strokeWidth={2} />
                    <Text style={st.openMailTxt}>Open mail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={sendOtp} disabled={sending}>
                    <Text style={st.link}>{sending ? 'Sending…' : 'Resend code'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={st.foot}><Text style={st.footLink} onPress={finish}>I'll verify later</Text></Text>
              </>
            ) : (
              <>
                <Text style={st.fhead}>{isLogin ? (opts?.title ?? 'Welcome back') : 'Create your account'}</Text>
                <Text style={st.fsub}>{isLogin ? (opts?.subtitle ?? 'Sign in to continue earning cashback.') : 'Start earning cashback in minutes.'}</Text>

                <View style={st.seg}>
                  <TouchableOpacity style={[st.segBtn, isLogin && st.segOn]} onPress={() => { setMode('login'); setError(''); }}>
                    <Text style={[st.segTxt, isLogin && st.segTxtOn]}>Sign in</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.segBtn, !isLogin && st.segOn]} onPress={() => { setMode('signup'); setError(''); }}>
                    <Text style={[st.segTxt, !isLogin && st.segTxtOn]}>Create account</Text>
                  </TouchableOpacity>
                </View>

                {isLogin ? (
                  <>
                    <Field icon={Mail} placeholder="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} />
                    <View style={st.field}>
                      <Lock size={16} color="#9AA6B8" />
                      <TextInput style={st.input} placeholder="Enter your password" placeholderTextColor="#9AA6B8" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" />
                      <TouchableOpacity onPress={() => setShowPw((v) => !v)}>{showPw ? <EyeOff size={16} color="#9AA6B8" /> : <Eye size={16} color="#9AA6B8" />}</TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Field icon={User} placeholder="Full name" value={name} onChangeText={setName} />
                    <Field icon={AtSign} placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
                    <Field icon={Mail} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    <Field icon={Phone} placeholder="Phone (optional if email given)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    <View style={st.field}>
                      <Lock size={16} color="#9AA6B8" />
                      <TextInput style={st.input} placeholder="Create a password" placeholderTextColor="#9AA6B8" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" />
                      <TouchableOpacity onPress={() => setShowPw((v) => !v)}>{showPw ? <EyeOff size={16} color="#9AA6B8" /> : <Eye size={16} color="#9AA6B8" />}</TouchableOpacity>
                    </View>
                  </>
                )}

                {error ? <Text style={st.err}>{error}</Text> : null}

                <TouchableOpacity style={[st.cta, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy} activeOpacity={0.9}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <View style={st.ctaRow}><Text style={st.ctaTxt}>{isLogin ? 'Sign in' : 'Create account'}</Text><ArrowRight size={17} color="#fff" strokeWidth={2.4} /></View>
                  )}
                </TouchableOpacity>

                <View style={st.orRow}><View style={st.orLine} /><Text style={st.orTxt}>OR</Text><View style={st.orLine} /></View>

                <TouchableOpacity style={[st.google, googleLoading && { opacity: 0.7 }]} onPress={googleSignIn} disabled={googleLoading} activeOpacity={0.9}>
                  {googleLoading ? <ActivityIndicator color={Colors.primary} /> : <><GoogleG /><Text style={st.googleTxt}>{isLogin ? 'Continue with Google' : 'Sign up with Google'}</Text></>}
                </TouchableOpacity>

                <Text style={st.foot}>
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <Text style={st.footLink} onPress={() => { setMode(isLogin ? 'signup' : 'login'); setError(''); }}>
                    {isLogin ? 'Create one' : 'Sign in'}
                  </Text>
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,22,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { flexDirection: 'row', width: '100%', maxWidth: 860, height: 560, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 30 }, shadowRadius: 60 },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 5, width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },

  left: { flex: 0.44, padding: 32, justifyContent: 'space-between' },
  leftLogo: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  leftLogoTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  leftLogoTxt: { color: '#fff', fontFamily: Fonts.extraBold, fontSize: 16 },
  leftBrand: { color: '#fff', fontFamily: Fonts.bold, fontSize: 15 },
  leftCap: {},
  leftEy: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.4, textTransform: 'uppercase' },
  leftH: { color: '#fff', fontSize: 27, fontFamily: Fonts.extraBold, letterSpacing: -0.5, marginTop: 8 },
  leftP: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: Fonts.regular, marginTop: 8, lineHeight: 18, maxWidth: 240 },

  right: { flex: 0.56 },
  rightInner: { padding: 38, paddingTop: 40, justifyContent: 'center', flexGrow: 1 },
  fhead: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: -0.4, color: Colors.text },
  fsub: { fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 5, marginBottom: 18 },
  seg: { flexDirection: 'row', backgroundColor: '#EEF2F8', borderRadius: 11, padding: 4, marginBottom: 18 },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  segOn: { backgroundColor: '#fff' },
  segTxt: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textSecondary },
  segTxtOn: { color: Colors.text },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 46, borderWidth: 1, borderColor: Colors.border, borderRadius: 11, paddingHorizontal: 13, backgroundColor: '#F8FAFC', marginBottom: 11 },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: Colors.text, padding: 0 },
  otp: { height: 54, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, textAlign: 'center', fontSize: 24, letterSpacing: 10, fontFamily: Fonts.bold, color: Colors.text, backgroundColor: '#F8FAFC', marginBottom: 12 },
  err: { color: '#ef4444', fontSize: 12.5, fontFamily: Fonts.medium, marginTop: 2, marginBottom: 6 },
  cta: { height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 15 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orTxt: { color: '#94A3B8', fontSize: 11.5, fontFamily: Fonts.medium },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 47, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  googleTxt: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#1f2937' },
  vRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  openMail: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  openMailTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  foot: { textAlign: 'center', fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 16 },
  footLink: { color: Colors.primary, fontFamily: Fonts.bold },
  link: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
});

export default DesktopAuthModal;
