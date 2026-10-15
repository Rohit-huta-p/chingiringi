/**
 * SellerStates — dedicated loading / empty / error states for the seller tabs.
 *
 * Replaces the bare ActivityIndicator + plain-text placeholders the tabs used
 * inline. The skeletons mirror each screen's real Stage layout so the load-in
 * doesn't shift; SellerMessageState is a shared icon + copy + CTA card used for
 * "no store yet" and load errors.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Store, MessageCircle, Video, Box, UsersRound, ArrowRight,
  Clock, Lock, ChevronRight, Package, TriangleAlert, CircleX, RefreshCw,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Skeleton, useShimmer } from '../../components/Skeleton';

// The seller tab bar is position:absolute and overlays content; pad scroll
// content past it (matches SellerDashboardScreen's TAB_BAR_CLEARANCE).
const TAB_BAR_CLEARANCE = 90;

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

// ── Dashboard · No store (designed "get started" screen) ─────────────────────

const Feature: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <View style={st.feat}>
    <View style={st.featIcon}>{icon}</View>
    <Text style={st.featLabel}>{label}</Text>
  </View>
);

export const DashboardNoStore: React.FC<{
  name: string;
  greeting: string;
  onSetup: () => void;
  onMessages?: () => void;
  topInset?: number;
  bottomInset?: number;
}> = ({ name, greeting, onSetup, onMessages, topInset = 0, bottomInset = 0 }) => (
  <View style={st.root}>
    <View style={[st.nsHeader, { paddingTop: topInset + 16 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.nsGreet}>{greeting}, {name} 👋</Text>
        <Text style={st.nsGreetSub}>Let's get your store up and selling.</Text>
      </View>
      <Pressable style={st.nsBell} onPress={onMessages} accessibilityRole="button" accessibilityLabel="Messages">
        <MessageCircle size={18} color="#fff" strokeWidth={2} />
      </Pressable>
    </View>

    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + TAB_BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
    >
      <View style={st.nsCard}>
        <View style={st.nsCardIcon}><Store size={38} color={Colors.orange} strokeWidth={2} /></View>
        <Text style={st.nsTitle}>No store yet</Text>
        <Text style={st.nsSub}>Create your store to start listing products, going live, and reaching buyers.</Text>
        <View style={st.nsFeatures}>
          <Feature icon={<Video size={20} color={Colors.orange} strokeWidth={2} />} label="Go live" />
          <Feature icon={<Box size={20} color={Colors.orange} strokeWidth={2} />} label="List products" />
          <Feature icon={<UsersRound size={20} color={Colors.orange} strokeWidth={2} />} label="Reach buyers" />
        </View>
        <Pressable style={st.nsCta} onPress={onSetup} accessibilityRole="button" accessibilityLabel="Set up my store">
          <Text style={st.nsCtaText}>Set up my store</Text>
          <ArrowRight size={18} color="#fff" strokeWidth={2.4} />
        </Pressable>
        <Text style={st.nsTime}>Takes about 3 minutes</Text>
      </View>
    </ScrollView>
  </View>
);

// ── Dashboard · Pending / Rejected (verification-locked) ─────────────────────

export const DashboardLocked: React.FC<{
  variant: 'pending' | 'rejected';
  storeName: string;
  name: string;
  greeting: string;
  logoUrl?: string | null;
  followers: number;
  products: number;
  reason?: string;
  onResolve: () => void;
  topInset?: number;
  bottomInset?: number;
}> = ({ variant, storeName, name, greeting, logoUrl, followers, products, reason, onResolve, topInset = 0, bottomInset = 0 }) => {
  const rejected = variant === 'rejected';
  return (
    <View style={st.root}>
      <View style={[st.lkHeader, { paddingTop: topInset + 16 }]}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={st.lkAvatar} />
        ) : (
          <View style={[st.lkAvatar, st.lkAvatarFallback]}>
            <Text style={st.lkAvatarInitial}>{(storeName || name || 'S').trim()[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.lkName} numberOfLines={1}>{storeName || 'Your store'}</Text>
          <Text style={st.lkGreet} numberOfLines={1}>{greeting}, {name}</Text>
        </View>
        <View style={[st.statusPill, rejected ? st.statusPillRej : st.statusPillPend]}>
          {rejected
            ? <CircleX size={12} color="#fca5a5" strokeWidth={2.6} />
            : <Clock size={12} color="#fcd34d" strokeWidth={2.4} />}
          <Text style={[st.statusPillText, { color: rejected ? '#fca5a5' : '#fcd34d' }]}>
            {rejected ? 'Rejected' : 'Pending'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomInset + TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {rejected ? (
          <Pressable style={st.rejBanner} onPress={onResolve} accessibilityRole="button" accessibilityLabel="View and fix verification">
            <View style={st.rejBannerIcon}><TriangleAlert size={17} color="#DC2626" strokeWidth={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.rejBannerTitle}>Verification rejected</Text>
              <Text style={st.rejBannerSub} numberOfLines={2}>
                {reason ? `${reason} — tap to fix & resubmit.` : 'Fix the issue and resubmit to get verified.'}
              </Text>
            </View>
            <View style={st.rejBannerBtn}>
              <Text style={st.rejBannerBtnText}>View & fix</Text>
              <ChevronRight size={13} color="#fff" strokeWidth={2.6} />
            </View>
          </Pressable>
        ) : (
          <Pressable style={st.pendBanner} onPress={onResolve} accessibilityRole="button" accessibilityLabel="Verification details">
            <View style={st.pendBannerIcon}><Clock size={17} color="#B45309" strokeWidth={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.pendBannerTitle}>Under review</Text>
              <Text style={st.pendBannerSub}>We'll verify your store in 2–3 days.</Text>
            </View>
            <Text style={st.pendBannerLink}>Details ›</Text>
          </Pressable>
        )}

        <LinearGradient colors={['#26324d', '#1a2338']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={st.lockCard}>
          <View style={st.lockIcon}><Lock size={26} color="rgba(255,255,255,0.75)" strokeWidth={2} /></View>
          <Text style={st.lockTitle}>Going live is locked</Text>
          <Text style={st.lockSub}>
            {rejected
              ? 'Resubmit your documents to get verified and unlock live selling.'
              : 'Your record button unlocks the moment your store is verified.'}
          </Text>
          {rejected ? (
            <Pressable style={st.lockBtn} onPress={onResolve} accessibilityRole="button" accessibilityLabel="Resubmit documents">
              <RefreshCw size={16} color="#fff" strokeWidth={2.2} />
              <Text style={st.lockBtnText}>Resubmit documents</Text>
            </Pressable>
          ) : null}
        </LinearGradient>

        <View style={{ flexDirection: 'row', gap: 11 }}>
          <View style={st.statCard}>
            <UsersRound size={20} color={Colors.orange} strokeWidth={2} />
            <Text style={st.statValue}>{followers}</Text>
            <Text style={st.statLabel}>Followers</Text>
          </View>
          <View style={st.statCard}>
            <Package size={20} color={Colors.orange} strokeWidth={2} />
            <Text style={st.statValue}>{products}</Text>
            <Text style={st.statLabel}>Products</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

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

  // Dashboard · No store
  nsHeader: { backgroundColor: Colors.navy, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 22 },
  nsGreet: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#fff' },
  nsGreetSub: { fontSize: 12.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  nsBell: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  nsCard: {
    backgroundColor: Colors.surface, borderRadius: 20, paddingVertical: 26, paddingHorizontal: 22, alignItems: 'center',
    shadowColor: '#101e3c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  nsCardIcon: { width: 76, height: 76, borderRadius: 22, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  nsTitle: { fontSize: 21, fontFamily: Fonts.extraBold, color: Colors.navy, marginTop: 16 },
  nsSub: { fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginTop: 7 },
  nsFeatures: { flexDirection: 'row', gap: 14, marginVertical: 22, alignSelf: 'stretch' },
  feat: { flex: 1, alignItems: 'center', gap: 7 },
  featIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  featLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSecondary, textAlign: 'center' },
  nsCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch',
    backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 16,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6,
  },
  nsCtaText: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff' },
  nsTime: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 12 },

  // Dashboard · Locked (pending / rejected)
  lkHeader: { backgroundColor: Colors.navy, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingBottom: 18 },
  lkAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)' },
  lkAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  lkAvatarInitial: { fontSize: 15, fontFamily: Fonts.extraBold, color: '#fff' },
  lkName: { fontSize: 16, fontFamily: Fonts.extraBold, color: '#fff' },
  lkGreet: { fontSize: 11.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  statusPillPend: { backgroundColor: 'rgba(245,158,11,0.2)' },
  statusPillRej: { backgroundColor: 'rgba(239,68,68,0.2)' },
  statusPillText: { fontSize: 11, fontFamily: Fonts.bold },

  pendBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FEF9C3',
    borderWidth: 1, borderColor: '#FDE047', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
  },
  pendBannerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF08A', alignItems: 'center', justifyContent: 'center' },
  pendBannerTitle: { fontSize: 13, fontFamily: Fonts.bold, color: '#854D0E' },
  pendBannerSub: { fontSize: 11.5, fontFamily: Fonts.regular, color: '#a16207', marginTop: 1 },
  pendBannerLink: { fontSize: 12, fontFamily: Fonts.bold, color: '#B45309' },

  rejBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
  },
  rejBannerIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  rejBannerTitle: { fontSize: 13, fontFamily: Fonts.bold, color: '#991B1B' },
  rejBannerSub: { fontSize: 11.5, fontFamily: Fonts.regular, color: '#b91c1c', marginTop: 1 },
  rejBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  rejBannerBtnText: { fontSize: 11.5, fontFamily: Fonts.extraBold, color: '#fff' },

  lockCard: { borderRadius: 22, padding: 24, alignItems: 'center', overflow: 'hidden' },
  lockIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#fff', marginTop: 14 },
  lockSub: { fontSize: 12.5, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18, marginTop: 6, maxWidth: 280 },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 22, marginTop: 16 },
  lockBtnText: { fontSize: 14, fontFamily: Fonts.extraBold, color: '#fff' },

  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 15, padding: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  statValue: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.navy, marginTop: 8 },
  statLabel: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
