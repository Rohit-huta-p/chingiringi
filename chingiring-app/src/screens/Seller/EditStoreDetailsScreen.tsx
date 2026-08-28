import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { Input } from '../../components/Input';
import { ImageUploader } from '../../components/ImageUploader';
import { MultiImageUploader } from '../../components/MultiImageUploader';
import { storesAPI, type MyStoreUpdate } from '../../api/stores';
import { useMyStore } from '../../hooks/useMyStore';

// Must match the backend STORE_CATEGORIES enum (storeModel.js).
const CATEGORIES = ['Fashion', 'Electronics', 'Grocery', 'Food & Cafe', 'Health', 'Jewellery', 'Sports', 'Beauty'];

/**
 * EditStoreDetailsScreen — a seller edits their own store (PATCH /api/stores/mine).
 * Reached from the seller Profile. Pre-filled from useMyStore(); saving
 * invalidates ['seller','myStore'] so the Dashboard / My Store refresh.
 */
export const EditStoreDetailsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { data: store, isLoading } = useMyStore();

  const [logoUrl, setLogoUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the form from the loaded store, once.
  useEffect(() => {
    if (store && !seeded) {
      setLogoUrl(store.logoUrl ?? '');
      setImages(store.images ?? []);
      setName(store.name ?? '');
      setCategory(store.category ?? '');
      setDescription(store.description ?? '');
      setPhone(store.phone ?? '');
      setWebsite(store.website ?? '');
      setAddress(store.address ?? '');
      setArea(store.area ?? '');
      setCity(store.city ?? '');
      setSeeded(true);
    }
  }, [store, seeded]);

  const valid = name.trim().length >= 2 && !!category && address.trim().length >= 3;

  const handleSave = async () => {
    if (!valid) {
      Alert.alert('Missing details', 'Store name, category and address are required.');
      return;
    }
    setSaving(true);
    try {
      const input: MyStoreUpdate = {
        name: name.trim(),
        category,
        description: description.trim(),
        logoUrl: logoUrl || undefined,
        images,
        phone: phone.trim(),
        website: website.trim(),
        address: address.trim(),
        area: area.trim(),
        city: city.trim(),
      };
      await storesAPI.updateMine(input);
      qc.invalidateQueries({ queryKey: ['seller', 'myStore'] });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message ?? err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.orange} size="large" /></View>;
  }
  if (!store) {
    return (
      <View style={[styles.center, { padding: 32 }]}>
        <Text style={styles.noStore}>You don't have a store yet.</Text>
        <Pressable style={styles.setupBtn} onPress={() => navigation.navigate('BusinessOnboarding')}>
          <Text style={styles.setupBtnText}>Set up my store</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.hTitle}>Edit store details</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ImageUploader
            value={logoUrl}
            onChange={setLogoUrl}
            label="Store logo"
            folder="seller-logos"
            hint="Square works best — at least 512 × 512 px (PNG or JPG)."
          />

          <Text style={styles.groupLabel}>Store photos</Text>
          <MultiImageUploader value={images} onChange={setImages} folder="seller-store-photos" max={6} />
          <Text style={styles.hint}>
            Shown on your store page. Recommended 1600 × 1200 px (4:3, landscape) — bright, in-focus shots.
          </Text>

          <Input label="Store name" placeholder="Rohit's Boutique" value={name} onChangeText={setName} />

          <Text style={[styles.groupLabel, { marginTop: 4 }]}>Category</Text>
          <View style={styles.pillRow}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <Input label="Description" placeholder="What you sell, your specialty…" value={description} onChangeText={setDescription} />
          <Input label="WhatsApp number" placeholder="98765 43210" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Input label="Website (optional)" placeholder="https://…" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
          <Input label="Address" placeholder="Shop no. / building, street" value={address} onChangeText={setAddress} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Input label="Area" placeholder="Koramangala" value={area} onChangeText={setArea} /></View>
            <View style={{ flex: 1 }}><Input label="City" placeholder="Bengaluru" value={city} onChangeText={setCity} /></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, (!valid || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!valid || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.background },
  noStore: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  setupBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  setupBtnText: { color: '#fff', fontSize: 14, fontFamily: Fonts.bold },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy },

  body: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  groupLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text },
  hint: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 15, marginTop: -6 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  pillActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  pillText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  pillTextActive: { color: '#fff', fontFamily: Fonts.bold },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.bold },
});

export default EditStoreDetailsScreen;
