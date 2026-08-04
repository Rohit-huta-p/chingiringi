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
import {
  X, Package, DownloadCloud, Image as ImageIcon, Type as TypeIcon, Link2, Coins, Tag,
} from 'lucide-react-native';
import { MultiImageUploader } from './MultiImageUploader';
import { ImageUploader } from './ImageUploader';
import { CategoryPicker } from './CategoryPicker';
import { ProductCard } from './ProductCard';
import { adminAPI } from '../api/admin';
import type { Product } from '../api/products';
import { Colors, Gradient } from '../constants/theme';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductFormValues {
  name: string;
  description: string;
  category: string;
  price: number;
  coinsPrice: number;
  imageUrl: string;    // cover image (mirrors images[0]) — read by every card surface
  mobileImageUrl: string; // optional mobile-specific cover crop
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

interface FormErrors {
  name?: string;
  price?: string;
  coinsPrice?: string;
  stock?: string;
}

// ─── Section wrapper (mirrors the banner form) ───────────────────────────────
// Icon chip + title with a divider, fields below.
function FormSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHead}>
        <View style={st.sectionIcon}><Icon size={13} color={Colors.primary} strokeWidth={2.4} /></View>
        <Text style={st.sectionHeadText}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ProductFormModal: React.FC<Props> = ({ visible, onClose, product, onSubmit }) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const twoCol = winW >= 880; // side-by-side form + live preview on desktop
  const isEdit = !!product?._id;

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
        mobileImageUrl: form.mobileImageUrl.trim(),
        affiliateUrl: form.affiliateUrl.trim(),
        stock:        stockN,
      });
      onClose();
    } finally {
      setSubmit(false);
    }
  };

  // Live preview object built from the in-progress form — feeds the same
  // ProductCard users see on the home grid, so admins see the real result.
  const previewProduct: Product = {
    _id: 'preview',
    name: form.name.trim() || 'Product name',
    description: form.description,
    category: form.category,
    price: Number(form.price) || 0,
    coinsPrice: Number(form.coinsPrice) || 0,
    imageUrl: form.images[0] || form.mobileImageUrl || '',
    mobileImageUrl: form.mobileImageUrl || undefined,
    images: form.images,
    stock: Number(form.stock) || 0,
    sold: 0,
    isActive: true,
    isFeatured: false,
    createdAt: '',
    updatedAt: '',
  };
  const previewCardEl = (w: number) => (
    <ProductCard product={previewProduct} width={w} onPress={() => {}} />
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.overlay}
      >
        {/* Backdrop dismiss */}
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[st.modalCard, twoCol && st.modalCardWide, { maxHeight: winH * 0.92 }]}>
          {/* Header */}
          <View style={st.modalHeader}>
            <View style={st.headerLeft}>
              <View style={st.headerBadge}>
                <Package size={16} color="#fff" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.modalTitle}>{isEdit ? 'Edit product' : 'New product'}</Text>
                <Text style={st.modalSubtitle}>
                  {isEdit ? 'Update its details and images' : 'Add a product to the store'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Body: live preview + sectioned form (side-by-side on desktop) */}
          <View style={twoCol ? st.bodyRow : st.bodyCol}>
            {twoCol ? (
              <View style={st.previewPane}>
                <Text style={st.previewCap}>Preview</Text>
                {previewCardEl(300)}
              </View>
            ) : null}

            <ScrollView
              style={st.formPane}
              contentContainerStyle={st.formPaneContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!twoCol ? (
                <View style={st.previewInline}>{previewCardEl(200)}</View>
              ) : null}

              {/* Images — gallery (cover first). imageUrl on submit mirrors
                  images[0] so every card surface keeps working. */}
              <FormSection icon={ImageIcon} title="Photos">
                <Field label="Desktop photos">
                  <MultiImageUploader
                    value={form.images}
                    onChange={(urls) => update('images', urls)}
                    folder="chingiringi/products"
                    disabled={submitting}
                  />
                  <Text style={st.fieldHint}>
                    Shown on the store grid & desktop product page. Recommended 1200 × 1200 px (1:1) or larger — auto-cropped to a square, keep the subject centered.
                  </Text>
                </Field>
                <Field label="Mobile photo (optional)">
                  <ImageUploader
                    value={form.mobileImageUrl}
                    onChange={(url) => update('mobileImageUrl', url)}
                    folder="chingiringi/products"
                    disabled={submitting}
                  />
                  <Text style={st.fieldHint}>
                    Leads the mobile product page; falls back to the first desktop photo. Recommended 1080 × 810 px (4:3, landscape).
                  </Text>
                </Field>
              </FormSection>

              {/* Details */}
              <FormSection icon={TypeIcon} title="Details">
                <Field label="Product name" required error={errors.name}>
                  <TextInput
                    style={[st.input, errors.name && st.inputErr, !errors.name && !!form.name && st.inputFocus]}
                    placeholder="e.g., Wireless Headphones"
                    placeholderTextColor="#94a3b8"
                    value={form.name}
                    onChangeText={(v) => update('name', v)}
                  />
                </Field>
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
              </FormSection>

              {/* Product link — optional buy / affiliate URL. When set, the
                  product's "Buy Now" opens it (subid-tracked, like deals). */}
              <FormSection icon={Link2} title="Product link">
                <Field label="Buy / affiliate URL">
                  <TextInput
                    style={[st.input, !!form.affiliateUrl && st.inputFocus]}
                    placeholder="https://amazon.in/... (optional — blank = display-only)"
                    placeholderTextColor="#94a3b8"
                    value={form.affiliateUrl}
                    onChangeText={(v) => update('affiliateUrl', v)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </Field>
                <TouchableOpacity
                  style={[st.fetchBtn, (fetching || submitting || !form.affiliateUrl.trim()) && { opacity: 0.5 }]}
                  onPress={handleFetchFromLink}
                  disabled={fetching || submitting || !form.affiliateUrl.trim()}
                  activeOpacity={0.85}
                >
                  {fetching
                    ? <ActivityIndicator size="small" color={Colors.primary} />
                    : <DownloadCloud size={15} color={Colors.primary} strokeWidth={2.2} />}
                  <Text style={st.fetchBtnText}>
                    {fetching ? 'Fetching…' : 'Fetch image & title from link'}
                  </Text>
                </TouchableOpacity>
              </FormSection>

              {/* Pricing & stock */}
              <FormSection icon={Coins} title="Pricing & stock">
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
              </FormSection>

              {/* Category — inline picker with create / edit / delete */}
              <FormSection icon={Tag} title="Category">
                <CategoryPicker
                  value={form.category}
                  onChange={(v) => update('category', v)}
                  disabled={submitting}
                />
              </FormSection>
            </ScrollView>
          </View>

          {/* Footer */}
          <View style={st.modalActions}>
            <TouchableOpacity style={st.cancelBtn} onPress={onClose} disabled={submitting} activeOpacity={0.85}>
              <Text style={st.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.submitBtnWrap, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.9}
            >
              <LinearGradient colors={Gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.submitBtn}>
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={st.submitBtnText}>{isEdit ? 'Update product' : 'Create product'}</Text>}
              </LinearGradient>
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
    <View style={[st.field, style]}>
      <View style={st.labelRow}>
        <Text style={st.fieldLabel}>
          {label}{required ? <Text style={st.req}> *</Text> : null}
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
    mobileImageUrl: p?.mobileImageUrl ?? '',
    images:       p?.images?.length ? p.images : (p?.imageUrl ? [p.imageUrl] : []),
    affiliateUrl: p?.affiliateUrl ?? '',
    stock:        p?.stock         != null ? String(p.stock)        : '',
  };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
  modalCardWide: { maxWidth: 960 },

  // Header
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerBadge: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },
  modalSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
  },

  // Body panes (live preview + form)
  bodyRow: { flexDirection: 'row', flex: 1, minHeight: 0 },
  bodyCol: { flex: 1, minHeight: 0 },
  previewPane: {
    width: 360,
    padding: 20,
    gap: 12,
    borderRightWidth: 1,
    borderRightColor: '#eef2f7',
    backgroundColor: '#fbfcfe',
    alignItems: 'center',
  },
  previewCap: {
    alignSelf: 'flex-start',
    fontSize: 11, fontWeight: '800', color: Colors.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  previewInline: { alignItems: 'center', marginBottom: 6 },
  formPane: { flex: 1 },
  formPaneContent: { padding: 20, paddingTop: 6, paddingBottom: 24 },

  // Sections
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 2, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  sectionIcon: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  sectionHeadText: { fontSize: 13, fontWeight: '800', color: Colors.text, letterSpacing: 0.2 },

  // Fields
  field: { marginTop: 12 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  fieldHint: { fontSize: 11, color: Colors.textSecondary, marginTop: 6 },
  req: { color: '#ef4444' },
  errText: { fontSize: 11, color: '#dc2626', fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: Colors.text,
    minHeight: 44,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputFocus: { borderColor: Colors.primary },
  inputErr: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  textarea: { minHeight: 80, paddingTop: 12 },

  row3: { flexDirection: 'row', gap: 10 },
  col3: { flex: 1 },

  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  fetchBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Footer
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  submitBtnWrap: { flex: 2, borderRadius: 10, overflow: 'hidden' },
  submitBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ProductFormModal;
