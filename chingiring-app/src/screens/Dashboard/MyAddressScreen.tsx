import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { addressAPI } from '../../api/profile';

interface Address {
  id: string;
  type: 'home' | 'work';
  label: string;
  isDefault: boolean;
  name: string;
  phone: string;
  line1: string;
  line2: string;
}

const FALLBACK_ADDRESSES: Address[] = [
  {
    id: '1',
    type: 'home',
    label: 'Home',
    isDefault: true,
    name: 'Dev Chavan',
    phone: '9876543210',
    line1: '301, Sunrise Apartments, MG Road',
    line2: 'Mumbai, Maharashtra - 400001',
  },
  {
    id: '2',
    type: 'work',
    label: 'Work',
    isDefault: false,
    name: 'Dev Chavan',
    phone: '9876543210',
    line1: 'Tech Park, Block B, 5th Floor',
    line2: 'Mumbai, Maharashtra - 400051',
  },
];

const AddressCard = ({
  address,
  onDelete,
  onSetDefault,
  onEdit,
}: {
  address: Address;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onEdit: (address: Address) => void;
}) => (
  <Card style={styles.addressCard} variant="outlined">
    <View style={styles.addressRow}>
      <View style={styles.addressLeft}>
        <View style={[styles.iconCircle, address.type === 'home' ? styles.iconBlue : styles.iconPurple]}>
          <Text style={styles.iconText}>{address.type === 'home' ? '\u2302' : '\u2615'}</Text>
        </View>
        <View style={styles.addressLabelRow}>
          <Text style={styles.addressLabel}>{address.label}</Text>
          {address.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.addressActions}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={() => onEdit(address)}>
          <Text style={styles.editIcon}>{'\u270E'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={() => onDelete(address.id)}
        >
          <Text style={styles.deleteIcon}>{'\u2716'}</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.addressDetails}>
      <Text style={styles.addressName}>{address.name}</Text>
      <Text style={styles.addressPhone}>{address.phone}</Text>
      <Text style={styles.addressLine}>{address.line1}</Text>
      <Text style={styles.addressLine}>{address.line2}</Text>
    </View>

    {!address.isDefault && (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.setDefaultButton}
        onPress={() => onSetDefault(address.id)}
      >
        <Text style={styles.setDefaultText}>Set as default</Text>
      </TouchableOpacity>
    )}
  </Card>
);

export const MyAddressScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data: addressData } = useQuery({
    queryKey: ['addresses'],
    queryFn: addressAPI.getAddresses,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => addressAPI.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to delete address.');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => addressAPI.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
    onError: () => {
      Alert.alert('Error', 'Failed to set default address.');
    },
  });

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  const handleEdit = (address: Address) => {
    // Reconstruct the raw API shape the AddEditAddressScreen expects
    const raw = addressData?.data?.addresses?.find((a: any) => a._id === address.id);
    navigation.navigate('AddEditAddress' as never, { address: raw || address } as never);
  };

  const handleAdd = () => {
    navigation.navigate('AddEditAddress' as never);
  };

  // Map API data to the local Address shape, fall back to hardcoded data
  const addresses: Address[] = addressData?.data?.addresses
    ? addressData.data.addresses.map((a: any) => ({
        id: a._id,
        type: a.label === 'work' ? 'work' : 'home',
        label: a.label ? a.label.charAt(0).toUpperCase() + a.label.slice(1) : 'Home',
        isDefault: a.isDefault,
        name: a.fullName,
        phone: a.phone,
        line1: a.addressLine1,
        line2: `${a.city}, ${a.state} - ${a.pincode}`,
      }))
    : FALLBACK_ADDRESSES;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { padding: isMobile ? 16 : 24 }]}>
      <View style={[styles.header, isMobile && { flexWrap: 'wrap', gap: 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>ACCOUNT</Text>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>My Addresses</Text>
        </View>
        <TouchableOpacity style={styles.addButton} activeOpacity={0.7} onPress={handleAdd}>
          <Text style={styles.addButtonText}>+ Add Address</Text>
        </TouchableOpacity>
      </View>

      {addresses.map((address) => (
        <AddressCard
          key={address.id}
          address={address}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          onEdit={handleEdit}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  backArrow: {
    fontSize: 22,
    color: Colors.text,
  },
  headerCenter: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  addressCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconBlue: {
    backgroundColor: '#dbeafe',
  },
  iconPurple: {
    backgroundColor: '#ede9fe',
  },
  iconText: {
    fontSize: 18,
    color: Colors.text,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
  },
  editIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  deleteIcon: {
    fontSize: 14,
    color: Colors.danger,
  },
  addressDetails: {
    marginLeft: 50,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  addressPhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  addressLine: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  setDefaultButton: {
    marginTop: 10,
    marginLeft: 50,
  },
  setDefaultText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
