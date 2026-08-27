import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Input } from '../../components/Input';
import { ImageUploader } from '../../components/ImageUploader';
import { productsAPI, type Product, type MyProductInput } from '../../api/products';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** null = create, a product = edit. */
  product: Product | null;
  /** Called after a successful create / update / delete so the list refreshes. */
  onSaved: () => void;
}

/**
 * Add / edit a seller's own product. Writes go through the seller-scoped
 * endpoints (productsAPI.createMine / updateMine / deleteMine) — ownership is
 * enforced server-side.
 */
export const ProductFormSheet: React.FC<Props> = ({ visible, onClose, product, onSaved }) => {
  const insets = useSafeAreaInsets();
  const editing = !!product;

  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [description, setDescription] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the fields each time the sheet opens (blank for create, product for edit).
  useEffect(() => {
    if (!visible) return;
    setImage(product?.imageUrl ?? '');
    setName(product?.name ?? '');
    setPrice(product?.price != null ? String(product.price) : '');
    setMrp(product?.mrp ? String(product.mrp) : '');
    setDescription(product?.description ?? '');
    setAffiliateUrl(product?.affiliateUrl ?? '');
  }, [visible, product]);

  const priceNum = Number(price);
  const valid =
    name.trim().length >= 2 && price.trim() !== '' && !Number.isNaN(priceNum) && priceNum >= 0;

  const handleSave = async () => {
    if (!valid) {
      Alert.alert('Missing details', 'A product needs a name and a valid price.');
      return;
    }
    setSaving(true);
    try {
      const input: MyProductInput = {
        name: name.trim(),
        price: priceNum,
        mrp: mrp.trim() ? Number(mrp) : undefined,
        description: description.trim() || undefined,
        imageUrl: image || undefined,
        images: image ? [image] : undefined,
        affiliateUrl: affiliateUrl.trim() || undefined,
      };
      if (editing) await productsAPI.updateMine(product!._id, input);
      else await productsAPI.createMine(input);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message ?? err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('Delete product?', `"${product!.name}" will be removed from your store.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await productsAPI.deleteMine(product!._id);
            onSaved();
            onClose();
          } catch (err: any) {
            Alert.alert('Could not delete', err?.response?.data?.message ?? err?.message ?? 'Something went wrong.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.hBtn} accessibilityLabel="Close">
            <X size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.hTitle}>{editing ? 'Edit product' : 'Add product'}</Text>
          {editing ? (
            <Pressable onPress={handleDelete} style={styles.hBtn} accessibilityLabel="Delete product">
              <Trash2 size={20} color={Colors.danger} />
            </Pressable>
          ) : (
            <View style={styles.hBtn} />
          )}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <ImageUploader
              value={image}
              onChange={setImage}
              label="Product photo"
              folder="seller-products"
              hint="Recommended 1600 × 1200 px (4:3). A clean, well-lit photo sells best."
            />
            <Input label="Name" placeholder="e.g. Red Silk Saree" value={name} onChangeText={setName} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Price (₹)"
                  placeholder="1499"
                  value={price}
                  onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, ''))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="MRP (₹, optional)"
                  placeholder="1999"
                  value={mrp}
                  onChangeText={(t) => setMrp(t.replace(/[^\d.]/g, ''))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Input
              label="Description (optional)"
              placeholder="Fabric, size, care…"
              value={description}
              onChangeText={setDescription}
            />
            <Input
              label="Buy link (optional)"
              placeholder="https://…"
              value={affiliateUrl}
              onChangeText={setAffiliateUrl}
              keyboardType="url"
              autoCapitalize="none"
            />
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.saveBtn, (!valid || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!valid || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Add product'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: Fonts.bold, color: Colors.navy },
  body: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },
});

export default ProductFormSheet;
