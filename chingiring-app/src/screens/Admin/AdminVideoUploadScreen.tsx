import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Film, UploadCloud, Store as StoreIcon, Plus, Trash2, RefreshCw } from 'lucide-react-native';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { Colors, Fonts } from '../../constants/theme';
import { useVideoUpload, PickedVideo } from '../../components/useVideoUpload';
import { videosAPI } from '../../api/videos';

type ProductForm = { title: string; description: string; price: string };
const blankProduct = (): ProductForm => ({ title: '', description: '', price: '' });

export const AdminVideoUploadScreen = () => {
  const { uploading, pickVideo, uploadVideo } = useVideoUpload();
  const [saving, setSaving] = useState(false);
  const busy = uploading || saving;

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [storeName, setStoreName] = useState('');
  const [caption, setCaption] = useState('');
  const [products, setProducts] = useState<ProductForm[]>([]);

  const onPick = async () => {
    const f = await pickVideo();
    if (f) setVideo(f);
  };

  const addProduct = () => setProducts((p) => [...p, blankProduct()]);
  const updateProduct = (i: number, field: keyof ProductForm, value: string) =>
    setProducts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));

  const reset = () => { setVideo(null); setStoreName(''); setCaption(''); setProducts([]); };

  const onPublish = async () => {
    if (!video) return Alert.alert('Add a video', 'Pick a clip to upload first.');
    if (!storeName.trim()) return Alert.alert('Add a store', 'Enter the store / business name.');
    if (video.sizeMB && video.sizeMB > 200) {
      return Alert.alert('Too large', `That clip is ${video.sizeMB.toFixed(0)} MB. Keep it under 200 MB.`);
    }
    const tagged = products
      .filter((p) => p.title.trim() && p.price.trim())
      .map((p) => ({ title: p.title.trim(), description: p.description.trim() || undefined, price: Number(p.price) || 0 }));

    try {
      const streamUid = await uploadVideo(video, storeName.trim());
      setSaving(true);
      await videosAPI.createVideo({
        streamUid,
        store: { name: storeName.trim() },
        caption: caption.trim(),
        taggedProducts: tagged,
        cta: tagged.length ? { type: 'shop' } : { type: 'store' },
      });
      Alert.alert('Uploaded 🎬', 'Cloudflare is encoding it now. It appears in the feed once processing finishes.');
      reset();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <MobileAdminNav active="AdminVideos" />

        <View style={s.body}>
          <Text style={s.h1}>Add a video</Text>
          <Text style={s.sub}>Upload a shoppable clip. It goes live once Cloudflare finishes encoding.</Text>

          {/* Clip */}
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

          {/* Store — free text */}
          <Text style={s.label}>Store / business</Text>
          <View style={s.inputRow}>
            <StoreIcon size={18} color={Colors.textSecondary} />
            <TextInput
              style={s.inputFlex}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="e.g. Brew & Co"
              placeholderTextColor={Colors.textSecondary}
              maxLength={80}
            />
          </View>

          {/* Caption */}
          <Text style={s.label}>Caption</Text>
          <TextInput
            style={s.textarea}
            value={caption}
            onChangeText={setCaption}
            placeholder="e.g. New cold-brew menu is live ❄️"
            placeholderTextColor={Colors.textSecondary}
            maxLength={300}
            multiline
          />

          {/* Products — inline entries */}
          <View style={s.prodHead}>
            <Text style={s.label}>Products <Text style={s.optional}>· optional</Text></Text>
            <TouchableOpacity style={s.addBtn} onPress={addProduct} disabled={busy}>
              <Plus size={15} color={Colors.primary} />
              <Text style={s.addTxt}>Add product</Text>
            </TouchableOpacity>
          </View>

          {products.length === 0 && (
            <Text style={s.prodEmpty}>Add products with a title, description and price to make the clip shoppable.</Text>
          )}

          {products.map((p, i) => (
            <View key={i} style={s.prodCard}>
              <View style={s.prodCardHead}>
                <Text style={s.prodIndex}>Product {i + 1}</Text>
                <TouchableOpacity onPress={() => removeProduct(i)} disabled={busy}>
                  <Trash2 size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.prodInput}
                value={p.title}
                onChangeText={(v) => updateProduct(i, 'title', v)}
                placeholder="Product title"
                placeholderTextColor={Colors.textSecondary}
              />
              <TextInput
                style={[s.prodInput, s.prodDesc]}
                value={p.description}
                onChangeText={(v) => updateProduct(i, 'description', v)}
                placeholder="Description"
                placeholderTextColor={Colors.textSecondary}
                multiline
              />
              <View style={s.priceRow}>
                <Text style={s.rupee}>₹</Text>
                <TextInput
                  style={s.priceInput}
                  value={p.price}
                  onChangeText={(v) => updateProduct(i, 'price', v.replace(/[^0-9]/g, ''))}
                  placeholder="Price"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          ))}

          {/* Publish */}
          <TouchableOpacity style={[s.publish, busy && s.publishBusy]} onPress={onPublish} disabled={busy}>
            {busy
              ? <><ActivityIndicator color="#fff" /><Text style={s.publishTxt}>{uploading ? 'Uploading…' : 'Saving…'}</Text></>
              : <><UploadCloud size={18} color="#fff" /><Text style={s.publishTxt}>Publish video</Text></>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 44 },
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
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14,
  },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: 14, color: Colors.text, fontFamily: Fonts.medium },
  textarea: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, minHeight: 72,
    textAlignVertical: 'top', fontFamily: Fonts.regular,
  },
  prodHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: Colors.primaryLight10, marginTop: 8 },
  addTxt: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary },
  prodEmpty: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  prodCard: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    padding: 12, marginTop: 10, gap: 8,
  },
  prodCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prodIndex: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textSecondary },
  prodInput: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular,
  },
  prodDesc: { minHeight: 54, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12 },
  rupee: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text },
  priceInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text, fontFamily: Fonts.semiBold },
  publish: {
    marginTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
  },
  publishBusy: { opacity: 0.7 },
  publishTxt: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
});

export default AdminVideoUploadScreen;
