import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, X } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { useAuthStore } from '../store';
import { useAuthGate } from '../context/AuthGateContext';
import { REFEREE_REWARD_LABEL } from '../constants/referral';

// Soft, dismissible nudge shown to a logged-out guest who arrived via a referral
// link. Tapping opens the auth modal with referral-aware copy; dismissing hides
// the banner but keeps the code stashed, so it still applies whenever they sign
// in. Rendered inside AuthGateProvider (so `useAuthGate` is available) and
// absolutely positioned, so it never shifts the navigator's layout.
export const ReferralBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const code = useAuthStore((s) => s.pendingReferralCode);
  const dismissed = useAuthStore((s) => s.referralBannerDismissed);
  const dismiss = useAuthStore((s) => s.dismissReferralBanner);
  const { requireAuth } = useAuthGate();

  if (user || !code || dismissed) return null;

  const open = () =>
    requireAuth(undefined, {
      icon: 'gift',
      title: `Claim your ${REFEREE_REWARD_LABEL}`,
      subtitle: `You were referred with code ${code}. Create your account to claim it.`,
    });

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={s.iconWrap}>
        <Gift size={16} color="#fff" strokeWidth={2.2} />
      </View>
      <Text style={s.txt} numberOfLines={2}>
        <Text style={s.bold}>{REFEREE_REWARD_LABEL} is waiting.</Text> Sign in to claim your referral bonus.
      </Text>
      <TouchableOpacity style={s.cta} onPress={open} activeOpacity={0.85}>
        <Text style={s.ctaTxt}>Claim</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} hitSlop={10} style={s.x} activeOpacity={0.7}>
        <X size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: Colors.primary,
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  iconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  txt: { flex: 1, color: '#fff', fontSize: 12.5, fontFamily: Fonts.medium, lineHeight: 17 },
  bold: { fontFamily: Fonts.bold },
  cta: { backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  ctaTxt: { color: Colors.primary, fontSize: 12.5, fontFamily: Fonts.bold },
  x: { padding: 2 },
});

export default ReferralBanner;
