import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Gradient } from '../../constants/theme';
import { useAuthStore } from '../../store';
import { profileAPI } from '../../api/profile';
import { MobileAuthHeader } from '../../components/MobileAuthHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// ─── Helpers ────────────────────────────────────────────────────────────────

function userInitials(name?: string | null): string {
  if (!name) return 'U';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// Cloudinary config — same env vars the shared ImageUploader uses.
const CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

// Accepts either a web File (browser) or an RN-style file descriptor
// { uri, name, type } produced by expo-image-picker.
type CloudFile = File | { uri: string; name: string; type: string };

async function uploadAvatarToCloudinary(file: CloudFile): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary not configured. Set EXPO_PUBLIC_CLOUDINARY_* in .env.');
  }
  const fd = new FormData();
  fd.append('file', file as any);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', 'chingiringi/avatars');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST', body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  if (!json.secure_url) throw new Error('Cloudinary returned no URL');
  return json.secure_url as string;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export const MobileEditProfileScreen = () => {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const user = useAuthStore((st) => st.user);
  const hydrate = useAuthStore((st) => st.hydrate);
  const refresh = usePullToRefresh();

  const [name,  setName]  = useState(user?.name  ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatarUrl ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const dirty =
    name  !== (user?.name  ?? '') ||
    email !== (user?.email ?? '') ||
    phone !== (user?.phone ?? '') ||
    avatarUrl !== (user?.avatarUrl ?? '');

  const saveMutation = useMutation({
    mutationFn: () => profileAPI.updateProfile({ name, email, phone, avatarUrl }),
    onSuccess: async () => {
      await hydrate();
      qc.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    },
    onError: (e: any) => {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not save changes');
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name cannot be empty');
      return;
    }
    saveMutation.mutate();
  };

  const handleAvatarPress = async () => {
    // ── Web: hidden <input type="file"> ───────────────────────────────
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
          const url = await uploadAvatarToCloudinary(file);
          setAvatarUrl(url);
        } catch (err: any) {
          Alert.alert('Upload failed', err?.message ?? 'Try again');
        } finally {
          setUploadingAvatar(false);
        }
      });
      document.body.appendChild(input);
      input.click();
      return;
    }

    // ── Native (iOS / Android): expo-image-picker ─────────────────────
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Please allow photo library access to change your profile picture.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      // Derive a sensible filename + mime from the picked asset.
      const uri  = asset.uri;
      const name = asset.fileName ?? uri.split('/').pop() ?? `avatar_${Date.now()}.jpg`;
      const ext  = (name.split('.').pop() ?? 'jpg').toLowerCase();
      const type = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      setUploadingAvatar(true);
      try {
        const url = await uploadAvatarToCloudinary({ uri, name, type });
        setAvatarUrl(url);
      } catch (err: any) {
        Alert.alert('Upload failed', err?.message ?? 'Try again');
      } finally {
        setUploadingAvatar(false);
      }
    } catch (err: any) {
      Alert.alert('Photo picker error', err?.message ?? 'Could not open photo library');
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl {...refresh} />}
      >
        {/* Shared blue gradient header — scrolls with the rest of the page.
            extraBottomSpace leaves room for the avatar card to overlap. */}
        <MobileAuthHeader
          kicker="ACCOUNT"
          title="Edit Profile"
          align="left"
        />

        {/* Avatar card overlaps header bottom but lives in the same scroll
            container, so the whole page scrolls as one unit. */}
        <View style={s.avatarCardWrap}>
          <View style={s.avatarCard}>
            <TouchableOpacity
              style={s.avatarTouch}
              activeOpacity={0.85}
              onPress={handleAvatarPress}
              disabled={uploadingAvatar}
            >
              <View style={s.avatarRing}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarImg} resizeMode="cover" />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarInitials}>{userInitials(user?.name)}</Text>
                  </View>
                )}
              </View>
              <View style={s.cameraBadge}>
                {uploadingAvatar
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Camera size={14} color="#fff" strokeWidth={2.4} />}
              </View>
            </TouchableOpacity>
            <Text style={s.avatarCaption}>
              {uploadingAvatar ? 'Uploading…' : 'Click to upload new photo'}
            </Text>
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.fieldLabel}>Full Name</Text>
          <TextInput
            style={s.input}
            placeholder="Your full name"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <View style={s.labelRow}>
            <Text style={s.fieldLabel}>Username</Text>
            <Text style={s.fieldLabelHint}>(Can't be changed)</Text>
          </View>
          <TextInput
            style={[s.input, s.inputDisabled]}
            value={user?.username ?? ''}
            editable={false}
          />

          <Text style={s.fieldLabel}>Email Address</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Text style={s.helperText}>Used for important account notifications</Text>

          <Text style={s.fieldLabel}>Phone Number</Text>
          <TextInput
            style={s.input}
            placeholder="9876543210"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={15}
          />
          <Text style={s.helperText}>Used for OTP verification and cashback updates</Text>

          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.cancelBtn}
              activeOpacity={0.85}
              onPress={() => nav.goBack()}
              disabled={saveMutation.isPending}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[s.saveBtnWrap, (!dirty || saveMutation.isPending) && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={!dirty || saveMutation.isPending}
            >
              <LinearGradient
                colors={Gradient.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.saveBtn}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#fff" strokeWidth={2.2} />
                    <Text style={s.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F8FF' },

  // Avatar card — overlaps the bottom of the shared header by ~40px.
  avatarCardWrap: {
    marginTop: -40,
    paddingHorizontal: 16,
    marginBottom: 18,
    zIndex: 2,
  },
  avatarCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  avatarTouch: { position: 'relative' },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: '#fde68a',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  avatarInitials: { color: '#fff', fontSize: 28, fontFamily: Fonts.extraBold },

  cameraBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    borderWidth: 3, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarCaption: {
    marginTop: 10, fontSize: 12, color: Colors.textSecondary, fontFamily: Fonts.medium,
  },

  // Form
  form: { paddingHorizontal: 16 },

  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fieldLabel: {
    fontSize: 13, fontFamily: Fonts.bold, color: Colors.text,
    marginTop: 12, marginBottom: 8,
  },
  fieldLabelHint: {
    fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.regular,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 14, color: Colors.text,
    borderWidth: 1, borderColor: '#eef2f7',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  helperText: {
    fontSize: 11, color: Colors.textSecondary,
    marginTop: 6, marginLeft: 4,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    marginBottom: 32,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  cancelBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  saveBtnWrap: {
    flex: 1.4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});

export default MobileEditProfileScreen;
