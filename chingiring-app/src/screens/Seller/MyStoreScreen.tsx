/**
 * MyStoreScreen — "My Store" tab for sellers.  (Redesign: "Shelf")
 *
 * Fetches the seller's store (GET /api/stores/mine) and its products
 * (GET /api/products?storeId=) and renders:
 *   - Compact navy header: logo + name (+ verified check) + product count,
 *     with an edit-store pencil → EditStoreDetails
 *   - Verification banner (links to StoreVerification if unverified)
 *   - Search + the shared ProductControlsBar (sort / filter)
 *   - A single-column product list (thumbnail · name · price + MRP/discount ·
 *     rating). Tap a row to preview → edit; the FAB / empty-state button adds.
 *   - "Set up store" empty state if GET /stores/mine returns 404
 *
 * (Stock and "featured" cues are intentionally not surfaced here.)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Plus,
  Package,
  Search,
  MoreVertical,
  BadgeCheck,
  Pencil,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { type SellerStore } from '../../api/verification';
import { useMyStore } from '../../hooks/useMyStore';
import { productsAPI, type Product } from '../../api/products';
import { discountPct } from '../../utils/product';
import {
  applyProductControls,
  isControlsActive,
  DEFAULT_CONTROLS,
  type ProductControlsState,
} from '../../utils/productFilters';
import { ProductControlsBar } from '../../components/ProductControlsBar';
import { ProductFormSheet } from './ProductFormSheet';
import { ProductPreviewSheet } from '../../components/ProductPreviewSheet';

// The seller tab bar is position:absolute and overlays content — pad the list
// (and float the FAB) past it. ~64px bar + chrome + gap; insets added on top.
const TAB_BAR_CLEARANCE = 90;

const inr = (n: number) => (n ?? 0).toLocaleString('en-IN');

// ── Product row ─────────────────────────────────────────────────────────────

const ProductRow: React.FC<{ product: Product; onPress: () => void }> = ({ product, onPress }) => {
  const hasMrp = !!product.mrp && product.mrp > product.price;
  const disc = hasMrp ? discountPct(product.mrp, product.price) : null;
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={product.name}>
      <View style={styles.thumb}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbImg, styles.thumbFallback]}>
            <Package size={24} color={Colors.textSecondary} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{inr(product.price)}</Text>
          {hasMrp ? <Text style={styles.mrp}>₹{inr(product.mrp!)}</Text> : null}
          {disc && disc > 0 ? <Text style={styles.disc}>{disc}% off</Text> : null}
        </View>
        {product.rating ? (
          <Text style={styles.rating}>★ {product.rating}{product.ratingCount ? ` (${inr(product.ratingCount)})` : ''}</Text>
        ) : null}
      </View>

      <View style={styles.kebab}>
        <MoreVertical size={18} color={Colors.textSecondary} />
      </View>
    </Pressable>
  );
};

// ── Verification banner ─────────────────────────────────────────────────────

const VerifBanner: React.FC<{ store: SellerStore; onVerify: () => void }> = ({ store, onVerify }) => {
  const status = store.verificationStatus ?? 'unverified';
  if (status === 'verified') return null;

  const text =
    status === 'pending'
      ? 'Your documents are under review'
      : status === 'rejected'
        ? `Verification rejected${store.verificationDoc?.rejectionReason ? ` — ${store.verificationDoc.rejectionReason}` : ''}`
        : "Your store isn't verified yet — going live is locked";

  return (
    <Pressable onPress={onVerify} style={[styles.banner, status === 'rejected' && styles.bannerRejected]}>
      <Text style={styles.bannerText} numberOfLines={2}>{text}</Text>
      <Text style={styles.bannerLink}>View details →</Text>
    </Pressable>
  );
};

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

  // Search + sort/filter (the shared controls run client-side over the loaded list).
  const [search, setSearch] = React.useState('');
  const [controls, setControls] = React.useState<ProductControlsState>(DEFAULT_CONTROLS);
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = q ? products.filter((p) => p.name?.toLowerCase().includes(q)) : products;
    return applyProductControls(searched, controls);
  }, [products, search, controls]);

  const qc = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = React.useState<Product | null>(null);
  const openCreate = () => { setEditProduct(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditProduct(p); setFormOpen(true); };
  // Tapping a product previews it; the preview's Edit hands off to the form.
  const openPreview = (p: Product) => setPreviewProduct(p);
  const editFromPreview = (p: Product) => {
    setPreviewProduct(null);
    setTimeout(() => openEdit(p), 320); // let the preview sheet dismiss first
  };
  const onProductSaved = () =>
    qc.invalidateQueries({ queryKey: ['seller', 'storeProducts', store?._id] });

  const isVerified = store?.verificationStatus === 'verified';

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

  const productCount = products.length;

  const Header = (
    <View>
      {/* ── Compact navy header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={styles.logo} resizeMode="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoInitial}>{(store.name ?? 'S').trim()[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
            {isVerified ? <BadgeCheck size={15} color="#6ee7b7" strokeWidth={2.4} /> : null}
          </View>
          <Text style={styles.headerSub}>{productCount} {productCount === 1 ? 'product' : 'products'}</Text>
        </View>
        <Pressable
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditStoreDetails')}
          accessibilityRole="button"
          accessibilityLabel="Edit store details"
        >
          <Pencil size={17} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Search + sort/filter ── */}
      <View style={styles.controls}>
        <View style={styles.searchPill}>
          <Search size={18} color="#94a3b8" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your products"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
        <ProductControlsBar state={controls} onChange={setControls} compact />
      </View>

      {/* ── Verification banner ── */}
      {store.verificationStatus !== 'verified' && (
        <View style={styles.bannerWrap}>
          <VerifBanner store={store} onVerify={() => navigation.navigate('StoreVerification', { store })} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={visible}
        keyExtractor={(p) => p._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[Colors.orange]} tintColor={Colors.orange} />
        }
        ListHeaderComponent={Header}
        renderItem={({ item }) => <ProductRow product={item} onPress={() => openPreview(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          productsLoading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 32 }} />
          ) : search.trim() || isControlsActive(controls) ? (
            <View style={styles.productsEmpty}>
              <Search size={40} color={Colors.border} />
              <Text style={styles.productsEmptyTitle}>No matches</Text>
              <Text style={styles.productsEmptySub}>Try a different search or clear the filters.</Text>
            </View>
          ) : (
            <View style={styles.productsEmpty}>
              <Package size={52} color={Colors.textSecondary} />
              <Text style={styles.productsEmptyTitle}>Add your first product</Text>
              <Text style={styles.productsEmptySub}>Showcase what you sell during live streams.</Text>
              <Pressable style={styles.addProductBtn} onPress={openCreate}>
                <Text style={styles.addProductBtnText}>Add product</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* ── Extended FAB ── */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel="Add product"
      >
        <Plus size={20} color="#fff" strokeWidth={2.4} />
        <Text style={styles.fabText}>Add product</Text>
      </Pressable>

      <ProductFormSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        product={editProduct}
        onSaved={onProductSaved}
      />

      <ProductPreviewSheet
        visible={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        productId={previewProduct?._id}
        initial={previewProduct}
        onEdit={editFromPreview}
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

  // Header
  header: {
    backgroundColor: Colors.navy,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 18,
  },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)' },
  logoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.22)' },
  logoInitial: { fontSize: 19, fontFamily: Fonts.extraBold, color: '#fdba74' },
  headerText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeName: { fontSize: 18, fontFamily: Fonts.extraBold, color: '#fff', flexShrink: 1 },
  headerSub: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  editBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 46, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontFamily: Fonts.regular, color: Colors.text, padding: 0 },

  bannerWrap: { paddingHorizontal: 16, paddingTop: 12 },
  banner: {
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE047', borderRadius: 12,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: Colors.text },
  bannerLink: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.orange },
  bannerRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

  // Product row
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: Colors.surface, borderRadius: 16, padding: 10,
    marginHorizontal: 16, marginTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  thumb: { width: 78, height: 78, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.backgroundGrey },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14.5, fontFamily: Fonts.bold, color: Colors.navy },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 4, flexWrap: 'wrap' },
  price: { fontSize: 15, fontFamily: Fonts.extraBold, color: Colors.orange },
  mrp: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8', textDecorationLine: 'line-through' },
  disc: { fontSize: 11, fontFamily: Fonts.bold, color: '#10b981' },
  rating: { fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 7 },
  kebab: { width: 30, height: 30, borderRadius: 10, backgroundColor: Colors.backgroundGrey, alignItems: 'center', justifyContent: 'center' },

  // Empty
  productsEmpty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 8 },
  productsEmptyTitle: { fontSize: 17, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 4 },
  productsEmptySub: { fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
  addProductBtn: {
    marginTop: 12, borderWidth: 1.5, borderColor: Colors.orange, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 24,
  },
  addProductBtnText: { color: Colors.orange, fontSize: 14, fontFamily: Fonts.bold },

  // FAB (extended)
  fab: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 50, borderRadius: 25, paddingHorizontal: 20,
    backgroundColor: Colors.orange,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontFamily: Fonts.extraBold },

  // No store
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  setupBtn: { marginTop: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32 },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },
});
