import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Fonts } from '../../constants/theme';
import {
  ABOUT_TAGLINE,
  ABOUT_MISSION,
  ABOUT_STATS,
  ABOUT_VALUES,
  ABOUT_TIMELINE,
  ABOUT_TEAM_QUOTE,
  ABOUT_TEAM_ATTRIB,
  AboutColors,
  ABOUT_HERO_GRADIENT,
  ABOUT_HERO_LOCATIONS,
  ABOUT_TIMELINE_GRADIENT,
  ABOUT_TEAM_GRADIENT,
} from '../../constants/aboutContent';

const LOGO = require('../../../assets/chingi-logo.png');

function chunk<T>(arr: T[], n: number): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    const row: (T | null)[] = arr.slice(i, i + n);
    while (row.length < n) row.push(null);
    rows.push(row);
  }
  return rows;
}

// ─── Mobile About screen (pushed over the tabs, with a Back button) ──────────
export const MobileAboutScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={s.root} contentContainerStyle={s.rootContent}>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <LinearGradient
        colors={ABOUT_HERO_GRADIENT}
        locations={ABOUT_HERO_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.blobRight} pointerEvents="none" />
        <View style={s.blobLeft} pointerEvents="none" />

        <TouchableOpacity
          style={s.backBtn}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={16} color="#fff" strokeWidth={2.2} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.logoBox}>
          <Image source={LOGO} style={s.logoImg} resizeMode="contain" />
        </View>
        <Text style={s.heroTitle}>About</Text>
        <Text style={s.heroSubtitle}>{ABOUT_TAGLINE}</Text>
      </LinearGradient>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <View style={s.body}>
        {/* Our Mission */}
        <View style={s.missionCard}>
          <Text style={s.eyebrowBlue}>OUR MISSION</Text>
          <Text style={s.missionText}>{ABOUT_MISSION}</Text>
        </View>

        {/* By the Numbers */}
        <Text style={s.eyebrowMuted}>BY THE NUMBERS</Text>
        <View style={s.grid}>
          {chunk(ABOUT_STATS, 2).map((row, ri) => (
            <View key={ri} style={s.gridRow}>
              {row.map((stat, ci) =>
                stat ? (
                  <View key={ci} style={s.statCard}>
                    <View style={[s.iconBoxSm, { backgroundColor: stat.iconBg }]}>
                      <Text style={s.iconEmojiSm}>{stat.emoji}</Text>
                    </View>
                    <Text style={s.statValue}>{stat.value}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </View>
                ) : (
                  <View key={ci} style={s.gridSpacer} />
                ),
              )}
            </View>
          ))}
        </View>

        {/* Our Values */}
        <Text style={s.eyebrowMuted}>OUR VALUES</Text>
        <View style={s.valueList}>
          {ABOUT_VALUES.map((val) => (
            <View key={val.title} style={s.valueCard}>
              <View style={[s.iconBoxLg, { backgroundColor: val.iconBg }]}>
                <Text style={s.iconEmojiLg}>{val.emoji}</Text>
              </View>
              <View style={s.valueTextCol}>
                <Text style={s.valueTitle}>{val.title}</Text>
                <Text style={s.valueDesc}>{val.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Our Journey */}
        <Text style={s.eyebrowMuted}>OUR JOURNEY</Text>
        <View style={s.journeyInner}>
          <LinearGradient
            colors={ABOUT_TIMELINE_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.timelineLine}
          />
          {ABOUT_TIMELINE.map((m, i) => (
            <View
              key={m.year}
              style={[s.timelineEntry, i === ABOUT_TIMELINE.length - 1 && s.timelineEntryLast]}
            >
              <View style={s.timelineDot} />
              <Text style={s.timelineYear}>{m.year}</Text>
              <Text style={s.timelineText}>{m.text}</Text>
            </View>
          ))}
        </View>

        {/* From Our Team */}
        <LinearGradient
          colors={ABOUT_TEAM_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.teamCard}
        >
          <Text style={s.teamEyebrow}>FROM OUR TEAM</Text>
          <Text style={s.teamQuote}>{ABOUT_TEAM_QUOTE}</Text>
          <Text style={s.teamAttrib}>{ABOUT_TEAM_ATTRIB}</Text>
        </LinearGradient>
      </View>
    </ScrollView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: AboutColors.pageBg },
  rootContent: { paddingBottom: 32 },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, overflow: 'hidden' },
  blobRight: {
    position: 'absolute',
    top: -40,
    right: -25,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blobLeft: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginBottom: 24,
  },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#fff' },
  logoBox: {
    width: 61,
    height: 65,
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoImg: { width: '100%', height: '100%' },
  heroTitle: {
    fontSize: 26,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    letterSpacing: -0.52,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },

  // Body
  body: { paddingHorizontal: 14, paddingTop: 20 },

  eyebrowBlue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: AboutColors.eyebrowBlue,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
  eyebrowMuted: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: AboutColors.eyebrowMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 12,
  },

  // Mission
  missionCard: {
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.missionBorder,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: 'rgba(71,132,226,0.5)',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  missionText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: AboutColors.missionText,
    lineHeight: 24.75,
    marginTop: 10,
  },

  // Grid (stats)
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  gridSpacer: { flex: 1 },

  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.cardBorder,
    borderRadius: 18,
    padding: 16,
    minHeight: 135,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  iconBoxSm: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmojiSm: { fontSize: 18 },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: AboutColors.heading,
    letterSpacing: -0.66,
    marginTop: 'auto',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: AboutColors.statLabel,
    marginTop: 6,
  },

  // Values (stacked, icon-left)
  valueList: { gap: 10 },
  valueCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.cardBorder,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  iconBoxLg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmojiLg: { fontSize: 20 },
  valueTextCol: { flex: 1 },
  valueTitle: { fontSize: 14, fontFamily: Fonts.bold, color: AboutColors.heading },
  valueDesc: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: AboutColors.valueDesc,
    lineHeight: 19.5,
    marginTop: 4,
  },

  // Journey (no card on mobile)
  journeyInner: { position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 10,
    top: 6,
    bottom: 20,
    width: 2,
    borderRadius: 1,
  },
  timelineEntry: { paddingLeft: 28, position: 'relative', marginBottom: 24 },
  timelineEntryLast: { marginBottom: 0 },
  timelineDot: {
    position: 'absolute',
    left: 4,
    top: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4784E2',
    borderWidth: 1.6,
    borderColor: '#fff',
  },
  timelineYear: {
    fontSize: 11,
    fontFamily: Fonts.extraBold,
    color: AboutColors.eyebrowBlue,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timelineText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: AboutColors.timelineText,
    lineHeight: 19.5,
  },

  // From Our Team
  teamCard: {
    borderRadius: 20,
    padding: 18,
    marginTop: 28,
    shadowColor: 'rgba(15,23,42,1)',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  teamEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: AboutColors.teamEyebrow,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  teamQuote: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: AboutColors.teamQuote,
    lineHeight: 23.8,
    marginTop: 14,
  },
  teamAttrib: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: AboutColors.teamAttrib,
    marginTop: 20,
  },
});

export default MobileAboutScreen;
