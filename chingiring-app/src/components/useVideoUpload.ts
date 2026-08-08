import { useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { videosAPI } from '../api/videos';

// RN file descriptor, plus (on web) the underlying File for the actual upload.
export type PickedVideo = {
  uri: string;        // preview URL (native file uri, or web object URL)
  name: string;
  type: string;
  sizeMB?: number;
  _file?: File;       // web only
};

/**
 * Video picker → Cloudflare Stream uploader (mirrors useImageUpload, but the
 * target is Cloudflare Stream via our backend, not Cloudinary).
 *
 * Flow: pickVideo() chooses a file (no upload yet — the Stream upload URL is
 * per-store and minted at publish time). uploadVideo(file, storeId) then mints
 * the URL, pushes the bytes straight to Cloudflare, and returns the streamUid.
 */
export function useVideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickVideo = async (): Promise<PickedVideo | null> => {
    setError(null);

    if (Platform.OS === 'web') {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.style.display = 'none';
        input.addEventListener('change', (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          input.remove();
          if (!file) return resolve(null);
          resolve({
            uri: URL.createObjectURL(file),
            name: file.name,
            type: file.type || 'video/mp4',
            sizeMB: file.size / 1e6,
            _file: file,
          });
        });
        document.body.appendChild(input);
        input.click();
      });
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow library access to pick a video.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const a = result.assets[0];
    const name = a.fileName ?? a.uri.split('/').pop() ?? `video_${Date.now()}.mp4`;
    return {
      uri: a.uri,
      name,
      type: a.mimeType ?? 'video/mp4',
      sizeMB: a.fileSize ? a.fileSize / 1e6 : undefined,
    };
  };

  const uploadVideo = async (file: PickedVideo, storeId: string): Promise<string> => {
    setError(null);
    setUploading(true);
    try {
      const { data } = await videosAPI.createUploadUrl(storeId);
      const fd = new FormData();
      fd.append('file', (file._file ?? { uri: file.uri, name: file.name, type: file.type }) as any);
      const res = await fetch(data.uploadURL, { method: 'POST', body: fd });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${text.slice(0, 120)}`);
      }
      return data.streamUid;
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
      throw e;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, error, setError, pickVideo, uploadVideo };
}
