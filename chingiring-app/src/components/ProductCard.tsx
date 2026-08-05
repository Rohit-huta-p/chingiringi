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
  const lowStock = product.stock > 0 && product.stock <= 10;
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
        {lowStock && (
          <View style={s.stockBadge}>
            <Text style={s.stockBadgeText}>{product.stock} left</Text>
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{product.name}</Text>
        <Text style={s.cardPrice}>{priceFmt(product.price)}</Text>
        <View style={s.coinsPill}>
          <Coins size={10} color={Colors.primary} />
          <Text style={s.coinsPillText}>{product.coinsPrice.toLocaleString('en-IN')} coins</Text>
        </View>
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
  stockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.danger,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stockBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.bold },
  cardBody: { padding: 7, gap: 2 },
  cardTitle: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.text },
  cardPrice: { fontSize: 13, fontFamily: Fonts.extraBold, color: Colors.text, marginTop: 1 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight10,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coinsPillText: { fontSize: 10.5, fontFamily: Fonts.semiBold, color: Colors.primary },
});
