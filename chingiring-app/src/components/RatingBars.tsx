import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ratingBars } from '../utils/product';
import { Colors } from '../constants/theme';

// 5→1 star breakdown bars, computed from the loaded in-app reviews. Shared by
// the desktop + mobile detail screens. Gate on a minimum review count at the
// call site (percentages are of the loaded set, not the full corpus).
export function RatingBars({ reviews }: { reviews: { rating: number }[] }) {
  const bars = ratingBars(reviews);
  return (
    <View style={s.wrap}>
      {bars.map((b) => (
        <View key={b.star} style={s.row}>
          <Text style={s.lab}>{b.star}★</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${b.pct}%` }]} />
          </View>
          <Text style={s.pct}>{b.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lab: { width: 26, textAlign: 'right', fontSize: 11.5, color: Colors.textSecondary, fontWeight: '600' },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#eef2f7', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 4 },
  pct: { width: 34, fontSize: 11.5, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
});

export default RatingBars;
