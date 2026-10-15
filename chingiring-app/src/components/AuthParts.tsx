import React, { createContext, forwardRef, useCallback, useContext, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Image,
  type TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ArrowRight, Eye, EyeOff, Phone, MailOpen, CheckCircle2, Gift } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { LegalModal, type LegalType } from './LegalModal';
import { openMailInbox } from '../lib/openMail';

// Building blocks shared by every auth screen and both auth layouts: the phone
// hero-band scaffold (MobileAuthScaffold) and the desktop full-page split
// (DesktopAuthShell). The layout provides AuthLayoutContext so the parts can
// adapt — e.g. desktop fields drop the visible label, per the split design.

export type AuthLayoutKind = 'mobile' | 'desktop';
export const AuthLayoutContext = createContext<AuthLayoutKind>('mobile');
export const useAuthLayout = () => useContext(AuthLayoutContext);

/** Props shared by MobileAuthScaffold, DesktopAuthShell and the responsive AuthScaffold. */
export interface AuthScaffoldProps {
  mode: 'login' | 'signup';
  /** Form title. Always shown on desktop; on phones only on sub-steps (hideChrome), where the hero doesn't carry the message. */
  heading?: string;
  subheading?: string;
  onSwitch?: () => void;       // Sign in ⇄ Create account toggle
  onGoogle?: () => void;
  googleLoading?: boolean;
  onPhone?: () => void;        // start the phone-OTP flow (omit to hide the button)
  phoneLoading?: boolean;
  hideChrome?: boolean;        // hide the toggle + OR + Google/phone (sub-steps: OTP, forgot, reset, verify)
  compact?: boolean;           // phones: short hero so a sub-step's form sits above the keyboard
  onBack?: () => void;
  children: React.ReactNode;   // fields + links + error + CTA
  footer?: React.ReactNode;    // terms text etc.
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RESEND_SECONDS = 30;

const ICON = '#98a2b3';
const PLACEHOLDER = '#9aa6b8';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 10-digit Indian mobile from whatever was typed ("+91 98765 43210", "098765…"). */
export function normalizeIndianMobile(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

export const formatIndianMobile = (digits: string) =>
  digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

// Backend messages that read like internals → something a person can act on.
const FRIENDLY: [RegExp, string][] = [
  [/^invalid credentials$/i, 'Incorrect email or password.'],
  [/^invalid otp$/i, "That code isn't right. Check it and try again."],
  [/otp not found or expired/i, 'That code has expired. Request a new one.'],
  [/network error|timeout of/i, "Can't reach the server. Check your connection and try again."],
];

export function authErrorMessage(e: any, fallback: string): string {
  const raw: string = e?.response?.data?.message || e?.message || '';
  for (const [re, msg] of FRIENDLY) if (re.test(raw)) return msg;
  return raw || fallback;
}

/** Resend-code cooldown: `remaining` seconds tick down to 0 after `start()`. */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  const start = useCallback(() => setRemaining(seconds), [seconds]);
  return { remaining, start };
}

// ── Brand ─────────────────────────────────────────────────────────────────────

const LOGO = require('../../assets/chingi-logo.png');

/** The ChingiRingi mark on a white app-icon tile (the PNG has a white background), as on the splash. */
export const AuthBrandMark = ({ size = 38 }: { size?: number }) => (
  <View style={[s.markTile, { width: size, height: size, borderRadius: Math.round(size * 0.28) }]}>
    <Image source={LOGO} style={{ width: size * 0.74, height: size * 0.74 }} resizeMode="contain" />
  </View>
);

// ── Field ─────────────────────────────────────────────────────────────────────

interface AuthFieldProps extends TextInputProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label?: string;
  right?: React.ReactNode;
  /** Fixed text before the input, e.g. "+91". */
  prefix?: string;
  /** Small helper line under the field. */
  hint?: string;
  /** Desktop shows no visible label, so the placeholder names the field (defaults to the label). */
  desktopPlaceholder?: string;
}

export const AuthField = forwardRef<TextInput, AuthFieldProps>(
  ({ icon: Icon, label, right, prefix, hint, desktopPlaceholder, placeholder, style, onFocus, onBlur, ...props }, ref) => {
    const desktop = useAuthLayout() === 'desktop';
    const [focused, setFocused] = useState(false);
    return (
      <View style={s.fieldWrap}>
        {label && !desktop ? <Text style={s.label}>{label}</Text> : null}
        <View style={[s.field, focused && s.fieldFocused]}>
          <Icon size={16} color={focused ? Colors.primary : ICON} />
          {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
          <TextInput
            ref={ref}
            style={[s.input, Platform.OS === 'web' && !desktop && s.inputWebPhone, style]}
            placeholder={desktop ? (desktopPlaceholder ?? label ?? placeholder) : placeholder}
            placeholderTextColor={PLACEHOLDER}
            accessibilityLabel={label}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            {...props}
          />
          {right}
        </View>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
    );
  },
);
AuthField.displayName = 'AuthField';

export const PasswordToggle = ({ visible, onToggle }: { visible: boolean; onToggle: () => void }) => (
  <TouchableOpacity
    onPress={onToggle}
    hitSlop={12}
    accessibilityRole="button"
    accessibilityLabel={visible ? 'Hide password' : 'Show password'}
  >
    {visible ? <EyeOff size={16} color={ICON} /> : <Eye size={16} color={ICON} />}
  </TouchableOpacity>
);

/** One box for the whole 6-digit code, so SMS/email autofill and paste land in full. */
export const AuthCodeInput = ({
  value, onChangeText, onComplete, autoFocus = true,
}: {
  value: string;
  onChangeText: (digits: string) => void;
  onComplete?: (digits: string) => void;
  autoFocus?: boolean;
}) => (
  <TextInput
    style={s.code}
    value={value}
    onChangeText={(t) => {
      const digits = t.replace(/\D/g, '').slice(0, 6);
      onChangeText(digits);
      if (digits.length === 6 && digits !== value) onComplete?.(digits);
    }}
    keyboardType="number-pad"
    inputMode="numeric"
    placeholder="••••••"
    placeholderTextColor="#94a3b8"
    textContentType="oneTimeCode"
    autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
    accessibilityLabel="6-digit code"
    autoFocus={autoFocus}
  />
);

// ── Actions ───────────────────────────────────────────────────────────────────

export const AuthCTA = ({ label, onPress, loading, disabled }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
}) => (
  <TouchableOpacity
    style={[s.cta, (loading || disabled) && s.dim]}
    onPress={onPress}
    disabled={loading || disabled}
    activeOpacity={0.9}
    accessibilityRole="button"
    accessibilityLabel={label}
    aria-disabled={!!(loading || disabled)}
    aria-busy={!!loading}
  >
    {loading ? <ActivityIndicator color="#fff" /> : (
      <View style={s.ctaRow}>
        <Text style={s.ctaTxt}>{label}</Text>
        <ArrowRight size={17} color="#fff" strokeWidth={2.3} />
      </View>
    )}
  </TouchableOpacity>
);

export const AuthLink = ({ label, onPress, disabled, align = 'left', muted }: {
  label: string; onPress: () => void; disabled?: boolean; align?: 'left' | 'center' | 'right'; muted?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    hitSlop={10}
    style={[s.link, align === 'right' && s.linkRight, align === 'center' && s.linkCenter]}
    accessibilityRole="button"
    aria-disabled={!!disabled}
  >
    <Text style={[s.linkTxt, muted && s.linkMuted, disabled && s.linkDisabled]}>{label}</Text>
  </TouchableOpacity>
);

export const AuthLinkRow = ({ children }: { children: React.ReactNode }) => (
  <View style={s.linkRow}>{children}</View>
);

export const OpenMailButton = ({ email }: { email?: string }) => (
  <TouchableOpacity style={s.openMail} onPress={() => openMailInbox(email)} activeOpacity={0.85} accessibilityRole="button">
    <MailOpen size={15} color={Colors.primary} strokeWidth={2} />
    <Text style={s.openMailTxt}>Open mail</Text>
  </TouchableOpacity>
);

// ── Messages ──────────────────────────────────────────────────────────────────

export const AuthError = ({ text }: { text?: string }) =>
  text ? <Text style={s.err} accessibilityRole="alert">{text}</Text> : null;

export const AuthNotice = ({ text, tone = 'success' }: { text: string; tone?: 'success' | 'referral' }) => (
  <View style={[s.notice, tone === 'referral' && s.noticeReferral]}>
    {tone === 'referral'
      ? <Gift size={14} color={Colors.primary} strokeWidth={2.2} />
      : <CheckCircle2 size={14} color="#15803d" strokeWidth={2.2} />}
    <Text style={[s.noticeTxt, tone === 'referral' && s.noticeTxtReferral]}>{text}</Text>
  </View>
);

/** "By continuing, you agree to…" with working Terms / Privacy links. */
export const AuthTerms = ({ verb }: { verb: string }) => {
  const [doc, setDoc] = useState<LegalType | null>(null);
  return (
    <>
      <Text style={s.terms}>
        By {verb}, you agree to our{' '}
        <Text style={s.termsLink} onPress={() => setDoc('terms')} accessibilityRole="link">Terms of Service</Text>
        {' and '}
        <Text style={s.termsLink} onPress={() => setDoc('privacy')} accessibilityRole="link">Privacy Policy</Text>.
      </Text>
      <LegalModal type={doc} onClose={() => setDoc(null)} />
    </>
  );
};

// ── Chrome: Sign in / Create account toggle, OR + Google + phone ─────────────

export const AuthSegToggle = ({ mode, onSwitch }: { mode: 'login' | 'signup'; onSwitch?: () => void }) => {
  const isLogin = mode === 'login';
  const tab = (label: string, active: boolean) => (
    <TouchableOpacity
      style={[s.segBtn, active && s.segOn]}
      onPress={active ? undefined : onSwitch}
      hitSlop={{ top: 4, bottom: 4 }}
      activeOpacity={0.9}
      accessibilityRole="tab"
      aria-selected={active}
    >
      <Text style={[s.segTxt, active && s.segTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {tab('Sign in', isLogin)}
      {tab('Create account', !isLogin)}
    </View>
  );
};

// Google's multi-colour "G" (brand guidelines ask for the real mark, not a letter).
const GoogleMark = () => (
  <Svg width={18} height={18} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

export const AuthAltOptions = ({ isLogin, onGoogle, googleLoading, onPhone, phoneLoading }: {
  isLogin: boolean; onGoogle?: () => void; googleLoading?: boolean; onPhone?: () => void; phoneLoading?: boolean;
}) => (
  <>
    <View style={s.orRow}><View style={s.orLine} /><Text style={s.orTxt}>OR</Text><View style={s.orLine} /></View>

    <TouchableOpacity
      style={[s.alt, googleLoading && s.dim]}
      onPress={onGoogle}
      disabled={googleLoading}
      activeOpacity={0.9}
      accessibilityRole="button"
    >
      {googleLoading ? <ActivityIndicator color={Colors.primary} /> : (
        <>
          <GoogleMark />
          <Text style={s.altTxt}>{isLogin ? 'Continue with Google' : 'Sign up with Google'}</Text>
        </>
      )}
    </TouchableOpacity>

    {onPhone && (
      <TouchableOpacity
        style={[s.alt, s.altSpaced, phoneLoading && s.dim]}
        onPress={onPhone}
        disabled={phoneLoading}
        activeOpacity={0.9}
        accessibilityRole="button"
      >
        {phoneLoading ? <ActivityIndicator color={Colors.primary} /> : (
          <>
            <Phone size={17} color="#26313f" strokeWidth={2.2} />
            <Text style={s.altTxt}>{isLogin ? 'Continue with phone' : 'Sign up with phone'}</Text>
          </>
        )}
      </TouchableOpacity>
    )}
  </>
);

const s = StyleSheet.create({
  markTile: { backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0b1020', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },

  fieldWrap: { marginBottom: 12 },
  label: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: '#0f172a', marginBottom: 7 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 13, backgroundColor: '#f8fafc' },
  fieldFocused: { borderColor: Colors.primary, backgroundColor: '#fff' },
  prefix: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#475569' },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: '#0f172a', padding: 0, height: '100%', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) },
  // iOS Safari zooms the page into any input under 16px — keep phone-width web at 16.
  inputWebPhone: { fontSize: 16 },
  hint: { fontSize: 12, fontFamily: Fonts.regular, color: '#64748b', marginTop: 6, lineHeight: 16 },

  code: { height: 54, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, textAlign: 'center', fontSize: 24, letterSpacing: 10, fontFamily: Fonts.bold, color: Colors.text, backgroundColor: '#f8fafc', marginBottom: 12, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null) },

  cta: { height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  dim: { opacity: 0.6 },

  link: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkRight: { alignSelf: 'flex-end' },
  linkCenter: { alignSelf: 'center', marginTop: 14 }, // centred links sit under the CTA
  linkTxt: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  linkMuted: { color: Colors.textSecondary, fontFamily: Fonts.semiBold },
  linkDisabled: { color: '#94a3b8' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  openMail: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  openMailTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },

  err: { color: '#dc2626', fontSize: 13, fontFamily: Fonts.semiBold, marginTop: 2, marginBottom: 8, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 14 },
  noticeReferral: { backgroundColor: '#eef4ff' },
  noticeTxt: { flex: 1, fontSize: 12.5, fontFamily: Fonts.semiBold, color: '#15803d', lineHeight: 17 },
  noticeTxtReferral: { color: Colors.primary },
  terms: { fontSize: 11.5, fontFamily: Fonts.regular, color: '#94a3b8', textAlign: 'center', marginTop: 20, lineHeight: 17 },
  termsLink: { color: '#64748b', fontFamily: Fonts.semiBold, textDecorationLine: 'underline' },

  seg: { flexDirection: 'row', backgroundColor: '#eef2f8', borderRadius: 11, padding: 4, marginBottom: 18 },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segOn: { backgroundColor: '#fff', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 1 },
  segTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#68727f' },
  segTxtOn: { color: Colors.text },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 15 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e6eaf0' },
  orTxt: { color: '#94a3b8', fontSize: 11.5, fontFamily: Fonts.medium },
  alt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 47, borderRadius: 12, borderWidth: 1, borderColor: '#dfe4ea', backgroundColor: '#fff' },
  altSpaced: { marginTop: 10 },
  altTxt: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#26313f' },
});
