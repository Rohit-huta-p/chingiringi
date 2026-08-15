import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Platform,
  ActivityIndicator,
} from 'react-native';
import { Upload, X, Plus, Link2, AlertCircle, ClipboardPaste } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useImageUpload, importRemoteImage } from './useImageUpload';

interface Props {
  /** Current image URLs. First entry is the cover. */
  value: string[];
  /** Called with the next gallery array (add / remove / reorder). */
  onChange: (urls: string[]) => void;
  /** Cloudinary folder so admin uploads stay organised. */
  folder?: string;
  /** Disables the uploader (e.g. during form submission). */
  disabled?: boolean;
  /** Max images allowed. Default 6. */
  max?: number;
  /** Thumbnail aspect ratio (width / height). Default square. Pass 16/9 for banners. */
  aspect?: number;
  /** Thumbnail width in px. Default 84. Bump it for landscape previews. */
  thumbWidth?: number;
  /** Label shown on the first (cover) thumb. Default "Cover". */
  coverLabel?: string;
}

/**
 * Multi-image gallery picker → Cloudinary → string[] (cover first).
 *
 * Shares the picker/upload flow with ImageUploader via `useImageUpload`. Each
 * successful upload appends to the array; the first entry is treated as the
 * cover everywhere (product.imageUrl mirrors value[0]). Tap a non-cover thumb
 * to promote it to cover; the ✕ removes a thumb.
 */
export const MultiImageUploader: React.FC<Props> = ({
  value, onChange, folder, disabled, max = 6, aspect, thumbWidth, coverLabel = 'Cover',
}) => {
  const tw = thumbWidth ?? THUMB;
  const th = aspect ? Math.round(tw / aspect) : tw;
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const { uploading, error, isConfigured, pick, uploadFile } = useImageUpload(folder);

  const atMax = value.length >= max;

  const append = (url: string) => {
    if (!url) return;
    if (value.includes(url)) return;      // no dupes
    if (value.length >= max) return;
    onChange([...value, url]);
  };

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  const makeCover = (i: number) => {
    if (i === 0) return;
    const next = [...value];
    const [moved] = next.splice(i, 1);
    next.unshift(moved);
    onChange(next);
  };

  const addUrlDraft = () => {
    const u = urlDraft.trim();
    if (!u) return;
    append(u);
    setUrlDraft('');
    setShowUrlInput(false);
  };

  // ── Web paste + drag-drop ──────────────────────────────────────────────────
  // Lets the admin right-click a product image → Copy Image, then paste (⌘V while
  // hovering) or drag it straight onto the uploader — no Save-As, no file picker.
  // Image blobs upload to Cloudinary; dropped/pasted image URLs are auto-hosted.
  // DOM listeners are attached once and read the latest props via refs.
  const dropRef = useRef<any>(null);
  const hoveredRef = useRef(false);
  const appendRef = useRef(append);        appendRef.current = append;
  const uploadFileRef = useRef(uploadFile); uploadFileRef.current = uploadFile;
  const disabledRef = useRef(disabled);    disabledRef.current = disabled;
  const atMaxRef = useRef(atMax);          atMaxRef.current = atMax;
  const folderRef = useRef(folder);        folderRef.current = folder;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = dropRef.current;
    if (!node || typeof node.addEventListener !== 'function') return;

    const busy = () => disabledRef.current || atMaxRef.current;
    const importUrl = async (url: string) => {
      try { appendRef.current(await importRemoteImage(url, folderRef.current)); }
      catch { appendRef.current(url); }
    };
    const handleBlob = (file: File) => uploadFileRef.current(file as any, (u) => appendRef.current(u));

    const onDragOver = (e: DragEvent) => { if (busy()) return; e.preventDefault(); setDragActive(true); };
    const onDragLeave = () => setDragActive(false);
    const onDrop = (e: DragEvent) => {
      setDragActive(false);
      if (busy()) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) { handleBlob(file); return; }
      const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
      if (url && /^https?:\/\//i.test(url.trim())) importUrl(url.trim());
    };
    const onEnter = () => { hoveredRef.current = true; };
    const onLeave = () => { hoveredRef.current = false; };
    const onPaste = (e: ClipboardEvent) => {
      if (!hoveredRef.current || busy()) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return; // don't hijack real fields
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find((it) => it.type.startsWith('image/'));
      if (img) { const f = img.getAsFile(); if (f) { e.preventDefault(); handleBlob(f); } return; }
      const text = e.clipboardData?.getData('text') ?? '';
      if (/^https?:\/\//i.test(text.trim())) { e.preventDefault(); importUrl(text.trim()); }
    };

    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    node.addEventListener('mouseenter', onEnter);
    node.addEventListener('mouseleave', onLeave);
    document.addEventListener('paste', onPaste);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
      node.removeEventListener('mouseenter', onEnter);
      node.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  return (
    <View ref={dropRef} style={[styles.wrap, dragActive && styles.wrapDrag]}>
      {/* Thumbnail grid + add tile */}
      <View style={styles.grid}>
        {value.map((url, i) => (
          <TouchableOpacity
            key={`${url}-${i}`}
            style={[styles.thumb, { width: tw, height: th }]}
            activeOpacity={0.85}
            onPress={() => makeCover(i)}
            disabled={disabled}
          >
            <Image source={{ uri: url }} style={styles.thumbImg} resizeMode="cover" />

            {/* Cover badge on the first image */}
            {i === 0 ? (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>{coverLabel}</Text>
              </View>
            ) : (
              <View style={styles.makeCoverHint}>
                <Text style={styles.makeCoverHintText}>Set {coverLabel.toLowerCase()}</Text>
              </View>
            )}

            {/* Remove */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => remove(i)}
              disabled={disabled}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={12} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add tile */}
        {!atMax ? (
          <TouchableOpacity
            style={[styles.addTile, { width: tw, height: th }, uploading && styles.addTileBusy, dragActive && styles.addTileDrag]}
            onPress={() => pick(append)}
            disabled={disabled || uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <View style={styles.addIcon}>
                  <Plus size={18} color={Colors.primary} strokeWidth={2.5} />
                </View>
                <Text style={styles.addText}>
                  {value.length === 0 ? 'Add photos' : 'Add'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Helper line */}
      <Text style={styles.helper}>
        {value.length}/{max} · first image is the cover
        {value.length > 1 ? ' · tap another to make it cover' : ''}
      </Text>

      {/* Web: paste / drag hint — the fast path for merchant images */}
      {Platform.OS === 'web' && !atMax ? (
        <View style={styles.pasteHint}>
          <ClipboardPaste size={12} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.pasteHintText}>
            Copy Image on the site, then paste (⌘/Ctrl+V) or drag it here — no download needed.
          </Text>
        </View>
      ) : null}

      {/* "Or paste a URL" escape hatch (appends) */}
      {!showUrlInput && !atMax ? (
        <TouchableOpacity
          style={styles.urlToggle}
          onPress={() => setShowUrlInput(true)}
          disabled={disabled}
        >
          <Link2 size={12} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={styles.urlToggleText}>Or paste an image URL</Text>
        </TouchableOpacity>
      ) : null}

      {showUrlInput ? (
        <View style={styles.urlInputWrap}>
          <TextInput
            style={styles.urlInput}
            placeholder="https://…"
            placeholderTextColor="#94a3b8"
            value={urlDraft}
            onChangeText={setUrlDraft}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={addUrlDraft}
          />
          <TouchableOpacity style={styles.urlAddBtn} onPress={addUrlDraft}>
            <Text style={styles.urlAddText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.urlCloseBtn} onPress={() => setShowUrlInput(false)}>
            <X size={14} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Errors + config warning */}
      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color="#dc2626" strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!isConfigured && Platform.OS === 'web' ? (
        <View style={styles.warnRow}>
          <AlertCircle size={12} color="#b45309" strokeWidth={2} />
          <Text style={styles.warnText}>
            Cloudinary not configured — set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME +
            UPLOAD_PRESET in .env to enable upload. Paste URLs as fallback.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const THUMB = 84;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  wrapDrag: {
    ...(Platform.OS === 'web'
      ? ({ outline: `2px dashed ${Colors.primary}`, outlineOffset: 4, borderRadius: 12 } as any)
      : {}),
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Thumbnail
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e8ecf2',
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    paddingVertical: 3,
    alignItems: 'center',
  },
  coverBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  makeCoverHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  makeCoverHintText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // Add tile
  addTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#F5F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileBusy: { opacity: 0.7 },
  addTileDrag: { borderColor: Colors.primary, borderStyle: 'solid', backgroundColor: '#eff6ff' },
  addIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  addText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  helper: { fontSize: 11, color: Colors.textSecondary },
  pasteHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5,
  },
  pasteHintText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  // URL toggle + input
  urlToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  urlToggleText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  urlInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 6,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  urlAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  urlAddText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  urlCloseBtn: { padding: 4 },

  // Status rows
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorText: { fontSize: 11, color: '#dc2626', flex: 1 },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warnText: { fontSize: 11, color: '#b45309', flex: 1, lineHeight: 15 },
});

export default MultiImageUploader;
