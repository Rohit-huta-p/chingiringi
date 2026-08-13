import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';

// Generic, one-tap reasons. The admin can pick one or edit the text.
const PRESETS = [
  'Doesn’t meet our content guidelines.',
  'Video quality is too low.',
  'Contains inappropriate content.',
  'Not relevant to the store or products.',
  'Looks like spam or is misleading.',
];

interface Props {
  visible: boolean;
  storeName?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

/**
 * Admin reject flow — capture a short "why" (defaults to a generic message so it's
 * one tap, editable to be specific). The reason is stored on the clip and shown to
 * the uploader.
 */
export const RejectReasonModal: React.FC<Props> = ({ visible, storeName, onCancel, onSubmit }) => {
  const [reason, setReason] = useState(PRESETS[0]);
  // Reset to the generic default each time it opens.
  useEffect(() => { if (visible) setReason(PRESETS[0]); }, [visible]);

  const trimmed = reason.trim();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.head}>
            <Text style={s.title} numberOfLines={1}>Reject{storeName ? ` · ${storeName}` : ''}</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={8}><X size={20} color={Colors.text} /></TouchableOpacity>
          </View>
          <Text style={s.sub}>Add a reason — the uploader will see why their clip wasn’t approved.</Text>

          <Text style={s.label}>Quick reasons</Text>
          <View style={s.chips}>
            {PRESETS.map((p) => {
              const on = trimmed === p;
              return (
                <TouchableOpacity key={p} style={[s.chip, on && s.chipOn]} onPress={() => setReason(p)} activeOpacity={0.85}>
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={s.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Write a short reason…"
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={200}
          />

          <View style={s.actions}>
            <TouchableOpacity style={s.cancel} onPress={onCancel} activeOpacity={0.85}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.reject, !trimmed && s.rejectOff]} disabled={!trimmed} onPress={() => onSubmit(trimmed)} activeOpacity={0.85}>
              <Text style={s.rejectTxt}>Reject clip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.background, borderRadius: 18, padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text },
  sub: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.text, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipOn: { backgroundColor: Colors.primaryLight10, borderColor: Colors.primary },
  chipTxt: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  chipTxtOn: { color: Colors.primary },
  input: {
    marginTop: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, minHeight: 68,
    textAlignVertical: 'top', fontFamily: Fonts.regular,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.text },
  reject: { flex: 1.4, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.danger },
  rejectOff: { opacity: 0.5 },
  rejectTxt: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
});

export default RejectReasonModal;
