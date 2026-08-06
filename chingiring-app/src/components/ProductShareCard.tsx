import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2 } from 'lucide-react-native';

// ─── Product share card ──────────────────────────────────────────────────────
// The signature Chingiringi block on the product detail page: reframes the
// share action emotionally ("your friends get the deal, you get 100 CR") and
// carries live social proof. Shared verbatim by the desktop + mobile screens.
//
// `sharedToday` is REAL (GET /api/shares/stats). The avatar cluster is
// DECORATIVE — fixed colored initials, not real users (see AV below) — so it
// never claims to identify who shared. The count is the honest signal; avatars
// are cosmetic and only appear alongside a count strong enough to read as proof.

const AV = [
  { i: 'A', c: '#fde68a' },
  { i: 'P', c: '#bfdbfe' },
  { i: 'R', c: '#fecaca' },
  { i: 'S', c: '#c7f0d8' },
];

// Below this many shares today, the count isn't convincing social proof, so we
// hide the count + avatars and show only the framing + button.
const PROOF_MIN = 5;

export function ProductShareCard({
  sharedToday = 0,
  sharesLeft,
  sharesCap,
  onShare,
}: {
  sharedToday?: number;
  sharesLeft?: number | null;
  sharesCap?: number | null;
  onShare: () => void;
}) {
  const showProof = sharedToday >= PROOF_MIN;
  const extra = Math.max(0, sharedToday - AV.length);

  return (
    <LinearGradient
      colors={['#3a6fd6', '#6fa0ee', '#91BDFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.card}
    >
      {showProof ? (
        <>
          <Text style={s.fire}>🔥 {sharedToday.toLocaleString('en-IN')} people shared this today</Text>
          <View style={s.avs}>
            {AV.map((a, idx) => (
              <View key={a.i} style={[s.av, { backgroundColor: a.c, marginLeft: idx === 0 ? 0 : -8 }]}>
                <Text style={s.avT}>{a.i}</Text>
              </View>
            ))}
            {extra > 0 ? (
              <View style={[s.av, s.avMore]}>
                <Text style={s.avMoreT}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={s.head}>Your friends get the deal.{'\n'}You get 100 CR.</Text>

      <TouchableOpacity activeOpacity={0.9} onPress={onShare} style={s.btn}>
        <Share2 size={16} color="#1e4fa0" strokeWidth={2.6} />
        <Text style={s.btnT}>Share &amp; Earn 100 CR</Text>
      </TouchableOpacity>

      {sharesLeft != null ? (
        <Text style={s.hint}>{sharesLeft}/{sharesCap} shares left today</Text>
      ) : null}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  fire: { color: '#fff', fontSize: 12.5, fontWeight: '800', opacity: 0.96 },
  avs: { flexDirection: 'row', marginTop: 10, marginBottom: 2 },
  av: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  avT: { fontSize: 12, fontWeight: '800', color: '#1e3a6d' },
  avMore: { backgroundColor: 'rgba(255,255,255,0.25)', marginLeft: -8 },
  avMoreT: { fontSize: 10, fontWeight: '800', color: '#fff' },
  head: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 21, letterSpacing: -0.2, marginTop: 8, marginBottom: 12 },
  btn: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnT: { color: '#1e4fa0', fontSize: 14.5, fontWeight: '800', letterSpacing: 0.2 },
  hint: { color: 'rgba(255,255,255,0.9)', fontSize: 11.5, textAlign: 'center', marginTop: 9 },
});

export default ProductShareCard;
