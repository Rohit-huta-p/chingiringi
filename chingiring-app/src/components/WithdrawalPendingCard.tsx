import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';

// Withdrawal "Under review" summary — money the user asked to cash out that is
// still with us (admin payout is manual). Counterpart to PendingRewardCard:
// same amber "waiting", but money OUT (₹) instead of rewards IN (CR).
//
// `total` is a ₹ sum, `count` the number of withdrawals awaiting/processing
// (pendingWithdrawals from GET /api/wallet). Renders nothing when count is 0.
export function WithdrawalPendingCard({ total, count }: { total: number; count: number }) {
  if (!count) return null;
  const rupees = (total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return (
    <View style={s.card}>
      <View style={s.iconBox}>
        <ArrowUpRight size={18} color="#fff" strokeWidth={2.6} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>UNDER REVIEW</Text>
        <Text style={s.amount}>₹{rupees}</Text>
        <Text style={s.sub}>
          {count === 1 ? '1 withdrawal' : `${count} withdrawals`} · usually paid within 24h
        </Text>
      </View>
      <View style={s.eta}>
        <Text style={s.etaTxt}>~24h</Text>
      </View>
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
  eta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  etaTxt: { fontSize: 11, fontWeight: '800', color: '#b45309' },
});

export default WithdrawalPendingCard;
