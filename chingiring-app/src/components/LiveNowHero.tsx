import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Fonts } from '../constants/theme';

/**
 * "Watch. Ask. Order." live hero on the Products tab.
 *
 * Flexible target: an http(s) `HERO_LINK` opens in the browser; anything else
 * (the default) jumps to the in-app Live Stores tab (route 'Stores'). Set
 * HERO_LINK to 'https://chingiringi.com/app/stores' to send users to the web
 * page instead — "if app then app, if web then web".
 */
const HERO_LINK = '';

export function LiveNowHero() {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    const v = HERO_LINK.trim();
    if (/^https?:\/\//i.test(v)) { Linking.openURL(v).catch(() => {}); return; }
    navigation.navigate('Stores');
  };

  return (
    <View style={st.wrap}>
      <TouchableOpacity activeOpacity={0.92} onPress={handlePress} style={st.card}>
        <LinearGradient
          colors={['#16306e', '#1E3A8A', '#2d53a6'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* soft radial-ish highlight on the right */}
        <View style={st.glow} pointerEvents="none" />

        <View style={st.copy}>
          <View style={st.live}>
            <View style={st.liveDot} />
            <Text style={st.liveTxt}>LIVE NOW</Text>
          </View>
          <Text style={st.h}>Watch. Ask.{'\n'}Order.</Text>
          <View style={st.cta}>
            <Text style={st.ctaTxt}>Explore live stores</Text>
            <ChevronRight size={16} color="#1E3A8A" strokeWidth={2.6} />
          </View>
        </View>

        {/* decorative device motif (stands in for the lifestyle art) */}
        <View style={st.device} pointerEvents="none">
          <Text style={st.wmA}>Chingi</Text>
          <Text style={st.wmB}>Ringi</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginTop: 16, paddingHorizontal: 16 },
  card: { borderRadius: 18, overflow: 'hidden', minHeight: 168, justifyContent: 'center' },
  glow: {
    position: 'absolute', right: -40, top: -20, width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(71,132,226,0.45)',
  },
  copy: { paddingVertical: 18, paddingLeft: 18, width: '64%', zIndex: 2 },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: '#F2685E', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 11, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  h: { color: '#fff', fontSize: 28, lineHeight: 30, fontFamily: Fonts.extraBold, marginTop: 12, letterSpacing: -0.3 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, marginTop: 14,
  },
  ctaTxt: { color: '#1E3A8A', fontSize: 13.5, fontFamily: Fonts.extraBold },
  device: {
    position: 'absolute', right: 20, top: '50%', marginTop: -62,
    width: 80, height: 124, borderRadius: 16, backgroundColor: '#0c1630',
    borderWidth: 3, borderColor: '#27407e', transform: [{ rotate: '8deg' }],
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  wmA: { color: '#fff', fontSize: 16, fontFamily: Fonts.extraBold, lineHeight: 17 },
  wmB: { color: '#F5B301', fontSize: 16, fontFamily: Fonts.extraBold, lineHeight: 17 },
});
