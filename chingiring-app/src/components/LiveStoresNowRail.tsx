import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { fetchActiveStreams, type LiveStream } from '../screens/Buyer/LiveDiscoveryScreen';
import { liveGradient } from './LiveCard';

// Story-ring colours for the circular avatar border.
const RING: [string, string, string] = ['#F2685E', '#F5B301', '#8A5CF6'];

function LiveCircle({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const cover = stream.thumbnail || stream.storeLogoUrl;
  const grad = liveGradient(stream._id || stream.storeName || '');
  const initial = (stream.storeName || '?').trim().charAt(0).toUpperCase();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.lc, pressed && { opacity: 0.9 }]}>
      <LinearGradient colors={RING} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.ring}>
        <View style={st.face}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={grad} start={{ x: 0.25, y: 0 }} end={{ x: 0.75, y: 1 }} style={StyleSheet.absoluteFill}>
              <View style={st.initWrap}><Text style={st.init}>{initial}</Text></View>
            </LinearGradient>
          )}
        </View>
        <View style={st.badge}>
          <View style={st.badgeDot} />
          <Text style={st.badgeTxt}>LIVE</Text>
        </View>
      </LinearGradient>
      <Text style={st.name} numberOfLines={1}>{stream.storeName}</Text>
    </Pressable>
  );
}

/** "Stores Live Now" — a horizontal rail of circular, live store avatars.
 *  Renders nothing when no store is live. */
export function LiveStoresNowRail() {
  const navigation = useNavigation<any>();
  const { data: streams = [] } = useQuery<LiveStream[]>({
    queryKey: ['streams', 'active'],
    queryFn: fetchActiveStreams,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  if (!streams.length) return null;

  return (
    <View style={st.sec}>
      <View style={st.head}>
        <Text style={st.title}>Stores Live Now</Text>
        <TouchableOpacity style={st.seeAll} activeOpacity={0.7} onPress={() => navigation.navigate('Stores')}>
          <Text style={st.seeAllTxt}>See all</Text>
          <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rail}>
        {streams.map((s, i) => (
          <LiveCircle
            key={s._id}
            stream={s}
            onPress={() => navigation.navigate('LiveFeed', { streams, startIndex: i })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sec: { marginTop: 6 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 18, marginBottom: 2,
  },
  title: { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  rail: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 14 },
  lc: { width: 70, alignItems: 'center', gap: 7 },
  ring: { width: 68, height: 68, borderRadius: 34, padding: 3, justifyContent: 'center', alignItems: 'center' },
  face: {
    width: '100%', height: '100%', borderRadius: 32, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.background, backgroundColor: '#1F2430',
  },
  initWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  init: { color: '#fff', fontSize: 22, fontFamily: Fonts.extraBold },
  badge: {
    position: 'absolute', bottom: -3, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F2685E', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1.5, borderColor: Colors.background,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  badgeTxt: { color: '#fff', fontSize: 8.5, fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  name: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.text, maxWidth: 70, textAlign: 'center' },
});
