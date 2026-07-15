import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
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

// Split an array into rows of `n` for grid layout (pads the trailing row with
// nulls so cells keep a consistent flex width).
function chunk<T>(arr: T[], n: number): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    const row: (T | null)[] = arr.slice(i, i + n);
    while (row.length < n) row.push(null);
    rows.push(row);
  }
  return rows;
}

// ─── Desktop About screen (renders inside the permanent drawer) ──────────────
export const AboutScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  // Content area = viewport minus the ~220px permanent sidebar.
  const contentW = width - 220;
  const statCols = contentW < 900 ? 2 : 4;
  const valueCols = contentW < 820 ? 1 : 2;

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

        <View style={s.heroRow}>
          <View style={s.logoBox}>
            <Image source={LOGO} style={s.logoImg} resizeMode="contain" />
          </View>
          <View style={s.heroTitleCol}>
            <Text style={s.heroTitle}>About</Text>
            <Text style={s.heroSubtitle}>{ABOUT_TAGLINE}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <View style={s.body}>
        {/* Our Mission */}
        <View style={s.missionCard}>
          <Text style={[s.eyebrow, s.eyebrowBlue]}>OUR MISSION</Text>
          <Text style={s.missionText}>{ABOUT_MISSION}</Text>
        </View>

        {/* By the Numbers */}
        <View style={s.section}>
          <Text style={[s.eyebrow, s.eyebrowMuted]}>BY THE NUMBERS</Text>
          <View style={s.grid}>
            {chunk(ABOUT_STATS, statCols).map((row, ri) => (
              <View key={ri} style={s.gridRow}>
                {row.map((stat, ci) =>
                  stat ? (
                    <View key={ci} style={s.statCard}>
                      <View style={[s.iconBox, s.iconBoxSm, { backgroundColor: stat.iconBg }]}>
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
        </View>

        {/* Our Values */}
        <View style={s.section}>
          <Text style={[s.eyebrow, s.eyebrowMuted]}>OUR VALUES</Text>
          <View style={s.grid}>
            {chunk(ABOUT_VALUES, valueCols).map((row, ri) => (
              <View key={ri} style={s.gridRow}>
                {row.map((val, ci) =>
                  val ? (
                    <View key={ci} style={s.valueCard}>
                      <View style={[s.iconBox, s.iconBoxLg, { backgroundColor: val.iconBg }]}>
                        <Text style={s.iconEmojiLg}>{val.emoji}</Text>
                      </View>
                      <Text style={s.valueTitle}>{val.title}</Text>
                      <Text style={s.valueDesc}>{val.desc}</Text>
                    </View>
                  ) : (
                    <View key={ci} style={s.gridSpacer} />
                  ),
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Our Journey */}
        <View style={s.section}>
          <Text style={[s.eyebrow, s.eyebrowMuted]}>OUR JOURNEY</Text>
          <View style={s.journeyCard}>
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
          </View>
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
  rootContent: { paddingBottom: 48 },

  // Hero
  hero: {
    paddingHorizontal: 48,
    paddingTop: 40,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  blobRight: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blobLeft: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginBottom: 28,
  },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#fff' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  logoBox: {
    width: 82,
    height: 84,
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImg: { width: '100%', height: '100%' },
  heroTitleCol: { justifyContent: 'center' },
  heroTitle: {
    fontSize: 48,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    letterSpacing: -1.2,
    lineHeight: 52,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },

  // Body
  body: { paddingHorizontal: 24, paddingTop: 48 },
  section: { marginTop: 48 },
  eyebrow: { textTransform: 'uppercase', fontFamily: Fonts.bold },
  eyebrowBlue: { fontSize: 14, color: AboutColors.eyebrowBlue, letterSpacing: 0.7 },
  eyebrowMuted: { fontSize: 14, color: AboutColors.eyebrowMuted, letterSpacing: 0.7, marginBottom: 24 },

  // Mission
  missionCard: {
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.missionBorder,
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  missionText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: AboutColors.missionText,
    lineHeight: 26,
    marginTop: 16,
  },

  // Grid (stats + values)
  grid: { gap: 24 },
  gridRow: { flexDirection: 'row', gap: 24 },
  gridSpacer: { flex: 1 },

  iconBox: { borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  iconBoxSm: { width: 40, height: 40 },
  iconBoxLg: { width: 44, height: 44 },
  iconEmojiSm: { fontSize: 20 },
  iconEmojiLg: { fontSize: 22 },

  // Stat card
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.cardBorder,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 30,
    fontFamily: Fonts.extraBold,
    color: AboutColors.heading,
    letterSpacing: -0.75,
    marginTop: 16,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: AboutColors.statLabel,
    marginTop: 8,
  },

  // Value card
  valueCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.cardBorder,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  valueTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: AboutColors.heading,
    marginTop: 16,
  },
  valueDesc: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: AboutColors.valueDesc,
    lineHeight: 22,
    marginTop: 6,
  },

  // Journey
  journeyCard: {
    backgroundColor: '#fff',
    borderWidth: 0.8,
    borderColor: AboutColors.cardBorder,
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  journeyInner: { position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 6,
    bottom: 24,
    width: 2,
    borderRadius: 1,
  },
  timelineEntry: { paddingLeft: 40, position: 'relative', marginBottom: 32 },
  timelineEntryLast: { marginBottom: 0 },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4784E2',
    borderWidth: 1.6,
    borderColor: '#fff',
  },
  timelineYear: {
    fontSize: 12,
    fontFamily: Fonts.extraBold,
    color: AboutColors.eyebrowBlue,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  timelineText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: AboutColors.timelineText,
    lineHeight: 22,
  },

  // From Our Team
  teamCard: {
    borderRadius: 16,
    padding: 32,
    marginTop: 48,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 8,
    elevation: 4,
  },
  teamEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: AboutColors.teamEyebrow,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  teamQuote: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: AboutColors.teamQuote,
    lineHeight: 26,
    marginTop: 16,
  },
  teamAttrib: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: AboutColors.teamAttrib,
    marginTop: 24,
  },
});

export default AboutScreen;
