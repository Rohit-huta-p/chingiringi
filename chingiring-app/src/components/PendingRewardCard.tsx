import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';

// Pending share-reward card — coins earned when a friend opens a shared
// product/store link that haven't unlocked (confirmed) yet. Amber = waiting,
// matching the withdrawal "Under review" language used elsewhere in the wallet.
//
// Shows ONLY while something is pending. Confirmed coins already sit in the
// balance, so there's no separate card for them — that green "Earned from
// shares" state wasn't in the mockup and just added clutter.
//
// `pending`/`confirmed` are COIN sums (shareRewards.* from GET /api/wallet),
// so they render as "CR", never ₹.
export function PendingRewardCard({ pending, confirmed = 0 }: { pending: number; confirmed?: number }) {
  if (!pending) return null;

  return (
    <View style={s.card}>
      <View style={s.iconBox}>
        <Clock size={18} color="#fff" strokeWidth={2.6} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>PENDING</Text>
        <Text style={s.amount}>{pending.toLocaleString('en-IN')} CR</Text>
        <Text style={s.sub}>Processing · unlocks when friends open your links</Text>
      </View>
      {confirmed > 0 ? (
        <View style={s.chip}>
          <Text style={s.chipTxt}>+{confirmed.toLocaleString('en-IN')} earned</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#b45309', letterSpacing: 1 },
  amount: { fontSize: 20, fontWeight: '800', color: '#7a4406', marginTop: 1, fontVariant: ['tabular-nums'] },
  sub: { fontSize: 12, color: '#9a6412', marginTop: 2 },
  chip: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  chipTxt: { fontSize: 11, fontWeight: '800', color: '#16a34a' },
});

export default PendingRewardCard;
