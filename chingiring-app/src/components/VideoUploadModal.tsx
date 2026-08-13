import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Film, UploadCloud, Store as StoreIcon, Globe, Plus, Trash2, RefreshCw, Save } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { useVideoUpload, PickedVideo } from './useVideoUpload';
import { videosAPI, FeedVideo } from '../api/videos';
import { notify } from '../utils/dialog';
import LocalVideoPreview from './LocalVideoPreview';

type ProductForm = { title: string; description: string; price: string; url: string };
const blankProduct = (): ProductForm => ({ title: '', description: '', price: '', url: '' });

const MAX_SEC = 30;
const fmtDur = (s?: number) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful publish/save so the parent list can refetch. */
  onUploaded?: () => void;
  /** When set, the modal edits this clip's metadata instead of uploading a new one. */
  editing?: FeedVideo | null;
}

/**
 * Post OR edit a shoppable video. Create mode picks a clip + uploads; edit mode
 * prefills from `editing` and PATCHes just the metadata (store / caption /
 * products) — the video file itself isn't re-uploadable here.
 */
export const VideoUploadModal: React.FC<Props> = ({ visible, onClose, onUploaded, editing }) => {
  const isEdit = !!editing;
  const { uploading, pickVideo, uploadVideo } = useVideoUpload();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const busy = uploading || saving;

  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [storeName, setStoreName] = useState('');
  const [website, setWebsite] = useState('');
  const [caption, setCaption] = useState('');
  const [products, setProducts] = useState<ProductForm[]>([]);

  const reset = () => { setVideo(null); setStoreName(''); setWebsite(''); setCaption(''); setProducts([]); };

  // Prefill on open for edit; clear for a fresh post.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setVideo(null);
      setStoreName(editing.store?.name ?? '');
      setWebsite(editing.store?.website ?? '');
      setCaption(editing.caption ?? '');
      setProducts((editing.taggedProducts ?? []).map((p) => ({
        title: p.title, description: p.description ?? '', price: String(p.price ?? ''), url: p.url ?? '',
      })));
    } else {
      reset();
    }
  }, [visible, editing]);

  const onPick = async () => { const f = await pickVideo(); if (f) setVideo(f); };
  const addProduct = () => setProducts((p) => [...p, blankProduct()]);
  const updateProduct = (i: number, field: keyof ProductForm, value: string) =>
    setProducts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeProduct = (i: number) => setProducts((p) => p.filter((_, idx) => idx !== i));

  const close = () => { if (!busy) { reset(); onClose(); } };

  // Block over-length clips before upload (OS trim handles the cut on iOS; the
  // provider would otherwise reject a >30s upload after the fact).
  const overLength = !isEdit && !!video?.durationSec && video.durationSec > MAX_SEC + 0.5;

  const onSubmit = async () => {
    if (!isEdit && !video) return notify('Add a video', 'Pick a clip to upload first.');
    if (!storeName.trim()) return notify('Add a store', 'Enter the store / business name.');
    if (!isEdit && video?.sizeMB && video.sizeMB > 200) {
      return notify('Too large', `That clip is ${video.sizeMB.toFixed(0)} MB. Keep it under 200 MB.`);
    }
    if (overLength) {
      return notify('Clip too long', `This clip is ${fmtDur(video!.durationSec)} — trim it to ${MAX_SEC} seconds. On iPhone you can trim right in the picker; on web/Android, shorten it before uploading.`);
    }
    const tagged = products
      .filter((p) => p.title.trim() && p.price.trim())
      .map((p) => ({ title: p.title.trim(), description: p.description.trim() || undefined, price: Number(p.price) || 0, url: p.url.trim() || undefined }));
    const cta = (tagged.length ? { type: 'shop' } : { type: 'store' }) as { type: 'shop' | 'store' };
    const store = { name: storeName.trim(), website: website.trim() || undefined };

    try {
      let streamUid = '';
      if (!isEdit) streamUid = await uploadVideo(video!, storeName.trim());
      setSaving(true);
      if (isEdit) {
        await videosAPI.adminUpdate(editing!._id, { store, caption: caption.trim(), taggedProducts: tagged, cta });
      } else {
        await videosAPI.createVideo({ streamUid, store, caption: caption.trim(), taggedProducts: tagged, cta });
      }
      qc.invalidateQueries({ queryKey: ['videoFeed'] });
      onUploaded?.();
      notify(isEdit ? 'Saved ✓' : 'Uploaded 🎬', isEdit ? 'Your changes are live.' : "It's encoding now — it'll appear automatically once that finishes.");
      reset();
      onClose();
    } catch (e: any) {
      notify(isEdit ? 'Save failed' : 'Upload failed', e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} transparent={false}>
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{isEdit ? 'Edit video' : 'Post a video'}</Text>
          <TouchableOpacity onPress={close} disabled={busy} style={s.closeBtn} hitSlop={8}>
            <X size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Text style={s.sub}>
              {isEdit ? 'Update the store, caption and products for this clip.' : 'Upload a shoppable clip. It goes live once encoding finishes.'}
            </Text>

            {/* Clip */}
            <Text style={s.label}>Clip</Text>
            {isEdit ? (
              <View style={s.videoCard}>
                {editing?.thumbnailUrl
                  ? <Image source={{ uri: editing.thumbnailUrl }} style={s.currentThumb} resizeMode="cover" />
                  : <View style={[s.currentThumb, s.videoThumb]}><Film size={20} color="#fff" /></View>}
                <Text style={s.currentNote}>The video file can’t be changed here — edit its details below.</Text>
              </View>
            ) : !video ? (
              <TouchableOpacity style={s.picker} onPress={onPick} disabled={busy}>
                <UploadCloud size={28} color={Colors.primary} />
                <Text style={s.pickerTitle}>Choose a video</Text>
                <Text style={s.pickerHint}>Portrait 9:16 · ≤ 30s · ≤ 200 MB</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.pickedWrap}>
                <View style={s.previewBox}>
                  <LocalVideoPreview uri={video.uri} />
                </View>
                <View style={s.pickedMetaRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.videoName} numberOfLines={1}>{video.name}</Text>
                    <Text style={s.videoMeta}>
                      {[fmtDur(video.durationSec), video.sizeMB ? `${video.sizeMB.toFixed(1)} MB` : null].filter(Boolean).join(' · ') || 'ready'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={onPick} disabled={busy} style={s.replaceBtn}>
                    <RefreshCw size={16} color={Colors.primary} />
                    <Text style={s.replaceTxt}>Replace</Text>
                  </TouchableOpacity>
                </View>
                {overLength && (
                  <View style={s.warnRow}>
                    <Text style={s.warnTxt}>This clip is {fmtDur(video.durationSec)} — trim it to {MAX_SEC}s before publishing.</Text>
                  </View>
                )}
              </View>
            )}

            {/* Store */}
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

            {/* Website — links from the store name + shows at the caption end */}
            <Text style={s.label}>Website <Text style={s.optional}>· optional</Text></Text>
            <View style={s.inputRow}>
              <Globe size={18} color={Colors.textSecondary} />
              <TextInput
                style={s.inputFlex}
                value={website}
                onChangeText={setWebsite}
                placeholder="e.g. brewandco.com"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={200}
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

            {/* Products */}
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
                <TextInput style={s.prodInput} value={p.title} onChangeText={(v) => updateProduct(i, 'title', v)} placeholder="Product title" placeholderTextColor={Colors.textSecondary} />
                <TextInput style={[s.prodInput, s.prodDesc]} value={p.description} onChangeText={(v) => updateProduct(i, 'description', v)} placeholder="Description" placeholderTextColor={Colors.textSecondary} multiline />
                <View style={s.priceRow}>
                  <Text style={s.rupee}>₹</Text>
                  <TextInput style={s.priceInput} value={p.price} onChangeText={(v) => updateProduct(i, 'price', v.replace(/[^0-9]/g, ''))} placeholder="Price" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </View>
                <TextInput style={s.prodInput} value={p.url} onChangeText={(v) => updateProduct(i, 'url', v)} placeholder="Buy link (optional)" placeholderTextColor={Colors.textSecondary} autoCapitalize="none" keyboardType="url" />
              </View>
            ))}

            {/* Submit */}
            <TouchableOpacity style={[s.publish, (busy || overLength) && s.publishBusy]} onPress={onSubmit} disabled={busy || overLength}>
              {busy
                ? <><ActivityIndicator color="#fff" /><Text style={s.publishTxt}>{uploading ? 'Uploading…' : 'Saving…'}</Text></>
                : isEdit
                  ? <><Save size={18} color="#fff" /><Text style={s.publishTxt}>Save changes</Text></>
                  : <><UploadCloud size={18} color="#fff" /><Text style={s.publishTxt}>Publish video</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text },
  closeBtn: { padding: 4 },
  scroll: { padding: 16, paddingBottom: 44, maxWidth: 640, width: '100%', alignSelf: 'center' },
  sub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 6, lineHeight: 18 },
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
  pickedWrap: {
    padding: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
  },
  previewBox: {
    height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', position: 'relative',
  },
  pickedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  warnRow: { marginTop: 10, backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  warnTxt: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: '#b45309', lineHeight: 17 },
  videoThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  currentThumb: { width: 44, height: 56, borderRadius: 8, backgroundColor: '#334155' },
  currentNote: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
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

export default VideoUploadModal;
