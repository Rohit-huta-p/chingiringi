import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

export const EditProfileScreen = () => {
  const navigation = useNavigation();

  const [fullName, setFullName] = useState('Dev Chavan');
  const [username] = useState('Dev Chavan');
  const [email, setEmail] = useState('dev.chavan@email.com');
  const [phone, setPhone] = useState('9876543210');

  const handleSave = () => {
    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>
      </View>

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar} />
          <View style={styles.cameraIcon}>
            <Text style={styles.cameraIconText}>📷</Text>
          </View>
        </View>
        <Text style={styles.uploadHint}>Click to upload new photo</Text>
      </View>

      {/* Form */}
      <Card style={styles.formCard}>
        <Input
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
        />

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Username <Text style={styles.fieldHint}>(Can't be changed)</Text></Text>
          <View style={[styles.disabledInput]}>
            <Text style={styles.disabledInputText}>{username}</Text>
          </View>
        </View>

        <Input
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.helperText}>Used for important account notifications</Text>

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
        />
        <Text style={styles.helperText}>Used for OTP verification and cashback updates</Text>
      </Card>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={handleCancel}
          style={styles.cancelButton}
        />
        <Button
          title="Save Changes"
          variant="primary"
          onPress={handleSave}
          style={styles.saveButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backArrow: {
    fontSize: 20,
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#cbd5e1',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: {
    fontSize: 16,
  },
  uploadHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 12,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  disabledInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabledInputText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
