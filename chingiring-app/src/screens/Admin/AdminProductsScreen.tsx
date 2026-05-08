import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Dimensions, Alert, Platform, Image, useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus, X, Edit2, Trash2, Search, Package, Circle,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, Gradient } from '../../constants/theme';
import { adminAPI } from '../../api/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  _id: string;
  name: string;
  description: string;
  category?: string;
  price: number;
  coinsPrice: number;
  imageUrl: string;
  stock: number;
  sold: number;
  isActive: boolean;
  createdAt?: string;
}

// ─── Add/Edit Product Modal ─────────────────────────────────────────────────

function ProductFormModal({
  visible, onClose, product, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  product?: Product | null;
  onSave: (p: Product) => void;
}) {
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    price: product?.price?.toString() || '',
    coinsPrice: product?.coinsPrice?.toString() || '',
    imageUrl: product?.imageUrl || '',
    stock: product?.stock?.toString() || '',
    isActive: product?.isActive ?? true,
  });

  const handleSubmit = () => {
    if (!form.name || !form.price) {
      Alert.alert('Validation', 'Name and price are required');
      return;
    }
    onSave({
      _id: product?._id || String(Date.now()),
      name: form.name,
      description: form.description,
      category: form.category,
      price: parseFloat(form.price) || 0,
      coinsPrice: parseFloat(form.coinsPrice) || 0,
      imageUrl: form.imageUrl,
      stock: parseInt(form.stock) || 0,
      sold: product?.sold || 0,
      isActive: form.isActive,
      createdAt: product?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  const screenWidth = Dimensions.get('window').width;
  const modalWidth = screenWidth >= 768 ? 520 : screenWidth - 40;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: modalWidth }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Wireless Headphones"
              placeholderTextColor="#94a3b8"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Short product description..."
              placeholderTextColor="#94a3b8"
              multiline
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
            />

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Electronics"
                  placeholderTextColor="#94a3b8"
                  value={form.category}
                  onChangeText={(v) => setForm({ ...form, category: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Image URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor="#94a3b8"
                  value={form.imageUrl}
                  onChangeText={(v) => setForm({ ...form, imageUrl: v })}
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Price ({'\u20B9'}) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2999"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(v) => setForm({ ...form, price: v })}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Coins Price</Text>
                <TextInput
                  style={styles.input}
                  placeholder="15000"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.coinsPrice}
                  onChangeText={(v) => setForm({ ...form, coinsPrice: v })}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Stock</Text>
            <TextInput
              style={styles.input}
              placeholder="45"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={form.stock}
              onChangeText={(v) => setForm({ ...form, stock: v })}
            />

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setForm({ ...form, isActive: !form.isActive })}
            >
              <View style={[styles.toggle, form.isActive && styles.toggleActive]}>
                <View style={[styles.toggleDot, form.isActive && styles.toggleDotActive]} />
              </View>
              <Text style={styles.toggleLabel}>Active</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>{isEdit ? 'Update Product' : 'Create Product'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Product Card ───────────────────────────────────────────────────────────

function ProductCard({
  product, cardWidth, onToggle, onEdit, onDelete,
}: {
  product: Product;
  cardWidth: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { width: cardWidth }]}>
      {/* Image */}
      <View style={styles.cardImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Package size={40} color="#cbd5e1" strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text>

        {/* Price + Stock/Sold row */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceText}>{'\u20B9'}{product.price.toLocaleString()}</Text>
            <Text style={styles.coinsText}>{product.coinsPrice.toLocaleString()} coins</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaText}>Stock: {product.stock}</Text>
            <Text style={styles.metaText}>Sold: {product.sold}</Text>
          </View>
        </View>

        {/* Actions row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.statusPill, product.isActive ? styles.statusPillActive : styles.statusPillInactive]}
            onPress={onToggle}
          >
            <Circle
              size={10}
              color={product.isActive ? '#16a34a' : '#94a3b8'}
              fill={product.isActive ? '#16a34a' : '#94a3b8'}
            />
            <Text style={[styles.statusPillText, product.isActive ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnEdit} onPress={onEdit}>
            <Edit2 size={16} color="#3b82f6" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnDelete} onPress={onDelete}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export function AdminProductsScreen() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const { width: viewportWidth } = useWindowDimensions();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => adminAPI.getProducts({ limit: 200 }),
    staleTime: 30_000,
  });

  const products: Product[] = data?.data?.products ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'products'] });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => adminAPI.createProduct(payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      adminAPI.updateProduct(id, payload),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteProduct(id),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to delete product'),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.category?.toLowerCase().includes(q) ?? false),
    );
  }, [products, search]);

  const activeCount = products.filter((p) => p.isActive).length;
  const totalSold = products.reduce((s, p) => s + p.sold, 0);
  const totalRevenue = products.reduce((s, p) => s + p.price * p.sold, 0);

  // Grid sizing — aim for 3 columns on wide, 2 on mid, 1 on narrow
  const contentWidth = Math.min(viewportWidth - Spacing.lg * 2, 1200);
  const cols = contentWidth >= 900 ? 3 : contentWidth >= 600 ? 2 : 1;
  const gap = 16;
  const cardWidth = (contentWidth - gap * (cols - 1)) / cols;

  const handleSave = (p: Product) => {
    const payload = {
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      coinsPrice: p.coinsPrice,
      imageUrl: p.imageUrl,
      stock: p.stock,
      isActive: p.isActive,
    };
    if (editProduct) {
      updateMutation.mutate({ id: editProduct._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggle = (p: Product) => {
    updateMutation.mutate({ id: p._id, payload: { isActive: !p.isActive } });
  };

  const handleDelete = (id: string, name: string) => {
    const remove = () => deleteMutation.mutate(id);
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${name}"?`)) remove();
    } else {
      Alert.alert('Delete Product', `Delete "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Product Management</Text>
          <Text style={styles.pageSubtitle}>Manage store products</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { setEditProduct(null); setShowForm(true); }}
          style={styles.addBtnWrap}
        >
          <LinearGradient
            colors={Gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add Product</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Products</Text>
          <Text style={[styles.statValue, { color: '#0f172a' }]}>{products.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#16a34a' }]}>Active</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{activeCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#3b82f6' }]}>Total Sold</Text>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{totalSold.toLocaleString()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#7c3aed' }]}>Revenue</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>
            {'\u20B9'}{totalRevenue.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Search size={18} color="#94a3b8" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color="#64748b" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Product grid */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyText}>Loading products…</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Package size={48} color="#ef4444" strokeWidth={1.5} />
          <Text style={styles.emptyText}>Failed to load products. Try again.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={48} color="#cbd5e1" strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            {search.trim()
              ? `No products match "${search}".`
              : 'No products yet. Click "+ Add Product" to create one.'}
          </Text>
        </View>
      ) : (
        <View style={[styles.grid, { gap }]}>
          {filtered.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              cardWidth={cardWidth}
              onToggle={() => handleToggle(p)}
              onEdit={() => { setEditProduct(p); setShowForm(true); }}
              onDelete={() => handleDelete(p._id, p.name)}
            />
          ))}
        </View>
      )}

      <ProductFormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditProduct(null); }}
        product={editProduct}
        onSave={handleSave}
      />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerContent: { padding: Spacing.lg, paddingBottom: 60 },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  addBtnWrap: { borderRadius: 22, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Stats cards
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: Spacing.lg },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flex: 1,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  statLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 28, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  cardImageWrap: {
    height: 192,
    backgroundColor: '#f1f5f9',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cardBody: { padding: 16 },

  productName: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  productDesc: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  priceText: { fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  coinsText: { fontSize: 12, color: '#f59e0b', fontWeight: '600', marginTop: 2 },
  metaText: { fontSize: 12, color: Colors.textSecondary },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillActive: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusPillInactive: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  statusPillText: { fontSize: 13, fontWeight: '600' },
  statusPillTextActive: { color: '#16a34a' },
  statusPillTextInactive: { color: '#64748b' },

  iconBtnEdit: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalBody: { padding: 20 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.text, fontWeight: '500', fontSize: 14 },

  // Form fields
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 4, marginTop: 12 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#fff',
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 8 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: '#3b82f6' },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 14, color: Colors.text },
});
