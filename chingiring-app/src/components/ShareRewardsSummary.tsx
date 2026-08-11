import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ShareRewardsSummary({ pending, confirmed }: { pending: number; confirmed: number }) {
  if (!pending && !confirmed) return null;
  return (
    <View style={s.wrap}>
      {pending > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Pending</Text>
          <Text style={[s.val, { color: '#f79009' }]}>{pending.toLocaleString('en-IN')} CR</Text>
          <Text style={s.hint}>unlocks when friends open your links</Text>
        </View>
      )}
      {confirmed > 0 && (
        <View style={s.row}>
          <Text style={s.label}>Earned from shares</Text>
          <Text style={[s.val, { color: '#12b76a' }]}>{confirmed.toLocaleString('en-IN')} CR</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  val: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 11, color: '#94a3b8' },
});

export default ShareRewardsSummary;
