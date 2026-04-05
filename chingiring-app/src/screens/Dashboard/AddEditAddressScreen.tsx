import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { addressAPI } from '../../api/profile';

type Label = 'home' | 'work' | 'other';

const LABEL_OPTIONS: { value: Label; icon: string; title: string }[] = [
  { value: 'home', icon: '\u2302', title: 'Home' },
  { value: 'work', icon: '\u2615', title: 'Work' },
  { value: 'other', icon: '\u2605', title: 'Other' },
];

export const AddEditAddressScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // If an address is passed via route params, we're in edit mode
  const existing = route.params?.address;
  const isEdit = !!existing;

  const [form, setForm] = useState({
    label: (existing?.label as Label) || 'home',
    fullName: existing?.fullName || '',
    phone: existing?.phone || '',
    addressLine1: existing?.addressLine1 || '',
    addressLine2: existing?.addressLine2 || '',
    city: existing?.city || '',
    state: existing?.state || '',
    pincode: existing?.pincode || '',
    isDefault: existing?.isDefault || false,
  });

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (isEdit) return addressAPI.updateAddress(existing._id, data);
      return addressAPI.createAddress(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      navigation.goBack();
    },
    onError: () => {
      Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'save'} address.`);
    },
  });

  const handleSubmit = () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.addressLine1.trim() ||
        !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      Alert.alert('Validation', 'Pincode must be 6 digits.');
      return;
    }
    mutation.mutate(form);
  };

  const maxWidth = isMobile ? '100%' : 560;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { padding: isMobile ? 16 : 24 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>ACCOUNT</Text>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>
            {isEdit ? 'Edit Address' : 'Add New Address'}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { maxWidth }]}>
        {/* Address Type */}
        <Text style={styles.sectionLabel}>Address Type</Text>
        <View style={styles.labelRow}>
          {LABEL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.labelOption, form.label === opt.value && styles.labelOptionActive]}
              onPress={() => set('label', opt.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.labelOptionIcon}>{opt.icon}</Text>
              <Text style={[styles.labelOptionText, form.label === opt.value && styles.labelOptionTextActive]}>
                {opt.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Full Name */}
        <Text style={styles.fieldLabel}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Rohit Hutagonna"
          placeholderTextColor="#94a3b8"
          value={form.fullName}
          onChangeText={(v) => set('fullName', v)}
        />

        {/* Phone */}
        <Text style={styles.fieldLabel}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="10-digit mobile number"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          maxLength={10}
          value={form.phone}
          onChangeText={(v) => set('phone', v)}
        />

        {/* Address Line 1 */}
        <Text style={styles.fieldLabel}>Address Line 1 *</Text>
        <TextInput
          style={styles.input}
          placeholder="Flat / House No., Building, Street"
          placeholderTextColor="#94a3b8"
          value={form.addressLine1}
          onChangeText={(v) => set('addressLine1', v)}
        />

        {/* Address Line 2 */}
        <Text style={styles.fieldLabel}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          placeholder="Area, Colony, Locality (optional)"
          placeholderTextColor="#94a3b8"
          value={form.addressLine2}
          onChangeText={(v) => set('addressLine2', v)}
        />

        {/* City + State row */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Mumbai"
              placeholderTextColor="#94a3b8"
              value={form.city}
              onChangeText={(v) => set('city', v)}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>State *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Maharashtra"
              placeholderTextColor="#94a3b8"
              value={form.state}
              onChangeText={(v) => set('state', v)}
            />
          </View>
        </View>

        {/* Pincode */}
        <Text style={styles.fieldLabel}>Pincode *</Text>
        <TextInput
          style={[styles.input, { width: isMobile ? '100%' : 160 }]}
          placeholder="6-digit pincode"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
          maxLength={6}
          value={form.pincode}
          onChangeText={(v) => set('pincode', v)}
        />

        {/* Default toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => set('isDefault', !form.isDefault)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggle, form.isDefault && styles.toggleActive]}>
            <View style={[styles.toggleDot, form.isDefault && styles.toggleDotActive]} />
          </View>
          <View>
            <Text style={styles.toggleLabel}>Set as default address</Text>
            <Text style={styles.toggleSub}>Used by default for all deliveries</Text>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={mutation.isPending}
            activeOpacity={0.8}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{isEdit ? 'Update Address' : 'Save Address'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 60 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backButton: { padding: 4, marginRight: 12 },
  backArrow: { fontSize: 22, color: Colors.text },
  headerCenter: { flex: 1 },
  headerLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  labelRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  labelOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff',
  },
  labelOptionActive: { borderColor: Colors.primary, backgroundColor: '#eff6ff' },
  labelOptionIcon: { fontSize: 16 },
  labelOptionText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  labelOptionTextActive: { color: Colors.primary },

  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 4, marginTop: 14 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: Colors.text, backgroundColor: '#fff',
  },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: '#e2e8f0', justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotActive: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  toggleSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  submitBtn: {
    flex: 2, backgroundColor: Colors.primary,
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    flex: 1, backgroundColor: '#f1f5f9',
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.text, fontWeight: '500', fontSize: 14 },
});
