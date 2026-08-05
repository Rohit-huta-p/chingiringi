import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Coins } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import type { Product } from '../api/products';

// ─── Helpers ────────────────────────────────────────────────────────────────

function priceFmt(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Product Card ─────────────────────────────────────────────────────────────

export function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  // Grid is square (1:1) → desktop 1:1 photos are the correct fit. Fall back to a
  // mobile photo only so the card isn't blank when desktop photos are missing
  // (mobile photos are 4:3 landscape → center-cropped here; fallback, not primary).
  const gridImage = product.imageUrl || product.mobileImages?.[0] || product.mobileImageUrl;
  return (
    <TouchableOpacity style={[s.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardImageBox}>
        {gridImage ? (
          <Image source={{ uri: gridImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, s.cardImageFallback]}>
            <Text style={s.cardImageLetter}>{product.name?.[0] ?? '?'}</Text>
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{product.name}</Text>
        {product.description ? (
          <Text style={s.cardDesc} numberOfLines={1}>{product.description}</Text>
        ) : null}
        <Text style={s.cardPrice}>{priceFmt(product.price)}</Text>
        {product.coinsPrice > 0 ? (
          <View style={s.coinsPill}>
            <Coins size={10} color={Colors.primary} />
            <Text style={s.coinsPillText}>{product.coinsPrice.toLocaleString('en-IN')} coins</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.background,
  },
  cardImageFallback: { justifyContent: 'center', alignItems: 'center' },
  cardImageLetter: { fontSize: 28, fontFamily: Fonts.extraBold, color: Colors.primaryLight },
  cardBody: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 11 },
  cardTitle: { fontSize: 12.5, lineHeight: 16, fontFamily: Fonts.bold, color: Colors.text },
  cardDesc: { fontSize: 11, lineHeight: 14, marginTop: 2, fontFamily: Fonts.regular, color: Colors.textSecondary },
  cardPrice: { fontSize: 13.5, fontFamily: Fonts.extraBold, color: Colors.text, marginTop: 7 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: Colors.primaryLight10,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coinsPillText: { fontSize: 10.5, fontFamily: Fonts.semiBold, color: Colors.primary },
});
