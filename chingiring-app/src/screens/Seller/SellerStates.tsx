/**
 * SellerStates — dedicated loading / empty / error states for the seller tabs.
 *
 * Replaces the bare ActivityIndicator + plain-text placeholders the tabs used
 * inline. The skeletons mirror each screen's real Stage layout so the load-in
 * doesn't shift; SellerMessageState is a shared icon + copy + CTA card used for
 * "no store yet" and load errors.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Skeleton, useShimmer } from '../../components/Skeleton';

const HEADER_ON_NAVY = 'rgba(255,255,255,0.22)';
const HEADER_ON_NAVY_DIM = 'rgba(255,255,255,0.14)';

// ── Dashboard ("Stage") loading skeleton ────────────────────────────────────

export const DashboardSkeleton: React.FC<{ topInset: number }> = ({ topInset }) => {
  const s = useShimmer();
  return (
    <View style={st.root}>
      <View style={[st.navyHeader, { paddingTop: topInset + 16 }]}>
        <Animated.View style={[st.avatar, { opacity: s }]} />
        <View style={{ flex: 1, gap: 7 }}>
          <Skeleton shimmer={s} w={130} h={14} r={5} style={{ backgroundColor: HEADER_ON_NAVY }} />
          <Skeleton shimmer={s} w={90} h={10} r={4} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
        </View>
        <Skeleton shimmer={s} w={58} h={30} r={16} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
        <Skeleton shimmer={s} w={38} h={38} r={19} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
      </View>

      <View style={{ padding: 16, gap: 18 }}>
        {/* Stage hero */}
        <Skeleton shimmer={s} w="100%" h={188} r={22} style={{ backgroundColor: '#d5dbe6' }} />

        {/* Glance chips */}
        <View>
          <Skeleton shimmer={s} w={130} h={11} r={4} style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', gap: 11 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} shimmer={s} w={118} h={86} r={15} />)}
          </View>
        </View>

        {/* Pick-up rows */}
        <View>
          <Skeleton shimmer={s} w={170} h={11} r={4} style={{ marginBottom: 12 }} />
          <View style={{ gap: 10 }}>
            {[0, 1].map((i) => <Skeleton key={i} shimmer={s} w="100%" h={66} r={14} />)}
          </View>
        </View>
      </View>
    </View>
  );
};

// ── My Store ("Shelf") loading skeleton ─────────────────────────────────────

export const MyStoreSkeleton: React.FC<{ topInset: number }> = ({ topInset }) => {
  const s = useShimmer();
  return (
    <View style={st.root}>
      <View style={[st.navyHeader, { paddingTop: topInset + 16 }]}>
        <Skeleton shimmer={s} w={44} h={44} r={22} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
        <View style={{ flex: 1, gap: 7 }}>
          <Skeleton shimmer={s} w={140} h={15} r={5} style={{ backgroundColor: HEADER_ON_NAVY }} />
          <Skeleton shimmer={s} w={70} h={10} r={4} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
        </View>
        <Skeleton shimmer={s} w={40} h={40} r={20} style={{ backgroundColor: HEADER_ON_NAVY_DIM }} />
      </View>

      {/* Search + filter */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
        <Skeleton shimmer={s} h={46} r={14} style={{ flex: 1 }} />
        <Skeleton shimmer={s} w={46} h={46} r={14} />
      </View>

      {/* Product rows */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={st.row}>
            <Skeleton shimmer={s} w={78} h={78} r={12} />
            <View style={{ flex: 1, gap: 9 }}>
              <Skeleton shimmer={s} w="72%" h={14} r={5} />
              <Skeleton shimmer={s} w={90} h={14} r={5} />
              <Skeleton shimmer={s} w={54} h={10} r={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Shared message state (no store / error) ─────────────────────────────────

export const SellerMessageState: React.FC<{
  icon: React.ComponentType<any>;
  iconColor?: string;
  iconBg?: string;
  title: string;
  sub: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** Safe-area top inset so the centered content clears the notch. */
  topInset?: number;
}> = ({ icon: Icon, iconColor = Colors.orange, iconBg = 'rgba(249,115,22,0.1)', title, sub, ctaLabel, onCta, topInset = 0 }) => (
  <View style={[st.msgRoot, { paddingTop: topInset }]}>
    <View style={[st.msgIcon, { backgroundColor: iconBg }]}>
      <Icon size={30} color={iconColor} strokeWidth={2} />
    </View>
    <Text style={st.msgTitle}>{title}</Text>
    <Text style={st.msgSub}>{sub}</Text>
    {ctaLabel && onCta ? (
      <Pressable style={st.msgCta} onPress={onCta} accessibilityRole="button" accessibilityLabel={ctaLabel}>
        <Text style={st.msgCtaText}>{ctaLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  navyHeader: {
    backgroundColor: Colors.navy,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 18,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: HEADER_ON_NAVY_DIM },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 10,
  },

  // Message state
  msgRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, backgroundColor: Colors.background },
  msgIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  msgTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy, textAlign: 'center' },
  msgSub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  msgCta: { marginTop: 10, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32 },
  msgCtaText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
