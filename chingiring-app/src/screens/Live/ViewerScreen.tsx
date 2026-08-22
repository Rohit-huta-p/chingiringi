/**
 * ViewerScreen — placeholder until Day-5 Agent D2 wires up Daily.co.
 * Navigated to from LiveDiscoveryScreen when a StreamCard is tapped.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Radio } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';

export const ViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { streamId, storeName } = route.params ?? {};

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
        <ChevronLeft size={24} color="#fff" />
      </Pressable>

      <View style={styles.center}>
        <Radio size={48} color={Colors.orange} />
        <Text style={styles.live}>LIVE</Text>
        <Text style={styles.store}>{storeName ?? 'Live Stream'}</Text>
        <Text style={styles.sub}>Viewer screen coming in Sprint 3.</Text>
        <Text style={styles.streamId}>Stream: {streamId}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  back: {
    position: 'absolute', top: 52, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  live: { color: Colors.orange, fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 3, textTransform: 'uppercase' },
  store: { color: '#fff', fontSize: 22, fontFamily: Fonts.extraBold, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
  streamId: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: Fonts.regular, marginTop: 8 },
});
