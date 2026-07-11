import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Upload, X, Link2, AlertCircle } from 'lucide-react-native';
import { Colors } from '../constants/theme';

// Web File (browser picker) or an RN file descriptor from expo-image-picker.
type CloudFile = File | { uri: string; name: string; type: string };

// ─── Cloudinary config ──────────────────────────────────────────────────────
// Pulled from .env at build time via EXPO_PUBLIC_ prefix. Setup steps live
// in the project's .env file.

const CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
const UPLOAD_URL    = CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  : '';

interface Props {
  /** Current image URL (passed in by the parent form). */
  value: string;
  /** Called with the uploaded image URL (or '' to clear). */
  onChange: (url: string) => void;
  /** Optional label rendered above the picker. */
  label?: string;
  /** Optional Cloudinary folder so admin uploads stay organised. */
  folder?: string;
  /** Disables the uploader (e.g. during form submission). */
  disabled?: boolean;
}

/**
 * Shared image picker → Cloudinary uploader → URL string.
 *
 * Web: opens a native file picker (no extra deps).
 * Native: falls back to a plain text URL input — `expo-image-picker` is not
 *         yet installed. Drop-in when added: replace the native branch with
 *         `ImagePicker.launchImageLibraryAsync()` and feed the resulting
 *         `uri` into uploadFile().
 *
 * On migrating to AWS S3 later: swap uploadToCloudinary() for an S3 signed
 * PUT. The component API (`value` / `onChange`) stays the same.
 */
export const ImageUploader: React.FC<Props> = ({
  value, onChange, label, folder, disabled,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isConfigured = !!CLOUD_NAME && !!UPLOAD_PRESET;

  // ── Upload helper (Cloudinary unsigned preset) ─────────────────────────
  const uploadToCloudinary = async (file: CloudFile): Promise<string> => {
    if (!isConfigured) {
      throw new Error(
        'Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ' +
        'and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.',
      );
    }
    const fd = new FormData();
    fd.append('file', file as any);
    fd.append('upload_preset', UPLOAD_PRESET);
    if (folder) fd.append('folder', folder);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudinary upload failed (${res.status}): ${text.slice(0, 120)}`);
    }
    const json = await res.json();
    if (!json.secure_url) throw new Error('Cloudinary returned no secure_url');
    return json.secure_url as string;
  };

  // ── Native photo picker (iOS / Android) → Cloudinary ───────────────────
  const openNativePicker = async () => {
    if (!isConfigured) {
      Alert.alert('Upload unavailable', 'Cloudinary is not configured. Paste an image URL instead.');
      setShowUrlInput(true);
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to upload an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const name = asset.fileName ?? uri.split('/').pop() ?? `image_${Date.now()}.jpg`;
      const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();
      const type = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      await handleFile({ uri, name, type });
    } catch (e: any) {
      setError(e?.message ?? 'Could not open photo library');
    }
  };

  // Web taps open the file picker; native taps open the photo library.
  const handlePickPress = () => {
    if (Platform.OS === 'web') openFilePicker();
    else openNativePicker();
  };

  // ── Web file picker ────────────────────────────────────────────────────
  const openFilePicker = () => {
    if (Platform.OS !== 'web') return;
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        await handleFile(file);
      });
      document.body.appendChild(input);
      fileInputRef.current = input;
    }
    fileInputRef.current.value = ''; // allow re-selecting same file
    fileInputRef.current.click();
  };

  const handleFile = async (file: CloudFile) => {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Preview / picker */}
      {value ? (
        <View style={styles.previewBox}>
          <Image source={{ uri: value }} style={styles.previewImg} resizeMode="cover" />
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => onChange('')}
            disabled={disabled}
          >
            <X size={14} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.replaceBtn}
            onPress={handlePickPress}
            disabled={disabled || uploading}
          >
            <Upload size={12} color="#fff" strokeWidth={2.5} />
            <Text style={styles.replaceBtnText}>{uploading ? 'Uploading…' : 'Replace'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.dropzone, uploading && styles.dropzoneBusy]}
          onPress={handlePickPress}
          disabled={disabled || uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.dropzoneText}>Uploading…</Text>
            </>
          ) : (
            <>
              <View style={styles.dropzoneIcon}>
                <Upload size={20} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.dropzoneTitle}>
                {Platform.OS === 'web' ? 'Click to upload an image' : 'Tap to upload a photo'}
              </Text>
              <Text style={styles.dropzoneHint}>PNG, JPG, WEBP up to 10 MB</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* "Or paste a URL" escape hatch — kept for both web (admin already has
          a hosted URL) and native (until expo-image-picker is wired). */}
      {!showUrlInput && !uploading ? (
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
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.urlCloseBtn}
            onPress={() => setShowUrlInput(false)}
          >
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
            UPLOAD_PRESET in .env to enable upload. Paste URL as fallback.
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { gap: 8 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },

  // Dropzone (empty state)
  dropzone: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#F5F8FF',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dropzoneBusy: { opacity: 0.7 },
  dropzoneIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  dropzoneTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.text,
  },
  dropzoneHint:  {
    fontSize: 11, color: Colors.textSecondary,
  },
  dropzoneText:  {
    fontSize: 13, color: Colors.textSecondary, fontWeight: '500',
  },

  // Preview (with image)
  previewBox: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e8ecf2',
  },
  previewImg: { width: '100%', height: '100%' },
  clearBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replaceBtn: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  replaceBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // URL toggle + input
  urlToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
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
    paddingHorizontal: 12,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  urlCloseBtn: {
    padding: 4,
  },

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

export default ImageUploader;
