/**
 * MyStoreScreen — "My Store" tab for sellers.
 *
 * Fetches the seller's store via GET /api/stores/mine and shows:
 *   - Store header (logo, name, category badge, verification badge, stats)
 *   - Verification status banner → links to StoreVerificationScreen
 *   - Product grid (GET /api/products?storeId=). Tap a card to edit, or the
 *     FAB / empty-state button to add — via the seller-scoped write endpoints
 *     (productsAPI.createMine / updateMine / deleteMine), in ProductFormSheet.
 *   - "Set up store" empty state if GET /stores/mine returns 404
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  BadgeCheck,
  Plus,
  Package,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { type SellerStore } from '../../api/verification';
import { useMyStore } from '../../hooks/useMyStore';
import { productsAPI, type Product } from '../../api/products';
import apiClient from '../../api/client';
import { ProductFormSheet } from './ProductFormSheet';

async function fetchStoreStats(storeId: string): Promise<{ totalStreams: number }> {
  try {
    const res = await apiClient.get(`/api/stores/${storeId}/stats`);
    return { totalStreams: res.data?.totalStreams ?? 0 };
  } catch {
    return { totalStreams: 0 };
  }
}

// ── Verification banner ─────────────────────────────────────────────────

const VerifBanner: React.FC<{ store: SellerStore; onVerify: () => void }> = ({ store, onVerify }) => {
  const status = store.verificationStatus ?? 'unverified';
  if (status === 'verified') return null;

  const text =
    status === 'pending'
      ? 'Documents under review — 1–2 business days.'
      : status === 'rejected'
        ? (store.verificationDoc?.rejectionReason
            ? `Rejected: ${store.verificationDoc.rejectionReason}`
            : 'Verification rejected. Tap to resubmit.')
        : 'Verify your store to unlock live streaming.';

  return (
    <Pressable onPress={onVerify} style={styles.banner}>
      <Text style={styles.bannerText}>{text}</Text>
      <Text style={styles.bannerLink}>Verify →</Text>
    </Pressable>
  );
};

// ── Product card ───────────────────────────────────────────────────────────

const ProductGridCard: React.FC<{ product: Product; onPress: () => void }> = ({ product, onPress }) => (
  <Pressable style={styles.pCard} onPress={onPress}>
    <View style={styles.pImageBox}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.pImage} resizeMode="cover" />
      ) : (
        <View style={[styles.pImage, styles.pImageFallback]}>
          <Package size={28} color={Colors.textSecondary} />
        </View>
      )}
      <View style={[styles.stockBadge, product.isActive ? styles.stockBadgeIn : styles.stockBadgeOut]}>
        <Text style={[styles.stockBadgeText, !product.isActive && styles.stockBadgeTextOut]}>
          {product.isActive ? 'In Stock' : 'Out of Stock'}
        </Text>
      </View>
    </View>
    <View style={styles.pBody}>
      <Text style={styles.pName} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.pPrice}>₹{product.price.toLocaleString('en-IN')}</Text>
    </View>
  </Pressable>
);

// ── Main screen ───────────────────────────────────────────────────────────

export const MyStoreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    data: store,
    isLoading,
    isRefetching,
    refetch,
  } = useMyStore();

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['seller', 'storeProducts', store?._id],
    queryFn: () => productsAPI.getProducts({ storeId: store!._id, limit: 50 }),
    enabled: !!store?._id,
    staleTime: 60_000,
  });
  const products: Product[] = productsData?.data?.products ?? productsData?.products ?? [];

  const qc = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<Product | null>(null);
  const openCreate = () => { setEditProduct(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditProduct(p); setFormOpen(true); };
  const onProductSaved = () =>
    qc.invalidateQueries({ queryKey: ['seller', 'storeProducts', store?._id] });

  const { data: stats = { totalStreams: 0 } } = useQuery({
    queryKey: ['seller', 'stats', store?._id],
    queryFn: () => fetchStoreStats(store!._id),
    enabled: !!store?._id,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  // ── No store yet ──────────────────────────────────────────────────────
  if (!store) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Store size={52} color={Colors.border} />
        <Text style={styles.emptyTitle}>No store yet</Text>
        <Text style={styles.emptySub}>
          Complete your store setup to start selling and going live.
        </Text>
        <Pressable
          style={styles.setupBtn}
          onPress={() => navigation.navigate('BusinessOnboarding')}
        >
          <Text style={styles.setupBtnText}>Set up my store</Text>
        </Pressable>
      </View>
    );
  }

  const isVerified = store.verificationStatus === 'verified';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        numColumns={2}
        columnWrapperStyle={products.length ? styles.gridRow : undefined}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 90 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.orange]} tintColor={Colors.orange} />
        }
        renderItem={({ item }) => <ProductGridCard product={item} onPress={() => openEdit(item)} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            {/* ── Store header card ── */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                {store.logoUrl ? (
                  <Image source={{ uri: store.logoUrl }} style={styles.logo} resizeMode="cover" />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Text style={styles.logoInitial}>{(store.name ?? 'S')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                    {isVerified && <BadgeCheck size={18} color={Colors.primary} />}
                  </View>
                  <View style={styles.catRow}>
                    <View style={styles.catChip}>
                      <Text style={styles.catChipText}>{store.category}</Text>
                    </View>
                    {!!store.area && <Text style={styles.areaText} numberOfLines={1}>{store.area}</Text>}
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Text style={styles.statText}>{products.length} Products</Text>
                <Text style={styles.statDot}>·</Text>
                <Text style={styles.statText}>{(store.followerCount ?? 0).toLocaleString('en-IN')} Followers</Text>
                <Text style={styles.statDot}>·</Text>
                <Text style={styles.statText}>{stats.totalStreams} Streams</Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 4, marginTop: 12 }}>
              <VerifBanner store={store} onVerify={() => navigation.navigate('StoreVerification', { store })} />
            </View>

            <Text style={styles.sectionTitle}>Products</Text>
          </View>
        }
        ListEmptyComponent={
          productsLoading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.productsEmpty}>
              <Package size={56} color={Colors.textSecondary} />
              <Text style={styles.productsEmptyTitle}>Add your first product</Text>
              <Text style={styles.productsEmptySub}>Showcase what you sell during live streams</Text>
              <Pressable style={styles.addProductBtn} onPress={openCreate}>
                <Text style={styles.addProductBtnText}>Add Product</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* ── FAB ── */}
      <Pressable style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} accessibilityLabel="Add product">
        <Plus size={26} color="#fff" />
      </Pressable>

      <ProductFormSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        product={editProduct}
        onSaved={onProductSaved}
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12, backgroundColor: Colors.background,
  },

  header: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.backgroundGrey },
  logoFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  logoInitial: { color: Colors.orange, fontSize: 24, fontFamily: Fonts.extraBold },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  storeName: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy, flexShrink: 1 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  catChip: {
    backgroundColor: Colors.backgroundGrey, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  catChipText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.text },
  areaText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, flexShrink: 1 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  statDot: { color: Colors.textSecondary },

  banner: {
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE047', borderRadius: 10,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.text },
  bannerLink: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },

  sectionTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 16, marginBottom: 4, paddingHorizontal: 4 },

  gridRow: { gap: 12, paddingHorizontal: 4 },
  pCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 12,
  },
  pImageBox: { width: '100%', height: 120, backgroundColor: Colors.backgroundGrey, position: 'relative' },
  pImage: { width: '100%', height: '100%' },
  pImageFallback: { alignItems: 'center', justifyContent: 'center' },
  stockBadge: { position: 'absolute', top: 6, right: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  stockBadgeIn: { backgroundColor: Colors.orange },
  stockBadgeOut: { backgroundColor: '#E2E8F0' },
  stockBadgeText: { fontSize: 9, fontFamily: Fonts.bold, color: '#fff' },
  stockBadgeTextOut: { color: Colors.textSecondary },
  pBody: { padding: 10, gap: 4 },
  pName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text, lineHeight: 17 },
  pPrice: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.primary },

  productsEmpty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  productsEmptyTitle: { fontSize: 17, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 4 },
  productsEmptySub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary },
  addProductBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.orange, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 24,
  },
  addProductBtnText: { color: Colors.orange, fontSize: 14, fontFamily: Fonts.bold },

  fab: {
    position: 'absolute', right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },

  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  setupBtn: { marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32 },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
