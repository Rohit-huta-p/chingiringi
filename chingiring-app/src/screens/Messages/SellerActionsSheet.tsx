import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, Image, Pressable, ScrollView,
  TouchableOpacity, StyleSheet, Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { X, Tag, Link2, ChevronLeft, ChevronRight, Store as StoreIcon } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { productsAPI, type Product } from '../../api/products';
import { useMyStore } from '../../hooks/useMyStore';
import { useAuthStore } from '../../store';
import type { ChatProduct } from '../../api/chat';

/**
 * SellerActionsSheet — the seller's selling-actions bottom sheet, opened from a
 * chat thread's "+" / kebab. Backed entirely by real data:
 *   • Share a product   → attaches one of the seller's own products to the composer
 *   • Send an offer      → pick a product + a custom price → a live offer message
 *   • Share store link   → shares the storefront URL
 *
 * There is deliberately no "Reserve / hold stock" action — the product model has
 * no stock, so a hold can't be honoured.
 */
export const SellerActionsSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  buyerName: string;
  onAttachProduct: (p: ChatProduct) => void;
  onSendOffer: (p: ChatProduct, offerPrice: number) => void;
}> = ({ visible, onClose, buyerName, onAttachProduct, onSendOffer }) => {
  const insets = useSafeAreaInsets();
  const { data: store } = useMyStore();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['seller', 'storeProducts', store?._id],
    queryFn: () => productsAPI.getProducts({ storeId: store!._id, limit: 50 }),
    enabled: !!store?._id && visible,
    staleTime: 60_000,
  });
  const products: Product[] = productsData?.data?.products ?? productsData?.products ?? [];

  const [mode, setMode] = useState<'menu' | 'offer'>('menu');
  const [selected, setSelected] = useState<Product | null>(null);
  const [priceText, setPriceText] = useState('');

  // Reset to the menu each time the sheet reopens.
  useEffect(() => {
    if (visible) { setMode('menu'); setSelected(null); setPriceText(''); }
  }, [visible]);

  const firstName = buyerName.split(' ')[0] || buyerName;

  const toChatProduct = (p: Product): ChatProduct => ({
    productId: p._id,
    name: p.name,
    imageUrl: p.imageUrl || p.mobileImageUrl || p.images?.[0],
    price: p.price,
  });

  const offerPrice = useMemo(() => {
    const n = Number(priceText.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [priceText]);
  const priceValid = !!selected && offerPrice > 0 && offerPrice < (selected.price || Infinity);

  const shareStore = async () => {
    if (!store?._id) return;
    const base = process.env.EXPO_PUBLIC_SHARE_BASE || 'https://chingiringi-backend.onrender.com';
    const url = `${base}/s/store/${store._id}?ref=cr_${userId ?? ''}`;
    onClose();
    try {
      await Share.share({ message: `Check out ${store.name || 'my store'} on Chingiringi 🛍️\n${url}`, url });
    } catch { /* cancelled — ignore */ }
  };

  const ProductCard = ({ p, onPress, active }: { p: Product; onPress: () => void; active?: boolean }) => (
    <TouchableOpacity style={styles.pCard} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.pImgWrap, active && styles.pImgActive]}>
        {p.imageUrl ? (
          <Image source={{ uri: p.imageUrl }} style={styles.pImg} />
        ) : (
          <View style={[styles.pImg, styles.pImgFallback]} />
        )}
      </View>
      <Text style={styles.pName} numberOfLines={1}>{p.name}</Text>
      <Text style={styles.pPrice}>₹{(p.price ?? 0).toLocaleString('en-IN')}</Text>
    </TouchableOpacity>
  );

  const ProductStrip = ({ onPick, activeId }: { onPick: (p: Product) => void; activeId?: string }) => {
    if (isLoading) return <View style={styles.stripLoading}><ActivityIndicator color={Colors.orange} /></View>;
    if (products.length === 0) {
      return <Text style={styles.emptyProducts}>No products yet — add items in My Store to share them here.</Text>;
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {products.map((p) => (
          <ProductCard key={p._id} p={p} active={activeId === p._id} onPress={() => onPick(p)} />
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.head}>
            {mode === 'offer' ? (
              <TouchableOpacity style={styles.headBack} onPress={() => setMode('menu')} accessibilityLabel="Back">
                <ChevronLeft size={22} color={Colors.navy} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.headTitle}>{mode === 'offer' ? 'Send an offer' : `Send to ${firstName}`}</Text>
            <TouchableOpacity style={styles.headClose} onPress={onClose} accessibilityLabel="Close">
              <X size={16} color={Colors.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {mode === 'menu' ? (
            <>
              <Text style={styles.sectionLabel}>SHARE A PRODUCT</Text>
              <ProductStrip onPick={(p) => onAttachProduct(toChatProduct(p))} />

              <View style={styles.divider} />

              <TouchableOpacity style={styles.action} activeOpacity={0.7} onPress={() => setMode('offer')}>
                <View style={styles.actionIcon}><Tag size={20} color={Colors.orange} strokeWidth={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Send an offer</Text>
                  <Text style={styles.actionSub}>Offer a custom price on an item</Text>
                </View>
                <ChevronRight size={17} color="#cbd5e1" strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.action} activeOpacity={0.7} onPress={shareStore}>
                <View style={styles.actionIcon}><Link2 size={20} color={Colors.orange} strokeWidth={2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Share store link</Text>
                  <Text style={styles.actionSub}>Send your storefront to {firstName}</Text>
                </View>
                <ChevronRight size={17} color="#cbd5e1" strokeWidth={2} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>PICK AN ITEM</Text>
              <ProductStrip onPick={setSelected} activeId={selected?._id} />

              {selected ? (
                <View style={styles.offerForm}>
                  <View style={styles.offerFormRow}>
                    <Text style={styles.offerFormLabel} numberOfLines={1}>{selected.name}</Text>
                    <Text style={styles.offerFormWas}>List ₹{(selected.price ?? 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.priceCurrency}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={priceText}
                      onChangeText={setPriceText}
                      placeholder="Your offer price"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="number-pad"
                      autoFocus
                    />
                  </View>
                  {offerPrice > 0 && selected.price && offerPrice >= selected.price ? (
                    <Text style={styles.offerHint}>Offer should be below the list price of ₹{selected.price.toLocaleString('en-IN')}.</Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.sendOfferBtn, !priceValid && styles.sendOfferBtnDisabled]}
                    disabled={!priceValid}
                    activeOpacity={0.85}
                    onPress={() => selected && onSendOffer(toChatProduct(selected), offerPrice)}
                  >
                    <Tag size={16} color="#fff" strokeWidth={2.4} />
                    <Text style={styles.sendOfferText}>Send offer to {firstName}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickHint}>
                  <StoreIcon size={18} color={Colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.pickHintText}>Choose a product above to set a custom price.</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,26,61,0.45)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 4, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  headBack: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 4, marginLeft: -6 },
  headTitle: { flex: 1, fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.navy },
  headClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.textSecondary, letterSpacing: 0.4, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 2 },

  strip: { gap: 10, paddingHorizontal: 18, paddingVertical: 8 },
  stripLoading: { height: 118, alignItems: 'center', justifyContent: 'center' },
  emptyProducts: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, paddingHorizontal: 18, paddingVertical: 16, lineHeight: 19 },
  pCard: { width: 92 },
  pImgWrap: { width: 92, height: 92, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  pImgActive: { borderColor: Colors.orange },
  pImg: { width: '100%', height: '100%', borderRadius: 10 },
  pImgFallback: { backgroundColor: Colors.border },
  pName: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.navy, marginTop: 5 },
  pPrice: { fontSize: 11.5, fontFamily: Fonts.bold, color: Colors.navy },

  divider: { height: 1, backgroundColor: Colors.background, marginHorizontal: 18, marginVertical: 6 },

  action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14.5, fontFamily: Fonts.bold, color: Colors.navy },
  actionSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },

  offerForm: { paddingHorizontal: 18, paddingTop: 6 },
  offerFormRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  offerFormLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy },
  offerFormWas: { fontSize: 12.5, fontFamily: Fonts.medium, color: Colors.textSecondary },
  priceInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, height: 48,
  },
  priceCurrency: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.navy },
  priceInput: { flex: 1, fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.navy, padding: 0 },
  offerHint: { fontSize: 11.5, fontFamily: Fonts.regular, color: '#EF4444', marginTop: 6 },
  sendOfferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.orange, borderRadius: 14, height: 50, marginTop: 14,
  },
  sendOfferBtnDisabled: { backgroundColor: Colors.orange, opacity: 0.4 },
  sendOfferText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },

  pickHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 18 },
  pickHintText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 19 },
});
