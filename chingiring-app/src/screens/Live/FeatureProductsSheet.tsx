import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Pressable, Image, TextInput,
  FlatList, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, Check } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { productsAPI } from '../../api/products';
import type { StreamProductLite } from '../../api/streams';

/**
 * FeatureProductsSheet — the broadcaster's "Feature products" picker (design
 * bc-04). A cross-platform bottom sheet (React Native Modal, so it slides up
 * on web AND native) over the dimmed live console: the seller multi-selects
 * which of their catalog products show on the live shelf, pre-filled with the
 * set already featured. "Feature N products" applies the selection.
 *
 * The catalog is loaded page-by-page (infinite scroll) from GET
 * /api/products?storeId= with server-side search + category filtering, so it
 * scales past one page. The selection is kept by id in `itemsById` so products
 * on pages you never scrolled to (but were already featured) survive Apply.
 *
 * Applying calls onApply with the chosen products; the parent persists them
 * (PATCH /api/streams/:id/products) and the server broadcasts the new set to
 * every viewer via the stream_products_updated socket event.
 */
type CatalogItem = { _id: string; name: string; price: number; imageUrl?: string; category?: string };

const PAGE_SIZE = 20;

const liteToCat = (p: StreamProductLite): CatalogItem => ({
  _id: p._id, name: p.name, price: p.price, imageUrl: p.imageUrl, category: p.category,
});
const catToLite = (p: CatalogItem): StreamProductLite => ({
  _id: p._id, name: p.name, price: p.price, imageUrl: p.imageUrl, category: p.category,
});
const mapRaw = (p: any): CatalogItem => ({
  _id: String(p._id),
  name: p.name ?? 'Product',
  price: Number(p.price ?? 0),
  imageUrl: p.imageUrl ?? p.images?.[0],
  category: p.category,
});

export const FeatureProductsSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  /** The seller's store id — the source of the catalog to pick from. */
  storeId?: string | null;
  /** Products currently on the live shelf — seeds the selection. */
  featured: StreamProductLite[];
  onApply: (products: StreamProductLite[]) => void;
}> = ({ visible, onClose, storeId, featured, onApply }) => {
  const insets = useSafeAreaInsets();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);       // initial / reset load
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [cat, setCat] = useState('All');
  const [seenCats, setSeenCats] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Full data for every product seen (featured seed + all loaded pages) so
  // Apply can rebuild the selected set even for items not in the current view.
  const itemsById = useRef<Map<string, CatalogItem>>(new Map());
  // Guards against out-of-order responses (a fast search can outrun a slow page).
  const reqId = useRef(0);

  // Debounce the search box → server query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // On open: seed selection + item map from the current shelf, reset filters.
  useEffect(() => {
    if (!visible) return;
    itemsById.current = new Map();
    featured.forEach((p) => itemsById.current.set(p._id, liteToCat(p)));
    setSelected(new Set(featured.map((p) => p._id)));
    setSeenCats(featured.map((p) => p.category).filter(Boolean) as string[]);
    setQ(''); setDebouncedQ(''); setCat('All');
    setCatalog([]); setPage(1); setHasMore(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPage = useCallback(async (pageNum: number) => {
    if (!storeId) {
      // No catalog source (storeId not resolved) — fall back to the shelf set.
      setCatalog(featured.map(liteToCat));
      setHasMore(false);
      return;
    }
    const mine = ++reqId.current;
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const body: any = await productsAPI.getProducts({
        storeId,
        page: pageNum,
        limit: PAGE_SIZE,
        search: debouncedQ || undefined,
        category: cat !== 'All' ? cat : undefined,
      });
      if (mine !== reqId.current) return; // superseded by a newer request
      const raw: any[] = body?.data?.products ?? body?.products ?? [];
      const mapped = raw.map(mapRaw);
      mapped.forEach((m) => itemsById.current.set(m._id, m));
      setSeenCats((prev) =>
        Array.from(new Set([...prev, ...(mapped.map((m) => m.category).filter(Boolean) as string[])])),
      );
      setCatalog((prev) => (pageNum === 1 ? mapped : [...prev, ...mapped]));
      setPage(pageNum);
      const pages = body?.data?.pagination?.pages ?? 1;
      setHasMore(pageNum < pages);
    } catch {
      if (mine === reqId.current && pageNum === 1) {
        setCatalog(featured.map(liteToCat));
        setHasMore(false);
      }
    } finally {
      if (mine === reqId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [storeId, debouncedQ, cat, featured]);

  // (Re)load page 1 when the sheet opens or the search / category changes.
  useEffect(() => {
    if (!visible) return;
    fetchPage(1);
  }, [visible, debouncedQ, cat, storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchPage(page + 1);
  }, [loading, loadingMore, hasMore, page, fetchPage]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    const chosen: StreamProductLite[] = [];
    selected.forEach((id) => {
      const it = itemsById.current.get(id);
      if (it) chosen.push(catToLite(it));
    });
    onApply(chosen);
    onClose();
  };

  const count = selected.size;
  const cats = ['All', ...seenCats];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap the gap above the sheet to dismiss. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { marginTop: insets.top + 44 }]}>
          <View style={styles.handle} />

          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>Feature products</Text>
              <Text style={styles.sub}>Selected products show on your live shelf.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={18} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchPill}>
            <Search size={17} color="#94a3b8" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your products…"
              placeholderTextColor="#94a3b8"
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
            />
          </View>

          {cats.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {cats.map((c) => (
                <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                  <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {loading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={Colors.orange} /></View>
          ) : (
            <FlatList
              data={catalog}
              keyExtractor={(p) => p._id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => {
                const on = selected.has(item._id);
                return (
                  <Pressable
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => toggle(item._id)}
                    accessibilityLabel={`${on ? 'Remove' : 'Feature'} ${item.name}`}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.rowImg} />
                    ) : (
                      <View style={[styles.rowImg, styles.rowImgFallback]} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[styles.check, on ? styles.checkOn : styles.checkOff]}>
                      {on ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator color={Colors.orange} style={styles.footerLoading} /> : null
              }
              ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
            />
          )}

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={apply}
              disabled={count === 0}
              style={[styles.cta, count === 0 && styles.ctaDisabled]}
              accessibilityLabel={`Feature ${count} products`}
            >
              <Text style={styles.ctaText}>
                {count === 0 ? 'Select products to feature' : `Feature ${count} product${count === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: {
    flex: 1, backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginTop: 10 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 19, fontFamily: Fonts.extraBold, color: Colors.navy },
  sub: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  searchPill: {
    marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: Colors.background,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.text, padding: 0 },

  chipRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: {
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13,
    borderWidth: 1.5, borderColor: 'transparent', backgroundColor: Colors.backgroundGrey,
  },
  chipActive: { backgroundColor: '#FFF7ED', borderColor: Colors.orange },
  chipText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTextActive: { color: Colors.orange, fontFamily: Fonts.bold },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoading: { paddingVertical: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 8,
    borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  rowOn: { backgroundColor: '#FFF7ED', borderColor: '#FBD9B4' },
  rowImg: { width: 52, height: 52, borderRadius: 10 },
  rowImgFallback: { backgroundColor: Colors.backgroundGrey },
  rowName: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  rowPrice: { fontSize: 14, fontFamily: Fonts.extraBold, color: Colors.navy, marginTop: 3 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.orange },
  checkOff: { borderWidth: 2, borderColor: '#cbd5e1' },
  empty: { textAlign: 'center', color: Colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular, paddingVertical: 30 },

  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  cta: { height: 52, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },
});
