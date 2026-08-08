import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Share2 } from 'lucide-react-native';
import { sharesAPI } from '../api/shares';

// Flat coins per completed share. Display-only — the real award is locked
// server-side; this mirrors AdminSettings.coinsPerShare's default, the same
// way COINS_PER_RUPEE mirrors coinsPerRupee on the wallet screens.
const COINS_PER_SHARE = 100;

// The daily earning loop, surfaced on both wallet screens: how many of today's
// shares are used, coins still on the table, and a jump to browse-and-share.
export function ShareToEarnCard() {
  const navigation = useNavigation<any>();
  const { data } = useQuery({ queryKey: ['shareQuota'], queryFn: sharesAPI.getQuota });

  const quota = data?.data ?? { usedToday: 0, remaining: 100, cap: 100 };
  const pct = quota.cap > 0 ? Math.min(100, Math.round((quota.usedToday / quota.cap) * 100)) : 0;
  const maxed = quota.remaining <= 0;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.iconChip}>
          <Share2 size={18} color="#2563eb" strokeWidth={2.2} />
        </View>
        <Text style={s.title}>Earn coins by sharing</Text>
      </View>

      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>
      <View style={s.metaRow}>
        <Text style={s.metaLeft}>{quota.usedToday} of {quota.cap} shares today</Text>
        <Text style={[s.metaRight, maxed && { color: '#94a3b8' }]}>
          {maxed ? 'Daily limit reached' : `+${(quota.remaining * COINS_PER_SHARE).toLocaleString('en-IN')} coins`}
        </Text>
      </View>

      <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
        <Share2 size={15} color="#ffffff" strokeWidth={2.2} />
        <Text style={s.ctaText}>Share a product</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#eef2f8' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconChip: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#e0edff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  track: { height: 8, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#3b82f6' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  metaLeft: { fontSize: 13, color: '#475569', fontWeight: '600' },
  metaRight: { fontSize: 13, color: '#16a34a', fontWeight: '800' },
  cta: { height: 46, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});
