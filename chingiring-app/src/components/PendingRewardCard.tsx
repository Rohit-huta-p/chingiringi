import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, CheckCircle2 } from 'lucide-react-native';

// Pending share-reward card — the coins earned when a friend opens a shared
// product/store link that haven't unlocked (confirmed) yet. Mirrors the
// "Pending" card on the Profile screens; amber = waiting, matching the
// withdrawal "Under review" language used elsewhere in the wallet.
//
// `pending`/`confirmed` are COIN sums (shareRewards.* from GET /api/wallet),
// so they render as "CR", never ₹.
//
// States (preserves the old ShareRewardsSummary behaviour):
//   pending > 0            → amber PENDING hero (+ confirmed chip if any)
//   pending 0, confirmed>0 → green "earned from shares" card
//   both 0                 → nothing
export function PendingRewardCard({ pending, confirmed = 0 }: { pending: number; confirmed?: number }) {
  if (!pending && !confirmed) return null;

  if (!pending) {
    // Confirmed-only: coins already landed in the balance.
    return (
      <View style={[s.card, s.cardGreen]}>
        <View style={[s.iconBox, s.iconGreen]}>
          <CheckCircle2 size={18} color="#fff" strokeWidth={2.6} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, s.eyebrowGreen]}>EARNED FROM SHARES</Text>
          <Text style={[s.amount, s.amountGreen]}>{confirmed.toLocaleString('en-IN')} CR</Text>
          <Text style={[s.sub, s.subGreen]}>Added to your coin balance</Text>
        </View>
      </View>
    );
  }

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
  cardGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGreen: { backgroundColor: '#16a34a' },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#b45309', letterSpacing: 1 },
  eyebrowGreen: { color: '#15803d' },
  amount: { fontSize: 20, fontWeight: '800', color: '#7a4406', marginTop: 1, fontVariant: ['tabular-nums'] },
  amountGreen: { color: '#14532d' },
  sub: { fontSize: 12, color: '#9a6412', marginTop: 2 },
  subGreen: { color: '#4d7c5a' },
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
