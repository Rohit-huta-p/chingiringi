import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, Check, X, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { verificationAPI } from '../api/verification';
import type { CloudFile } from './useImageUpload';

/** A held private upload — identifiers only, never a public URL. */
export type KycValue = { publicId: string; format?: string };

interface Props {
  /** Which KYC slot this is — sets the private folder + deterministic id server-side. */
  kind: 'doc' | 'id' | 'selfie';
  /** Shown on the add tile, e.g. "Government ID", "Selfie", "Store document". */
  label: string;
  value: KycValue | null;
  onChange: (v: KycValue | null) => void;
  /** Signed URL the parent fetched, to preview an already-submitted document. */
  previewUrl?: string | null;
  disabled?: boolean;
  /** Thumbnail width/height ratio. Default 1.4 (landscape, good for IDs). */
  aspect?: number;
  /** Thumbnail width in px. Default 150. */
  width?: number;
}

/**
 * Private KYC image picker. Unlike MultiImageUploader (which uploads unsigned to
 * a public Cloudinary URL), this streams the image through our backend to a
 * private (authenticated) Cloudinary asset and holds only its publicId. Preview
 * uses the locally-picked image; on a fresh open of an already-submitted doc the
 * parent may pass a signed `previewUrl`, otherwise an "Uploaded" state is shown.
 */
export const KycUploader: React.FC<Props> = ({
  kind, label, value, onChange, previewUrl, disabled, aspect = 1.4, width = 150,
}) => {
  const w = width;
  const h = Math.round(w / aspect);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const doUpload = async (file: CloudFile, preview: string) => {
    setError(null);
    setUploading(true);
    try {
      const res = await verificationAPI.kycUpload(file, kind);
      onChange({ publicId: res.publicId, format: res.format });
      setLocalUri(preview);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const pickWeb = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      input.remove();
      if (file) await doUpload(file, URL.createObjectURL(file));
    });
    document.body.appendChild(input);
    input.click();
  };

  const pickNative = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError('Allow photo library access to upload.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.fileName ?? uri.split('/').pop() ?? `kyc_${label}.jpg`;
      const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
      const type = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      await doUpload({ uri, name, type }, uri);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open photo library');
    }
  };

  const pick = () => { if (Platform.OS === 'web') pickWeb(); else pickNative(); };
  const remove = () => { setLocalUri(null); onChange(null); };

  const shownPreview = localUri ?? previewUrl ?? null;
  const hasDoc = !!value?.publicId || !!shownPreview;

  return (
    <View style={styles.wrap}>
      {hasDoc ? (
        <View style={[styles.tile, { width: w, height: h }]}>
          {shownPreview ? (
            <Image source={{ uri: shownPreview }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={styles.uploadedFill}>
              <Check size={22} color="#16A34A" strokeWidth={2.5} />
              <Text style={styles.uploadedText}>Uploaded</Text>
            </View>
          )}
          <View style={styles.badge}>
            <ShieldCheck size={11} color="#fff" strokeWidth={2.5} />
            <Text style={styles.badgeText}>Private</Text>
          </View>
          {!disabled && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={remove}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={12} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addTile, { width: w, height: h }, uploading && { opacity: 0.7 }]}
          onPress={pick}
          disabled={disabled || uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <View style={styles.addIcon}><Upload size={17} color={Colors.primary} strokeWidth={2.5} /></View>
              <Text style={styles.addText}>Add {label}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {hasDoc && !disabled ? (
        <TouchableOpacity onPress={pick} disabled={uploading}>
          <Text style={styles.replaceText}>{uploading ? 'Uploading…' : 'Replace'}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.privacyRow}>
        <ShieldCheck size={11} color={Colors.textSecondary} strokeWidth={2} />
        <Text style={styles.privacyText}>Only you and the reviewer can view this.</Text>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color="#dc2626" strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default KycUploader;

const styles = StyleSheet.create({
  wrap: { gap: 6, alignSelf: 'flex-start' },
  tile: {
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e8ecf2',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  uploadedFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F0FDF4' },
  uploadedText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#16A34A' },
  badge: {
    position: 'absolute', left: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontFamily: Fonts.bold, letterSpacing: 0.2 },
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  addTile: {
    borderRadius: 10, borderWidth: 1.5, borderColor: '#cbd5e1', borderStyle: 'dashed',
    backgroundColor: '#F5F8FF', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  addIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  addText: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: Colors.text },
  replaceText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.primary },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 200 },
  privacyText: { fontSize: 10.5, fontFamily: Fonts.regular, color: Colors.textSecondary, flexShrink: 1 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef2f2', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 240,
  },
  errorText: { fontSize: 11, fontFamily: Fonts.regular, color: '#dc2626', flex: 1 },
});
