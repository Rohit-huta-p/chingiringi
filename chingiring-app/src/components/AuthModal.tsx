import React from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, useWindowDimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingBag, Wallet, Gift, Video, ShoppingCart,
  Share2, Navigation, Star, Lock, ArrowRight,
} from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { navigationRef } from '../lib/navigationRef';
import type { AuthGateIcon, AuthGateOpts } from '../context/AuthGateContext';

// ─── Icon map ─────────────────────────────────────────────────────────────────
// The contextual icon shown in the gate header (rendered white on the gradient).

const ICONS: Record<AuthGateIcon, any> = {
  default: ShoppingBag,
  wallet: Wallet,
  gift: Gift,
  video: Video,
  cart: ShoppingCart,
  share: Share2,
  navigation: Navigation,
  star: Star,
};



interface AuthModalProps {
  visible: boolean;
  opts?: AuthGateOpts;
  onClose: () => void;
}

export function AuthModal({ visible, opts, onClose }: AuthModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const iconKey: AuthGateIcon = opts?.icon ?? 'default';
  const Icon = ICONS[iconKey] ?? ICONS.default;
  const title = opts?.title ?? 'Sign in to continue';
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

        <View style={[s.card, isDesktop && s.cardLg]}>
          {/* ── Editorial gradient header ─────────────────────────────── */}
          <View style={s.hero}>
            <LinearGradient colors={['#5B3AA8', '#3A6FC9', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(6,10,20,0.34)']} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={s.iconTile}>
              <Icon size={25} color="#fff" strokeWidth={1.9} />
            </View>
            <Text style={s.title}>{title}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <View style={s.body}>
            <Pressable
              style={({ pressed }) => [s.btnPrimary, pressed && s.pressed]}
              onPress={() => goTo('AuthLogin')}
            >
              <Text style={s.btnPrimaryText}>Sign in</Text>
              <ArrowRight size={17} color="#fff" strokeWidth={2.3} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.btnSecondary, pressed && s.pressed]}
              onPress={() => goTo('AuthSignup')}
            >
              <Text style={s.btnSecondaryText}>Create account</Text>
            </Pressable>

            <Pressable onPress={onClose} hitSlop={10} style={s.skipWrap}>
              <Text style={s.skip}>Continue browsing</Text>
            </Pressable>
          </View>
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
    backgroundColor: 'rgba(8,12,22,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 34,
    elevation: 14,
  },
  cardLg: {
    maxWidth: 420, // larger guest-gate modal on desktop
  },
  hero: {
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 13,
    paddingVertical: 14,
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
    borderRadius: 13,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 14,
  },
  btnSecondaryText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  skipWrap: { alignItems: 'center' },
  skip: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
  },
  pressed: { opacity: 0.85 },
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
  dark: { backgroundColor: 'rgba(8,12,22,0.82)' },
  text: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },
  textDark: { color: 'rgba(255,255,255,0.78)' },
});
