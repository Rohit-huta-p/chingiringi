import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

/**
 * Dedicated header for the Profile tab. Visually distinct from
 * MobileAuthHeader (centred avatar + name + edit pencil, no back button, no
 * kicker) per Figma 235:4012. Kept separate so the shared MobileAuthHeader
 * stays uniform across every other screen.
 */
interface Props {
  name: string;
  avatarUrl?: string;
  onEditPress: () => void;
}

// Mirrors MobileAuthHeader so both gradients match.
const HEADER_GRADIENT_COLORS: readonly [string, string, string] =
  ['#1E3A8A', '#4784E2', '#91BDFF'];
const HEADER_GRADIENT_LOCATIONS: readonly [number, number, number] = [0, 0.6, 1];

function initialsFor(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const MobileProfileHeader: React.FC<Props> = ({ name, avatarUrl, onEditPress }) => {
  return (
    <LinearGradient
      colors={HEADER_GRADIENT_COLORS}
      locations={HEADER_GRADIENT_LOCATIONS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Decorative blobs */}
        <View style={styles.blobLeft} pointerEvents="none" />
        <View style={styles.blobRight} pointerEvents="none" />

        {/* Edit pencil top-right */}
        <TouchableOpacity
          style={styles.editBtn}
          activeOpacity={0.85}
          onPress={onEditPress}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Pencil size={16} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Centered avatar + name */}
        <View style={styles.center}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initialsFor(name)}</Text>
              )}
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{name || 'Guest'}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  safe: {
    paddingTop: 8,
    paddingBottom: 24,
    position: 'relative',
  },
  blobLeft: {
    position: 'absolute',
    top: -30, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blobRight: {
    position: 'absolute',
    top: 40, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  editBtn: {
    position: 'absolute',
    top: 16, right: 16,
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 2,
  },

  center: {
    alignItems: 'center',
    marginTop: 4,
  },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.28)',
    padding: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInner: {
    width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 28, fontFamily: Fonts.extraBold, color: Colors.primary },

  name: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    color: '#fff',
    marginTop: 12,
  },
});

export default MobileProfileHeader;
