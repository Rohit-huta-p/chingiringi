import React from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet,
} from 'react-native';
import {
  ShoppingBag, Wallet, Gift, Video, ShoppingCart,
  Share2, Navigation, Star, Lock, LogIn, UserPlus,
} from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { navigationRef } from '../lib/navigationRef';
import type { AuthGateIcon, AuthGateOpts } from '../context/AuthGateContext';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS: Record<AuthGateIcon, { Icon: any; bg: string; color: string }> = {
  default:    { Icon: ShoppingBag,  bg: '#eff6ff', color: Colors.primary },
  wallet:     { Icon: Wallet,       bg: '#eff6ff', color: Colors.primary },
  gift:       { Icon: Gift,         bg: '#f5f3ff', color: '#7c3aed' },
  video:      { Icon: Video,        bg: 'rgba(71,132,226,0.12)', color: Colors.primary },
  cart:       { Icon: ShoppingCart, bg: '#eff6ff', color: Colors.primary },
  share:      { Icon: Share2,       bg: '#eff6ff', color: Colors.primary },
  navigation: { Icon: Navigation,   bg: '#eff6ff', color: Colors.primary },
  star:       { Icon: Star,         bg: '#fef3c7', color: '#d97706' },
};

// ─── AuthModal ────────────────────────────────────────────────────────────────

interface AuthModalProps {
  visible: boolean;
  opts?: AuthGateOpts;
  onClose: () => void;
}

export function AuthModal({ visible, opts, onClose }: AuthModalProps) {
  const iconKey: AuthGateIcon = opts?.icon ?? 'default';
  const { Icon, bg, color } = ICONS[iconKey] ?? ICONS.default;
  const title    = opts?.title    ?? 'Sign in to continue';
  const subtitle = opts?.subtitle ?? 'Earn CR, share products, and manage\nyour wallet — all in one place.';

  const goTo = (screen: string) => {
    onClose();
    // Tiny delay so the modal close animation starts before pushing a new screen.
    setTimeout(() => { navigationRef.navigate(screen as never); }, 60);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        {/* Tapping the scrim dismisses */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: bg }]}>
            <Icon size={26} color={color} strokeWidth={1.8} />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>

          <Pressable
            style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
            onPress={() => goTo('AuthLogin')}
          >
            <LogIn size={16} color="#fff" strokeWidth={2} />
            <Text style={s.btnPrimaryText}>Sign in</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.btnSecondary, pressed && s.pressed]}
            onPress={() => goTo('AuthSignup')}
          >
            <UserPlus size={16} color={Colors.primary} strokeWidth={2} />
            <Text style={s.btnSecondaryText}>Create account</Text>
          </Pressable>

          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={s.skip}>Continue browsing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── AuthGateOverlay ──────────────────────────────────────────────────────────
// Renders an absolute-fill frosted overlay with a lock icon. Drop this on
// top of any card/section you want to lock for unauthenticated users.

interface OverlayProps {
  onPress: () => void;
  /** Use `dark` for cards with dark backgrounds (referral card etc.) */
  dark?: boolean;
  borderRadius?: number;
}

export function AuthGateOverlay({ onPress, dark = false, borderRadius = 14 }: OverlayProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        o.overlay,
        { borderRadius },
        dark ? o.dark : o.light,
      ]}
    >
      <Lock
        size={15}
        color={dark ? 'rgba(255,255,255,0.75)' : '#64748b'}
        strokeWidth={2.2}
      />
      <Text style={[o.text, dark && o.textDark]}>Sign in to view</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    // Subtle shadow
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 13,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 18,
  },
  btnSecondaryText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  skip: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  pressed: { opacity: 0.82 },
});

const o = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  light: { backgroundColor: 'rgba(240,244,248,0.88)' },
  dark:  { backgroundColor: 'rgba(8,12,22,0.82)' },
  text: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },
  textDark: { color: 'rgba(255,255,255,0.78)' },
});
