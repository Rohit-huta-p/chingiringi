import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Film, UploadCloud, Store as StoreIcon, Check, X, ChevronDown, Tag, RefreshCw,
} from 'lucide-react-native';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { Colors, Fonts } from '../../constants/theme';
import { useVideoUpload, PickedVideo } from '../../components/useVideoUpload';
import { videosAPI } from '../../api/videos';
import { storesAPI, Store } from '../../api/stores';
import { adminAPI } from '../../api/admin';
import { Product } from '../../api/products';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const AdminVideoUploadScreen = () => {
  const { uploading, pickVideo, uploadVideo } = useVideoUpload();
  const [saving, setSaving] = useState(false);
  const busy = uploading || saving;

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [caption, setCaption] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [storeModal, setStoreModal] = useState(false);
  const [productModal, setProductModal] = useState(false);

  const { data: storesData } = useQuery({
    queryKey: ['stores', 'admin-video'],
    queryFn: () => storesAPI.list({ limit: 100 }),
  });
  const stores: Store[] = storesData?.data?.stores ?? [];

  const { data: productsData } = useQuery({
    queryKey: ['admin', 'products', 'video'],
    queryFn: () => adminAPI.getProducts({ limit: 200 }),
  });
  const products: Product[] = productsData?.data?.products ?? [];
  const selectedProducts = products.filter((p) => productIds.includes(p._id));

  const onPick = async () => {
    const f = await pickVideo();
    if (f) setVideo(f);
  };

  const reset = () => {
    setVideo(null); setStore(null); setCaption(''); setProductIds([]);
  };

  const onPublish = async () => {
    if (!video) return Alert.alert('Add a video', 'Pick a clip to upload first.');
    if (!store) return Alert.alert('Pick a store', 'Every video belongs to a store.');
    if (video.sizeMB && video.sizeMB > 200) {
      return Alert.alert('Too large', `That clip is ${video.sizeMB.toFixed(0)} MB. Keep it under 200 MB.`);
    }
    try {
      const streamUid = await uploadVideo(video, store._id);
      setSaving(true);
      await videosAPI.createVideo({
        streamUid,
        storeId: store._id,
        caption: caption.trim(),
        taggedProducts: productIds,
        cta: productIds[0] ? { type: 'shop', productId: productIds[0] } : { type: 'store' },
      });
      Alert.alert(
        'Uploaded 🎬',
        'Cloudflare is encoding it now. It appears in the feed once processing finishes (a webhook or the reconcile job flips it to ready).',
      );
      reset();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (id: string) =>
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <SafeAreaView style={s.root} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <MobileAdminNav active="AdminVideos" />

        <View style={s.body}>
          <Text style={s.h1}>Add a video</Text>
          <Text style={s.sub}>Upload a shoppable clip for a store. It goes live once Cloudflare finishes encoding.</Text>

          {/* Video picker */}
          <Text style={s.label}>Clip</Text>
          {!video ? (
            <TouchableOpacity style={s.picker} onPress={onPick} disabled={busy}>
              <UploadCloud size={28} color={Colors.primary} />
              <Text style={s.pickerTitle}>Choose a video</Text>
              <Text style={s.pickerHint}>Portrait 9:16 · ≤ 60s · ≤ 200 MB</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.videoCard}>
              <View style={s.videoThumb}><Film size={22} color="#fff" /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.videoName} numberOfLines={1}>{video.name}</Text>
                <Text style={s.videoMeta}>{video.sizeMB ? `${video.sizeMB.toFixed(1)} MB` : 'ready'}</Text>
              </View>
              <TouchableOpacity onPress={onPick} disabled={busy} style={s.replaceBtn}>
                <RefreshCw size={16} color={Colors.primary} />
                <Text style={s.replaceTxt}>Replace</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Store */}
          <Text style={s.label}>Store</Text>
          <TouchableOpacity style={s.select} onPress={() => setStoreModal(true)} disabled={busy}>
            <StoreIcon size={18} color={store ? Colors.text : Colors.textSecondary} />
            <Text style={[s.selectTxt, !store && s.selectPlaceholder]} numberOfLines={1}>
              {store ? store.name : 'Select a store'}
            </Text>
            <ChevronDown size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Caption */}
          <Text style={s.label}>Caption</Text>
          <TextInput
            style={s.input}
            value={caption}
            onChangeText={setCaption}
            placeholder="e.g. New cold-brew menu is live ❄️"
            placeholderTextColor={Colors.textSecondary}
            maxLength={300}
            multiline
          />

          {/* Products */}
          <Text style={s.label}>Tagged products <Text style={s.optional}>· optional</Text></Text>
          <TouchableOpacity style={s.select} onPress={() => setProductModal(true)} disabled={busy}>
            <Tag size={18} color={Colors.textSecondary} />
            <Text style={[s.selectTxt, !selectedProducts.length && s.selectPlaceholder]} numberOfLines={1}>
              {selectedProducts.length ? `${selectedProducts.length} tagged` : 'Tag products to make it shoppable'}
            </Text>
            <ChevronDown size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          {selectedProducts.length > 0 && (
            <View style={s.chips}>
              {selectedProducts.map((p) => (
                <View key={p._id} style={s.chip}>
                  <Text style={s.chipTxt} numberOfLines={1}>{p.name}</Text>
                  <TouchableOpacity onPress={() => toggleProduct(p._id)}><X size={13} color={Colors.primary} /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Publish */}
          <TouchableOpacity style={[s.publish, busy && s.publishBusy]} onPress={onPublish} disabled={busy}>
            {busy
              ? <><ActivityIndicator color="#fff" /><Text style={s.publishTxt}>{uploading ? 'Uploading…' : 'Saving…'}</Text></>
              : <><UploadCloud size={18} color="#fff" /><Text style={s.publishTxt}>Publish video</Text></>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Store picker modal */}
      <PickerModal visible={storeModal} title="Select a store" onClose={() => setStoreModal(false)}>
        {stores.map((st) => (
          <TouchableOpacity key={st._id} style={s.row} onPress={() => { setStore(st); setStoreModal(false); }}>
            {st.logoUrl ? <Image source={{ uri: st.logoUrl }} style={s.rowLogo} /> : <View style={[s.rowLogo, s.rowLogoEmpty]}><Text style={s.rowLogoTxt}>{st.name[0]}</Text></View>}
            <Text style={s.rowName} numberOfLines={1}>{st.name}</Text>
            {store?._id === st._id && <Check size={18} color={Colors.primary} />}
          </TouchableOpacity>
        ))}
        {!stores.length && <Text style={s.emptyModal}>No stores found.</Text>}
      </PickerModal>

      {/* Product multi-select modal */}
      <PickerModal visible={productModal} title="Tag products" onClose={() => setProductModal(false)} doneLabel="Done">
        {products.map((p) => {
          const on = productIds.includes(p._id);
          return (
            <TouchableOpacity key={p._id} style={s.row} onPress={() => toggleProduct(p._id)}>
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={s.rowLogo} /> : <View style={[s.rowLogo, s.rowLogoEmpty]}><Text style={s.rowLogoTxt}>{p.name[0]}</Text></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.rowPrice}>{inr(p.price)}</Text>
              </View>
              <View style={[s.check, on && s.checkOn]}>{on && <Check size={14} color="#fff" />}</View>
            </TouchableOpacity>
          );
        })}
        {!products.length && <Text style={s.emptyModal}>No products found.</Text>}
      </PickerModal>
    </SafeAreaView>
  );
};

const PickerModal: React.FC<{
  visible: boolean; title: string; onClose: () => void; doneLabel?: string; children: React.ReactNode;
}> = ({ visible, title, onClose, doneLabel, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={s.modalWrap}>
      <View style={s.modal}>
        <View style={s.modalHead}>
          <Text style={s.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalDone}>{doneLabel ?? 'Close'}</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 460 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 40 },
  body: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 22, fontFamily: Fonts.extraBold, color: Colors.text, marginTop: 4 },
  sub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, marginBottom: 18, lineHeight: 18 },
  label: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.text, marginTop: 16, marginBottom: 8 },
  optional: { fontFamily: Fonts.regular, color: Colors.textSecondary },
  picker: {
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 16,
    paddingVertical: 28, alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight10,
  },
  pickerTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.primary },
  pickerHint: { fontSize: 12, color: Colors.textSecondary },
  videoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
  },
  videoThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  videoName: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  videoMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  replaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: Colors.primaryLight10 },
  replaceTxt: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary },
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  selectTxt: { flex: 1, fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  selectPlaceholder: { color: Colors.textSecondary, fontFamily: Fonts.regular },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, minHeight: 72,
    textAlignVertical: 'top', fontFamily: Fonts.regular,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight10, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10, maxWidth: '100%' },
  chipTxt: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.primary, flexShrink: 1 },
  publish: {
    marginTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
  },
  publishBusy: { opacity: 0.7 },
  publishTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  // modal
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 30 : 16 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  modalDone: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowLogo: { width: 38, height: 38, borderRadius: 9, backgroundColor: Colors.backgroundGrey },
  rowLogoEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowLogoTxt: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textSecondary },
  rowName: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  rowPrice: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  emptyModal: { padding: 24, textAlign: 'center', color: Colors.textSecondary },
});

export default AdminVideoUploadScreen;
