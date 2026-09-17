// Portrait live-stream card. Extracted from OfflineStoresScreen so both the
// Live-First feed rail and the "Live now — See all" grid render an identical card.
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import type { LiveStream } from '../screens/Buyer/LiveDiscoveryScreen';

// Deterministic 2-stop gradient per stream so placeholder covers look varied
// but stay stable across refetches.
const LIVE_GRADIENTS: string[][] = [
  ['#8A5A2B', '#241206'], // warm amber
  ['#3E5BA6', '#0E1A38'], // royal blue
  ['#7A3B8F', '#1E0E2E'], // violet
  ['#B5476B', '#2E0E1C'], // rose
  ['#2F8F7A', '#08211C'], // teal
  ['#A5533B', '#2A0F08'], // rust
  ['#3B7AA5', '#0A1E2E'], // steel
  ['#5A6B2F', '#171C08'], // olive
];

export function liveGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const g = LIVE_GRADIENTS[h % LIVE_GRADIENTS.length];
  return [g[0], g[1]];
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

export const LiveCard: React.FC<{
  stream: LiveStream;
  width: number;
  onPress: () => void;
}> = ({ stream, width, onPress }) => {
  const cover = stream.thumbnail || stream.storeLogoUrl;
  const grad = liveGradient(stream._id || stream.storeName || '');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.liveCard, { width, aspectRatio: 0.72 }, pressed && { opacity: 0.9 }]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={grad}
          start={{ x: 0.25, y: 0 }}
          end={{ x: 0.75, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Bottom scrim keeps the title/store legible over any cover */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.liveTag}>
        <View style={styles.liveTagDot} />
        <Text style={styles.liveTagText}>LIVE</Text>
      </View>
      {stream.viewerCount > 0 && (
        <View style={styles.views}>
          <Eye size={12} color="#fff" strokeWidth={2} />
          <Text style={styles.viewsText}>{formatViewers(stream.viewerCount)}</Text>
        </View>
      )}
      <View style={styles.liveTextWrap}>
        <Text style={styles.liveTitle} numberOfLines={2}>{stream.title}</Text>
        <Text style={styles.liveStore} numberOfLines={1}>{stream.storeName}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  liveCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1F2430',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  liveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F2685E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTagText: { fontSize: 10, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.6 },
  views: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewsText: { fontSize: 10.5, fontFamily: Fonts.bold, color: '#fff' },
  liveTextWrap: { padding: 12, gap: 2 },
  liveTitle: { fontSize: 15, lineHeight: 19, fontFamily: Fonts.bold, color: '#fff' },
  liveStore: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.82)' },
});

export default LiveCard;
