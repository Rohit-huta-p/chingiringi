import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlaySquare } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';

/**
 * Placeholder for the Videos tab introduced by Figma 21:2130 (bottom nav
 * redesign). Backend has no video model yet — wire to a real feed once the
 * Videos module ships.
 */
export const MobileVideosScreen = () => {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.content}>
        <View style={s.iconBox}>
          <PlaySquare size={48} color={Colors.primary} strokeWidth={1.6} />
        </View>
        <Text style={s.title}>Videos</Text>
        <Text style={s.sub}>
          Watch deal walkthroughs, product reviews, and earn coins along the way.
        </Text>
        <View style={s.comingSoon}>
          <Text style={s.comingSoonText}>Coming soon</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  iconBox: {
    width: 84, height: 84, borderRadius: 24,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24, fontFamily: Fonts.extraBold, color: Colors.text,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
    maxWidth: 280,
    marginBottom: 18,
  },
  comingSoon: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  comingSoonText: { color: '#fff', fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 0.4 },
});

export default MobileVideosScreen;
