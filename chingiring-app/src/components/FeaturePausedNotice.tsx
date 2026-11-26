import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PauseCircle } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * Small "this feature is paused" banner. Used two ways:
 *   • tone="light" — inline on seller/admin create screens, showing the backend's
 *     "please upgrade the <provider> plan" message.
 *   • tone="dark"  — on the dark buyer feed / live viewer, showing friendly copy.
 */
export const FeaturePausedNotice: React.FC<{ message: string; tone?: 'light' | 'dark' }> = ({
  message,
  tone = 'light',
}) => {
  const dark = tone === 'dark';
  return (
    <View style={[styles.wrap, dark ? styles.wrapDark : styles.wrapLight]}>
      <PauseCircle size={18} color={dark ? '#fff' : Colors.orange} strokeWidth={2.2} />
      <Text style={[styles.text, dark && styles.textDark]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  wrapLight: { backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)' },
  wrapDark: { backgroundColor: 'rgba(255,255,255,0.10)' },
  text: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: Fonts.medium, color: Colors.text },
  textDark: { color: '#fff' },
});

export default FeaturePausedNotice;
