import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Pressable,
  ActivityIndicator, Platform, TextInput, Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Lock, X } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { authAPI } from '../api/auth';

/**
 * Change-password modal for a logged-in user. There's no authenticated
 * change-password endpoint, so this reuses the public email-OTP reset flow:
 *   1. POST /auth/forgot-password  → emails a 6-digit OTP
 *   2. POST /auth/reset-password   → { email, otp, newPassword }
 * Works identically on web + native, no navigator wiring.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  email?: string;
}

export const ChangePasswordModal: React.FC<Props> = ({ visible, onClose, email }) => {
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  // Reset internal state whenever the modal closes.
  useEffect(() => {
    if (!visible) {
      setStage('request');
      setOtp(''); setPassword(''); setConfirm(''); setError('');
    }
  }, [visible]);

  const sendMutation = useMutation({
    mutationFn: () => authAPI.forgotPassword({ email: email as string }),
    onSuccess: () => { setError(''); setStage('verify'); },
    onError: (e: any) => setError(e?.message || 'Failed to send code. Try again.'),
  });

  const resetMutation = useMutation({
    mutationFn: () => authAPI.resetPassword({ email, otp, newPassword: password }),
    onSuccess: () => {
      onClose();
      Alert.alert('Password changed', 'Your password has been updated.');
    },
    onError: (e: any) => setError(e?.message || 'Failed to change password. Check the code and try again.'),
  });

  const handleUpdate = () => {
    setError('');
    if (otp.length !== 6) return setError('Enter the 6-digit code from your email.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    resetMutation.mutate();
  };

  const noEmail = !email;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.cardWrap} onPress={() => {}}>
          <View style={s.card}>
            {/* Header */}
            <View style={s.headerRow}>
              <View style={s.iconCircle}>
                <Lock size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={s.title}>Change Password</Text>
              <TouchableOpacity
                style={s.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#64748b" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {noEmail ? (
              <Text style={s.subtitle}>
                Add an email to your profile first — we send a verification code there to
                change your password.
              </Text>
            ) : stage === 'request' ? (
              <>
                <Text style={s.subtitle}>
                  We'll email a 6-digit code to {email} to confirm it's you.
                </Text>
                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={[s.primaryBtn, sendMutation.isPending && { opacity: 0.7 }]}
                  onPress={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  activeOpacity={0.85}
                >
                  {sendMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>Send Code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.subtitle}>Enter the code sent to {email} and your new password.</Text>

                <TextInput
                  style={s.input}
                  placeholder="6-digit code"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
                <TextInput
                  style={s.input}
                  placeholder="New password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TextInput
                  style={s.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                />

                {error ? <Text style={s.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.primaryBtn, resetMutation.isPending && { opacity: 0.7 }]}
                  onPress={handleUpdate}
                  disabled={resetMutation.isPending}
                  activeOpacity={0.85}
                >
                  {resetMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>Update Password</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  style={s.resendBtn}
                >
                  <Text style={s.resendText}>
                    {sendMutation.isPending ? 'Sending…' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrap: { width: '100%', maxWidth: 420 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 50px rgba(15,23,42,0.25)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 20 },
          shadowRadius: 30,
          elevation: 14,
        }),
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  title: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: '#0f172a' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },

  subtitle: {
    fontSize: 13, fontFamily: Fonts.regular, color: '#64748b',
    lineHeight: 19, marginBottom: 16,
  },

  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15, fontFamily: Fonts.medium, color: '#0f172a',
    marginBottom: 12,
  },
  error: { fontSize: 12, fontFamily: Fonts.medium, color: '#ef4444', marginBottom: 12 },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },

  resendBtn: { alignItems: 'center', paddingVertical: 12 },
  resendText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
});

export default ChangePasswordModal;
