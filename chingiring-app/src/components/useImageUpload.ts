import { useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Web File (browser picker) or an RN file descriptor from expo-image-picker.
export type CloudFile = File | { uri: string; name: string; type: string };

// ─── Cloudinary config ──────────────────────────────────────────────────────
// Pulled from .env at build time via EXPO_PUBLIC_ prefix. Setup steps live in
// the project's .env file. Shared by ImageUploader (single) and
// MultiImageUploader (gallery) so upload behaviour stays identical.

const CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';
const UPLOAD_URL    = CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  : '';

/**
 * Shared image picker → Cloudinary uploader.
 *
 * Web: opens a native file picker (no extra deps).
 * Native: opens the photo library via expo-image-picker.
 *
 * `pick(onUploaded)` runs the whole flow (choose → upload → callback with the
 * secure URL). Callers decide what to do with the URL — set a single value, or
 * append to a gallery.
 *
 * On migrating to AWS S3 later: swap uploadToCloudinary() for an S3 signed PUT.
 * The hook's surface (`pick` / `uploading` / `error`) stays the same.
 */
export function useImageUpload(folder?: string) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const isConfigured = !!CLOUD_NAME && !!UPLOAD_PRESET;

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

  const handleFile = async (file: CloudFile, onUploaded: (url: string) => void) => {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onUploaded(url);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Web file picker (fresh input per call to avoid stale closures) ──────
  const openFilePicker = (onUploaded: (url: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      input.remove();
      if (file) await handleFile(file, onUploaded);
    });
    document.body.appendChild(input);
    input.click();
  };

  // ── Native photo picker (iOS / Android) ────────────────────────────────
  const openNativePicker = async (onUploaded: (url: string) => void) => {
    if (!isConfigured) {
      Alert.alert('Upload unavailable', 'Cloudinary is not configured. Paste an image URL instead.');
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
      await handleFile({ uri, name, type }, onUploaded);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open photo library');
    }
  };

  /** Open the platform picker, upload the chosen image, call back with its URL. */
  const pick = (onUploaded: (url: string) => void) => {
    if (Platform.OS === 'web') openFilePicker(onUploaded);
    else openNativePicker(onUploaded);
  };

  return { uploading, error, setError, isConfigured, pick };
}
