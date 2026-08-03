import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import {
  Banner,
  BannerLinkType,
  BannerSide,
  resolveBannerGradient,
} from '../api/banners';
import { cloudinaryFill } from '../utils/cloudinary';

// ─── Navigation ──────────────────────────────────────────────────────────────
//
// Route a banner tap by its link fields. This preserves the old earn-coins /
// refer-earn entry points now that those are ordinary placeable banners:
//   category → CategoryProducts, url containing 'wallet'/'refer' → those
//   screens, deal → ProductDetail (best effort). Unknown urls are a no-op.

export function bannerNavigate(
  navigation: any,
  link?: { linkType?: BannerLinkType; linkValue?: string },
): void {
  if (!navigation || !link?.linkType || !link.linkValue) return;
  const { linkType, linkValue } = link;
  if (linkType === 'category') {
    navigation.navigate('CategoryProducts', { category: linkValue });
  } else if (linkType === 'deal') {
    navigation.navigate('ProductDetail', { dealId: linkValue });
  } else if (linkType === 'url') {
    const v = linkValue.toLowerCase();
    if (v.includes('wallet')) navigation.navigate('Wallet');
    else if (v.includes('refer')) navigation.navigate('Referrals');
    // external / unknown internal path → no-op for now
  }
}

// ─── One face (hero body, or one half of a dual) ─────────────────────────────

function BannerFace({
  side,
  gradient,
  isMobile,
  height,
  radius,
  style,
  onPress,
}: {
  side: BannerSide;
  gradient: [string, string];
  isMobile: boolean;
  height: number;
  radius: number;
  style?: any;
  onPress?: () => void;
}) {
  const image = isMobile ? side.mobileImageUrl || side.imageUrl : side.imageUrl;
  // Measure the rendered width so Cloudinary can deliver an exactly-sized,
  // smart-cropped image (fixes upscaling blur + dumb crop on wide heroes).
  // Fall back to a sensible width for the first paint, before onLayout fires.
  const [boxW, setBoxW] = useState(0);
  const displaySrc = image
    ? cloudinaryFill(image, boxW || (isMobile ? 400 : 1200), height)
    : undefined;
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.95 : 1}
      onPress={onPress}
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
      style={[st.face, { height, borderRadius: radius }, style]}
    >
      {image ? (
        <Image source={{ uri: displaySrc }} style={st.fill} resizeMode="cover" />
      ) : (
        <>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={st.fallback}>
            {side.title ? <Text style={st.title}>{side.title}</Text> : null}
            {side.subtitle ? <Text style={st.sub}>{side.subtitle}</Text> : null}
            {side.ctaLabel ? (
              <View style={st.cta}>
                <Text style={st.ctaTxt}>{side.ctaLabel}</Text>
                <ArrowRight size={14} color="#0f172a" strokeWidth={2.5} />
              </View>
            ) : null}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Banner block (hero | dual) ──────────────────────────────────────────────
//
// The single home-page banner renderer, shared by HomeScreen (desktop) and
// MobileHomeScreen. `type` picks the shape; images fall back to the mobile
// variant on narrow screens. Replaces the old per-slot banner components.

export function BannerBlock({
  banner,
  navigation,
  isMobile = false,
}: {
  banner: Banner;
  navigation: any;
  isMobile?: boolean;
}) {
  const gradient = resolveBannerGradient(banner);

  if (banner.type === 'dual') {
    const height = isMobile ? 130 : 160;
    const radius = isMobile ? 14 : 16;
    const right: BannerSide = banner.right ?? {};
    return (
      <View style={[st.dualRow, { gap: isMobile ? 12 : 16 }]}>
        <BannerFace
          side={banner}
          gradient={gradient}
          isMobile={isMobile}
          height={height}
          radius={radius}
          style={st.flex1}
          onPress={() => bannerNavigate(navigation, banner)}
        />
        <BannerFace
          side={right}
          gradient={gradient}
          isMobile={isMobile}
          height={height}
          radius={radius}
          style={st.flex1}
          onPress={() => bannerNavigate(navigation, right)}
        />
      </View>
    );
  }

  // hero (default)
  return (
    <BannerFace
      side={banner}
      gradient={gradient}
      isMobile={isMobile}
      height={isMobile ? 150 : 220}
      radius={isMobile ? 16 : 20}
      style={st.fullWidth}
      onPress={() => bannerNavigate(navigation, banner)}
    />
  );
}

// ─── Interleave helper ───────────────────────────────────────────────────────
//
// Splice placed banners into an ordered list of product-section blocks. A
// banner at rowIndex k renders before block k (0 = top, k >= length = end).
// Ties break by sortOrder then createdAt. `renderBanner` lets each screen size
// its own banner (desktop vs mobile). Shared by both home screens.

export function interleaveBanners(
  blocks: React.ReactNode[],
  banners: Banner[],
  renderBanner: (banner: Banner) => React.ReactNode,
): React.ReactNode[] {
  const sorted = [...banners].sort(
    (a, b) =>
      (a.rowIndex ?? 0) - (b.rowIndex ?? 0) ||
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  );
  const gap: Record<number, Banner[]> = {};
  for (const b of sorted) {
    const k = Math.max(0, Math.min(b.rowIndex ?? 0, blocks.length));
    (gap[k] ??= []).push(b);
  }
  const out: React.ReactNode[] = [];
  for (let i = 0; i <= blocks.length; i++) {
    for (const b of gap[i] ?? []) out.push(renderBanner(b));
    if (i < blocks.length) out.push(blocks[i]);
  }
  return out;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  fullWidth: { width: '100%' },
  flex1: { flex: 1 },
  face: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  dualRow: { flexDirection: 'row' },
  fallback: { flex: 1, justifyContent: 'center', padding: 20, zIndex: 1 },
  title: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#fff', lineHeight: 26 },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#192253ff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    marginTop: 12,
  },
  ctaTxt: { fontSize: 13, fontFamily: Fonts.bold, color: '#0f172a' },
});
