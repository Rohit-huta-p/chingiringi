import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Coins, ChevronRight } from 'lucide-react-native';
import { Transaction } from '../api/wallet';

// Shared wallet transaction row — the mockup's card style (white rounded card,
// tinted icon box, title + time + status pill, amount + chevron). Used by both
// WalletScreen and MobileWalletScreen so the two stay identical.

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// User-facing label for a withdrawal's admin-review status.
function wdStatus(status?: string): string {
  return status === 'pending' ? 'Under review'
    : status === 'processing' ? 'Processing'
    : status === 'completed' ? 'Paid'
    : status === 'rejected' ? 'Rejected'
    : (status || '');
}

// Amber = under review, blue = processing, green = paid, red = rejected.
function wdStatusColor(status?: string): { text: string; bg: string } {
  return status === 'pending' ? { text: '#b45309', bg: '#fef3c7' }
    : status === 'processing' ? { text: '#2563eb', bg: '#dbeafe' }
    : status === 'completed' ? { text: '#16a34a', bg: '#dcfce7' }
    : status === 'rejected' ? { text: '#dc2626', bg: '#fee2e2' }
    : { text: '#64748b', bg: '#f1f5f9' };
}

export function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const isCoin = tx.type === 'coin_credit' || tx.type === 'coin_debit';
  const isOut = tx.type === 'withdrawal' || tx.type === 'coin_debit';
  const title = tx.metadata?.brand || tx.description;

  // Icon box: withdrawals take their status colour; coins/other income are green.
  let iconBg = '#dcfce7';
  let iconColor = '#16a34a';
  let Icon: any = ArrowDownLeft;
  if (tx.type === 'withdrawal') {
    const sc = wdStatusColor(tx.status);
    iconBg = sc.bg; iconColor = sc.text; Icon = ArrowUpRight;
  } else if (tx.type === 'coin_debit') {
    iconBg = '#fef2f2'; iconColor = '#ef4444'; Icon = Coins;
  } else if (tx.type === 'coin_credit') {
    Icon = Coins;
  }

  // Amount: coins in violet, withdrawals in red, other income in green.
  const amtColor = isCoin ? '#7c3aed' : tx.type === 'withdrawal' ? '#ef4444' : '#16a34a';
  const amtText = `${isOut ? '-' : '+'}${isCoin ? tx.amount + ' coins' : '₹' + tx.amount}`;

  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress} disabled={!onPress}>
      <View style={[s.ic, { backgroundColor: iconBg }]}>
        <Icon size={16} color={iconColor} strokeWidth={2.4} />
      </View>
      <View style={s.mid}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.time}>{timeAgo(tx.createdAt)}</Text>
        {tx.type === 'withdrawal' ? (
          <View style={[s.pill, { backgroundColor: wdStatusColor(tx.status).bg }]}>
            <Text style={[s.pillTxt, { color: wdStatusColor(tx.status).text }]}>{wdStatus(tx.status)}</Text>
          </View>
        ) : null}
      </View>
      <View style={s.right}>
        <Text style={[s.amt, { color: amtColor }]} numberOfLines={1}>{amtText}</Text>
        <ChevronRight size={16} color="#cbd5e1" strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8ecf2',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  ic: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  time: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  pill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5 },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amt: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

export default TransactionRow;
