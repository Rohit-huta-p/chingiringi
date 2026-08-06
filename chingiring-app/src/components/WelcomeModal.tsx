import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet, Share2, MapPin } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { useAuthStore } from '../store';

const useNative = Platform.OS !== 'web';

const FEATURES = [
  { Icon: Wallet, color: '#4784E2', bg: 'rgba(71,132,226,0.14)', title: 'Cashback on every order', sub: 'Real money back, straight to your wallet' },
  { Icon: Share2, color: '#F5A623', bg: 'rgba(245,166,35,0.14)', title: 'Share and earn', sub: 'Up to 100 coins a day for referrals' },
  { Icon: MapPin, color: '#22C08A', bg: 'rgba(34,192,138,0.15)', title: 'Offline store deals', sub: 'Members-only discounts near you' },
];

/**
 * First-sign-in welcome. Self-gates on the `showWelcome` store flag (set once
 * on account creation), so it renders nothing until a brand-new user signs in.
 */
export const WelcomeModal = () => {
  const showWelcome = useAuthStore((s) => s.showWelcome);
  const dismissWelcome = useAuthStore((s) => s.dismissWelcome);
  const user = useAuthStore((s) => s.user);

  const anim = useRef(new Animated.Value(0)).current;
  const rows = useRef(FEATURES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!showWelcome) return;
    anim.setValue(0);
    rows.forEach((r) => r.setValue(0));
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: useNative, friction: 7, tension: 65 }),
      Animated.stagger(
        90,
        rows.map((r) =>
          Animated.timing(r, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: useNative })
        )
      ),
    ]).start();
  }, [showWelcome]);

  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: useNative })
      .start(() => dismissWelcome());
  };

  const firstName = (user?.name || '').trim().split(' ')[0] || 'there';
  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <Modal visible={showWelcome} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />

        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
              ],
            },
          ]}
        >
          <LinearGradient colors={['#3A6FC9', Colors.primary, '#79ADFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>Welcome, {firstName}.</Text>
            <Text style={styles.heroSub}>India's largest passive-income ecosystem — now yours.</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.lead}>HERE'S HOW YOU EARN</Text>
            {FEATURES.map((f, i) => {
              const Icon = f.Icon;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.feat,
                    { opacity: rows[i], transform: [{ translateY: rows[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
                  ]}
                >
                  <View style={[styles.chip, { backgroundColor: f.bg }]}>
                    <Icon size={21} color={f.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featTitle}>{f.title}</Text>
                    <Text style={styles.featSub}>{f.sub}</Text>
                  </View>
                </Animated.View>
              );
            })}

            <TouchableOpacity activeOpacity={0.9} onPress={close} style={styles.ctaWrap}>
              <LinearGradient colors={['#5A96EC', Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.cta}>
                <Text style={styles.ctaText}>Get started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,7,14,0.62)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#141A28',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  hero: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 26, fontFamily: Fonts.extraBold },
  heroTitle: { color: '#fff', fontSize: 24, fontFamily: Fonts.extraBold, letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 8, maxWidth: 250, lineHeight: 19 },
  body: { padding: 20 },
  lead: { color: '#5E6A8A', fontSize: 11, fontFamily: Fonts.semiBold, letterSpacing: 1.6, marginBottom: 6 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10 },
  chip: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featTitle: { color: '#F4F7FF', fontSize: 14.5, fontFamily: Fonts.semiBold },
  featSub: { color: '#9AA6C4', fontSize: 12, fontFamily: Fonts.regular, marginTop: 1 },
  ctaWrap: { marginTop: 16 },
  cta: { borderRadius: 13, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
});
