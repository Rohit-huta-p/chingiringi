import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MailOpen } from 'lucide-react-native';
import { profileAPI } from '../api/profile';
import { Colors, Fonts } from '../constants/theme';
import { openMailInbox } from '../lib/openMail';

interface Props {
  visible: boolean;
  email?: string;
  onClose: () => void;
  onVerified: () => void;
  /** Label for the dismiss link. Signup passes "I'll verify later". */
  cancelLabel?: string;
}

/**
 * Self-contained email verification: on open it emails a 6-digit code, the user
 * enters it, and `onVerified` fires on success. Reused by the profile screen and
 * the withdrawal gate.
 */
export const EmailVerifyModal: React.FC<Props> = ({ visible, email, onClose, onVerified, cancelLabel = 'Cancel' }) => {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const openedRef = useRef(false);

  const send = async () => {
    setError('');
    setInfo('');
    setSending(true);
    try {
      await profileAPI.sendEmailOtp();
      setInfo(`We sent a 6-digit code to ${email || 'your email'}.`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not send the code. Try again.');
    } finally {
      setSending(false);
    }
  };

  // Email a code once each time the modal opens.
  useEffect(() => {
    if (visible && !openedRef.current) {
      openedRef.current = true;
      setCode('');
      send();
    }
    if (!visible) openedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const verify = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      await profileAPI.verifyEmailOtp(code);
      onVerified();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.card}>
          <Text style={st.title}>Verify your email</Text>
          <Text style={st.sub}>
            {info || (sending ? 'Sending a code…' : `Enter the 6-digit code sent to ${email || 'your email'}.`)}
          </Text>

          <TextInput
            style={st.input}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="••••••"
            placeholderTextColor="#94a3b8"
            maxLength={6}
            autoFocus
          />

          {error ? <Text style={st.err}>{error}</Text> : null}

          <TouchableOpacity
            style={[st.btn, (verifying || code.length !== 6) && { opacity: 0.6 }]}
            onPress={verify}
            disabled={verifying || code.length !== 6}
            activeOpacity={0.85}
          >
            {verifying ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Verify</Text>}
          </TouchableOpacity>

          <View style={st.row}>
            <TouchableOpacity style={st.openMail} onPress={() => openMailInbox(email)} activeOpacity={0.85}>
              <MailOpen size={15} color={Colors.primary} strokeWidth={2} />
              <Text style={st.openMailTxt}>Open mail</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={send} disabled={sending}>
              <Text style={st.link}>{sending ? 'Sending…' : 'Resend code'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} style={st.laterWrap} hitSlop={8}>
            <Text style={st.later}>{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 22 },
  title: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text },
  sub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 6, lineHeight: 19 },
  input: {
    marginTop: 16,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  err: { color: '#ef4444', fontSize: 12.5, fontFamily: Fonts.medium, marginTop: 8 },
  btn: { marginTop: 16, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.bold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  openMail: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  openMailTxt: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  link: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  laterWrap: { alignItems: 'center', marginTop: 14 },
  later: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
});

export default EmailVerifyModal;
