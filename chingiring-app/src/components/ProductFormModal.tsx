import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Package, DownloadCloud } from 'lucide-react-native';
import { MultiImageUploader } from './MultiImageUploader';
import { CategoryPicker } from './CategoryPicker';
import { adminAPI } from '../api/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductFormValues {
  name: string;
  description: string;
  category: string;
  price: number;
  coinsPrice: number;
  imageUrl: string;    // cover image (mirrors images[0]) — read by every card surface
  images: string[];    // full gallery, cover first
  affiliateUrl: string;
  stock: number;
}

export interface ProductFormSeed extends Partial<ProductFormValues> {
  _id?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** When provided, modal opens in edit mode and pre-fills fields. */
  product?: ProductFormSeed | null;
  /** Called with validated values. Resolve when save completes; modal closes after. */
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
}

// ─── Validation ─────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  price?: string;
  coinsPrice?: string;
  stock?: string;
}

function validate(form: {
  name: string; price: string; coinsPrice: string; stock: string;
}): { errors: FormErrors; values?: ProductFormValues } {
  const errors: FormErrors = {};
  if (!form.name.trim())  errors.name  = 'Required';

  const priceN = Number(form.price);
  if (!form.price.trim() || Number.isNaN(priceN) || priceN < 0) errors.price = 'Required (₹ ≥ 0)';

  const coinsN = Number(form.coinsPrice);
  if (!form.coinsPrice.trim() || Number.isNaN(coinsN) || coinsN < 0) errors.coinsPrice = 'Required (≥ 0)';

  const stockN = Number(form.stock);
  if (!form.stock.trim() || Number.isNaN(stockN) || stockN < 0) errors.stock = 'Required (≥ 0)';

  return Object.keys(errors).length > 0 ? { errors } : { errors };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ProductFormModal: React.FC<Props> = ({ visible, onClose, product, onSubmit }) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const isMobile = winW < 600;
  const isEdit   = !!product?._id;

  // Reset form whenever the modal opens with a new product.
  const [form, setForm] = useState(() => buildInitial(product));
  React.useEffect(() => {
    if (visible) setForm(buildInitial(product));
  }, [visible, product]);

  const [errors, setErrors]     = useState<FormErrors>({});
  const [submitting, setSubmit] = useState(false);
  const [fetching, setFetching] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof FormErrors]) {
      setErrors((e) => ({ ...e, [k]: undefined }));
    }
  };

  // Best-effort prefill from the product/buy link (OpenGraph image + title +
  // price). If the site blocks it, the admin still has manual upload.
  const handleFetchFromLink = async () => {
    const url = form.affiliateUrl.trim();
    if (!url) {
      Alert.alert('Add a link first', 'Paste the product / buy link, then fetch.');
      return;
    }
    setFetching(true);
    try {
      const { data } = await adminAPI.fetchUrlMeta(url);
      const patch: Partial<typeof form> = {};
      if (data.image && !form.images.includes(data.image)) patch.images = [...form.images, data.image];
      if (data.title && !form.name.trim()) patch.name = data.title;
      if (data.price != null && !form.price.trim()) patch.price = String(data.price);
      if (Object.keys(patch).length) {
        setForm((f) => ({ ...f, ...patch }));
      } else {
        Alert.alert(
          'Nothing to import',
          data.image || data.title
            ? 'Everything it returned is already filled in.'
            : 'This link didn’t return an image — the site may block it. Upload manually instead.',
        );
      }
    } catch (e: any) {
      Alert.alert('Fetch failed', e?.response?.data?.message || e?.message || 'Try again.');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    const errs: FormErrors = {};
    if (!form.name.trim())  errs.name  = 'Required';

    const priceN = Number(form.price);
    if (!form.price.trim() || Number.isNaN(priceN) || priceN < 0) errs.price = '₹ ≥ 0';

    const coinsN = Number(form.coinsPrice);
    if (!form.coinsPrice.trim() || Number.isNaN(coinsN) || coinsN < 0) errs.coinsPrice = '≥ 0';

    const stockN = Number(form.stock);
    if (!form.stock.trim() || Number.isNaN(stockN) || stockN < 0) errs.stock = '≥ 0';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmit(true);
    try {
      const images = form.images.map((u) => u.trim()).filter(Boolean);
      await onSubmit({
        name:         form.name.trim(),
        description:  form.description.trim(),
        category:     form.category.trim(),
        price:        priceN,
        coinsPrice:   coinsN,
        images,
        imageUrl:     images[0] ?? '',   // cover mirrors the first gallery image
        affiliateUrl: form.affiliateUrl.trim(),
        stock:        stockN,
      });
      onClose();
    } finally {
      setSubmit(false);
    }
  };

  // ── Layout: bottom sheet on mobile, centred card on desktop ────────────
  const sheetWidth  = isMobile ? winW : Math.min(540, winW - 48);
  const sheetRadius = isMobile ? 24 : 16;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isMobile ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.overlay}
      >
        {/* Backdrop dismiss */}
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            st.sheet,
            {
              width: sheetWidth,
              maxHeight: winH * 0.92,
              borderTopLeftRadius:  sheetRadius,
              borderTopRightRadius: sheetRadius,
              borderBottomLeftRadius:  isMobile ? 0 : sheetRadius,
              borderBottomRightRadius: isMobile ? 0 : sheetRadius,
            },
          ]}
        >
          {/* Drag handle (mobile only) */}
          {isMobile && <View style={st.handle} />}

          {/* Header */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <Package size={18} color="#0f172a" strokeWidth={2.5} />
              <Text style={st.title}>{isEdit ? 'Edit Product' : 'Add New Product'}</Text>
            </View>
            <TouchableOpacity style={st.closeBtn} onPress={onClose}>
              <X size={16} color="#64748b" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Form body */}
          <ScrollView
            style={st.body}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Product Images — multi-image gallery (cover first). imageUrl on
                submit mirrors images[0] so every card surface keeps working. */}
            <Field label="Product Images">
              <MultiImageUploader
                value={form.images}
                onChange={(urls) => update('images', urls)}
                folder="chingiringi/products"
                disabled={submitting}
              />
            </Field>

            {/* Product Name * */}
            <Field label="Product Name" required error={errors.name}>
              <TextInput
                style={[st.input, errors.name && st.inputErr, !errors.name && form.name && st.inputFocus]}
                placeholder="e.g., Wireless Headphones"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => update('name', v)}
              />
            </Field>

            {/* Description */}
            <Field label="Description">
              <TextInput
                style={[st.input, st.textarea]}
                placeholder="Short product description..."
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={(v) => update('description', v)}
                multiline
                textAlignVertical="top"
              />
            </Field>

            {/* Product Link — optional buy / affiliate URL. When set, the
                product's "Buy Now" opens it (subid-tracked, like deals). */}
            <Field label="Product Link">
              <TextInput
                style={[st.input, !!form.affiliateUrl && st.inputFocus]}
                placeholder="https://amazon.in/... (optional — leave blank for display-only)"
                placeholderTextColor="#94a3b8"
                value={form.affiliateUrl}
                onChangeText={(v) => update('affiliateUrl', v)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </Field>

            {/* Prefill image + title from the link (best-effort; manual upload stays as fallback) */}
            <TouchableOpacity
              style={[st.fetchBtn, (fetching || submitting || !form.affiliateUrl.trim()) && { opacity: 0.5 }]}
              onPress={handleFetchFromLink}
              disabled={fetching || submitting || !form.affiliateUrl.trim()}
              activeOpacity={0.85}
            >
              {fetching
                ? <ActivityIndicator size="small" color="#4784E2" />
                : <DownloadCloud size={15} color="#4784E2" strokeWidth={2.2} />}
              <Text style={st.fetchBtnText}>
                {fetching ? 'Fetching…' : 'Fetch image & title from link'}
              </Text>
            </TouchableOpacity>

            {/* Price / Coins / Stock row */}
            <View style={st.row3}>
              <Field label="Price (₹)" required error={errors.price} style={st.col3}>
                <TextInput
                  style={[st.input, errors.price && st.inputErr]}
                  placeholder="2999"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.price}
                  onChangeText={(v) => update('price', v.replace(/[^0-9.]/g, ''))}
                />
              </Field>
              <Field label="Coins" required error={errors.coinsPrice} style={st.col3}>
                <TextInput
                  style={[st.input, errors.coinsPrice && st.inputErr]}
                  placeholder="15000"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.coinsPrice}
                  onChangeText={(v) => update('coinsPrice', v.replace(/[^0-9]/g, ''))}
                />
              </Field>
              <Field label="Stock" required error={errors.stock} style={st.col3}>
                <TextInput
                  style={[st.input, errors.stock && st.inputErr]}
                  placeholder="50"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={form.stock}
                  onChangeText={(v) => update('stock', v.replace(/[^0-9]/g, ''))}
                />
              </Field>
            </View>

            {/* Category — inline picker with create / edit / delete */}
            <Field label="Category">
              <CategoryPicker
                value={form.category}
                onChange={(v) => update('category', v)}
                disabled={submitting}
              />
            </Field>
          </ScrollView>

          {/* Actions */}
          <View style={st.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[st.primaryBtnWrap, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <LinearGradient
                colors={['#4784E2', '#91BDFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.primaryBtn}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={st.primaryBtnText}>{isEdit ? 'Update Product' : 'Add Product'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={st.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={st.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Field helper ───────────────────────────────────────────────────────────

function Field({
  label, required, error, style, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  style?: any;
  children: React.ReactNode;
}) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <View style={st.labelRow}>
        <Text style={st.label}>
          {label.toUpperCase()}{required ? ' *' : ''}
        </Text>
        {error ? <Text style={st.errText}>{error}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildInitial(p?: ProductFormSeed | null) {
  return {
    name:         p?.name         ?? '',
    description:  p?.description  ?? '',
    category:     p?.category     ?? '',
    price:        p?.price         != null ? String(p.price)       : '',
    coinsPrice:   p?.coinsPrice    != null ? String(p.coinsPrice)  : '',
    imageUrl:     p?.imageUrl     ?? '',
    images:       p?.images?.length ? p.images : (p?.imageUrl ? [p.imageUrl] : []),
    affiliateUrl: p?.affiliateUrl ?? '',
    stock:        p?.stock         != null ? String(p.stock)        : '',
  };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  errText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },

  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#F5F8FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 44,
  },
  inputFocus: {
    borderColor: '#4784E2',
    backgroundColor: '#fff',
  },
  inputErr: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  textarea: {
    minHeight: 80,
    paddingTop: 12,
  },

  row3: {
    flexDirection: 'row',
    gap: 10,
  },
  col3: {
    flex: 1,
  },
  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -6,
    marginBottom: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  fetchBtnText: { fontSize: 13, fontWeight: '700', color: '#4784E2' },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryBtnWrap: {
    flex: 2,
    borderRadius: 22,
    overflow: 'hidden',
  },
  primaryBtn: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProductFormModal;
