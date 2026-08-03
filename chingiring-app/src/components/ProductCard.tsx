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
  return (
    <TouchableOpacity style={[s.card, { width }]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardImageBox}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
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
        <Text style={s.cardDesc} numberOfLines={2}>{product.description}</Text>
        <Text style={s.cardPrice}>{priceFmt(product.price)}</Text>
        <View style={s.coinsPill}>
          <Coins size={11} color={Colors.primary} />
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
    borderRadius: 16,
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
  cardImageLetter: { fontSize: 32, fontFamily: Fonts.extraBold, color: Colors.primaryLight },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockBadgeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.bold },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  cardDesc: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, minHeight: 28 },
  cardPrice: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.text, marginTop: 2 },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coinsPillText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.primary },
});
