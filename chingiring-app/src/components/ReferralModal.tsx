import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, X } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { useAuthStore } from '../store';
import { useAuthGate } from '../context/AuthGateContext';
import { REFEREE_REWARD_LABEL } from '../constants/referral';

// Centered referral-reward modal shown to a logged-out guest who arrived via a
// referral link (?ref=CODE). Tapping "Claim Now" dismisses this modal and opens
// the auth modal with referral-aware copy + prefilled code. Dismissing keeps
// the code stashed so it still applies whenever they sign up later.
export const ReferralModal: React.FC = () => {
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const code = useAuthStore((s) => s.pendingReferralCode);
  const dismissed = useAuthStore((s) => s.referralBannerDismissed);
  const dismiss = useAuthStore((s) => s.dismissReferralBanner);
  const { requireAuth } = useAuthGate();

  if (user || !code || dismissed) return null;

  const lg = width >= 768;

  const claim = () => {
    dismiss();
    requireAuth(undefined, {
      icon: 'gift',
      title: `Claim your ${REFEREE_REWARD_LABEL}`,
      subtitle: `You were referred with code ${code}. Create your account to claim it.`,
    });
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={[s.card, lg && s.cardLg]}>
          <TouchableOpacity style={s.close} onPress={dismiss} hitSlop={8}>
            <X size={14} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>

          {/* Gradient accent header */}
          <LinearGradient
            colors={['#5B3AA8', '#3A6FC9', Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.header, lg && s.headerLg]}
          >
            <View style={[s.ring, lg && s.ringLg]}>
              <Gift size={lg ? 34 : 26} color="#fff" strokeWidth={1.6} />
            </View>
          </LinearGradient>

          {/* Body */}
          <View style={[s.body, lg && s.bodyLg]}>
            <Text style={[s.reward, lg && s.rewardLg]}>{REFEREE_REWARD_LABEL}</Text>
            <Text style={[s.headline, lg && s.headlineLg]}>is waiting for you!</Text>

            <Text style={[s.sub, lg && s.subLg]}>You were referred with code</Text>
            <View style={s.chip}>
              <Text style={[s.chipTxt, lg && s.chipTxtLg]}>{code}</Text>
            </View>
            <Text style={[s.sub, lg && s.subLg, { marginTop: 4 }]}>
              Sign up to claim your referral bonus.
            </Text>

            <TouchableOpacity style={[s.cta, lg && s.ctaLg]} onPress={claim} activeOpacity={0.88}>
              <Gift size={17} color="#fff" strokeWidth={2.2} />
              <Text style={s.ctaTxt}>Claim Now</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} hitSlop={10} style={s.laterWrap}>
              <Text style={s.later}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ReferralModal;

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(8,12,22,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },

  card: {
    width: '90%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 24 }, shadowRadius: 48, elevation: 12,
  },
  cardLg: { maxWidth: 460 },

  close: {
    position: 'absolute', top: 14, right: 14, zIndex: 5,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  header: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  headerLg: { paddingVertical: 44 },

  ring: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringLg: { width: 72, height: 72, borderRadius: 36 },

  body: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 28 },
  bodyLg: { paddingHorizontal: 36, paddingTop: 28, paddingBottom: 36 },

  reward: { fontSize: 36, fontFamily: Fonts.extraBold, color: Colors.primary, letterSpacing: -0.5 },
  rewardLg: { fontSize: 44 },

  headline: { fontSize: 17, fontFamily: Fonts.bold, color: '#1e293b', marginTop: -2, letterSpacing: -0.2 },
  headlineLg: { fontSize: 20 },

  sub: { fontSize: 13, fontFamily: Fonts.regular, color: '#64748b', marginTop: 12, textAlign: 'center', lineHeight: 18 },
  subLg: { fontSize: 14.5 },

  chip: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 9, backgroundColor: '#f1f5f9',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  chipTxt: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#1e293b', letterSpacing: 2 },
  chipTxtLg: { fontSize: 19, letterSpacing: 3 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    width: '100%', height: 50, borderRadius: 13,
    backgroundColor: Colors.primary, marginTop: 22,
  },
  ctaLg: { height: 54, marginTop: 28 },
  ctaTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },

  laterWrap: { marginTop: 14 },
  later: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#94a3b8' },
});
