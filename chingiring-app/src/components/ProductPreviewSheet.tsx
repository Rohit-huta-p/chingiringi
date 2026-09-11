import React from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet, Image,
  ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { X, Pencil, Link2, MessageCircle, Package } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { productsAPI, type Product } from '../api/products';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Product to preview; fetched fresh by id, with `initial` for instant paint. */
  productId?: string;
  initial?: Partial<Product> | null;
  /** When provided, a small "Edit" affordance opens the edit form with the product. */
  onEdit?: (product: Product) => void;
}

/**
 * ProductPreviewSheet — read-only product preview in a bottom sheet.
 *
 * Used by My Store (tap a product → preview, with Edit) and the chat thread
 * (seller taps a product card → quick view). Fetches the full product by id so
 * a chat snapshot (name/image/price only) still shows complete details.
 */
export const ProductPreviewSheet: React.FC<Props> = ({ visible, onClose, productId, initial, onEdit }) => {
  const insets = useSafeAreaInsets();

  const { data } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsAPI.getProduct(productId as string),
    enabled: visible && !!productId,
    staleTime: 30_000,
  });

  const p: any = data?.data?.product || data?.data || initial || null;

  const price = Number(p?.price ?? 0);
  const mrp = Number(p?.mrp ?? 0);
  const off = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const img: string | undefined = p?.imageUrl || p?.images?.[0];

  const openBuyLink = () => {
    const raw = p?.affiliateUrl;
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel="Close preview" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.hBtn} accessibilityLabel="Close">
              <X size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.hTitle}>Product</Text>
            {onEdit && p ? (
              <Pressable onPress={() => onEdit(p as Product)} style={styles.editBtn} accessibilityLabel="Edit product">
                <Pencil size={14} color={Colors.orange} />
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : (
              <View style={styles.hBtn} />
            )}
          </View>

          {!p ? (
            <View style={styles.center}><ActivityIndicator color={Colors.orange} /></View>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imageFallback]}>
                <Package size={40} color={Colors.textSecondary} />
              </View>
            )}

            <Text style={styles.name}>{p.name}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{price.toLocaleString('en-IN')}</Text>
              {mrp > price ? <Text style={styles.mrp}>₹{mrp.toLocaleString('en-IN')}</Text> : null}
              {off ? <Text style={styles.off}>{off}% off</Text> : null}
            </View>

            {typeof p.isActive === 'boolean' ? (
              <View style={[styles.badge, p.isActive ? styles.badgeIn : styles.badgeOut]}>
                <Text style={[styles.badgeText, !p.isActive && styles.badgeTextOut]}>
                  {p.isActive ? 'In stock' : 'Out of stock'}
                </Text>
              </View>
            ) : null}

            {p.description ? (
              <View style={styles.sec}>
                <Text style={styles.secLabel}>Description</Text>
                <Text style={styles.desc}>{p.description}</Text>
              </View>
            ) : null}

            <View style={styles.sec}>
              <Text style={styles.secLabel}>How buyers order</Text>
              {p.affiliateUrl ? (
                <Pressable style={styles.methodRow} onPress={openBuyLink}>
                  <Link2 size={15} color={Colors.primary} />
                  <Text style={[styles.methodText, { color: Colors.primary }]} numberOfLines={1}>
                    {String(p.affiliateUrl).replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                  </Text>
                </Pressable>
              ) : null}
              {p.buyViaChat ? (
                <View style={styles.methodRow}>
                  <MessageCircle size={15} color={Colors.primary} />
                  <Text style={styles.methodText}>Buyers can order via chat.</Text>
                </View>
              ) : null}
              {!p.affiliateUrl && !p.buyViaChat ? (
                <Text style={styles.methodText}>Display-only — no buy link or chat set.</Text>
              ) : null}
            </View>
          </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ProductPreviewSheet;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '92%', overflow: 'hidden',
  },
  scroll: { flexShrink: 1 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.border, marginTop: 8, marginBottom: 2 },
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 2, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hBtn: { width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: Fonts.bold, color: Colors.navy },
  editBtn: {
    width: 60, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    paddingRight: 8,
  },
  editText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.orange },

  body: { padding: 16, gap: 12 },
  image: { width: '100%', height: 260, borderRadius: 14, backgroundColor: Colors.backgroundGrey },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.navy, lineHeight: 26 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.primary },
  mrp: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  off: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.success },

  badge: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  badgeIn: { backgroundColor: 'rgba(249,115,22,0.12)' },
  badgeOut: { backgroundColor: '#E2E8F0' },
  badgeText: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.orange },
  badgeTextOut: { color: Colors.textSecondary },

  sec: { gap: 6, marginTop: 4 },
  secLabel: {
    fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  desc: { fontSize: 14.5, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 21 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodText: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text },
});
