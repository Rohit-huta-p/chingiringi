import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Flag, UserX, ChevronLeft, Check } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { ReportReason, videosAPI } from '../api/videos';
import { reportStream } from '../api/streams';
import { REASONS } from './VideoMoreSheet';
import { confirmAsync, notify } from '../utils/dialog';

interface Props {
  visible: boolean;
  /** The live stream being viewed. */
  streamId: string;
  /**
   * The broadcaster's user id. When present, "Block this seller" is offered —
   * the parent passes it only when it's known and not the viewer's own id.
   */
  broadcasterId?: string;
  /** Store/seller label for the Block row + confirm copy. */
  storeLabel: string;
  onClose: () => void;
  /** After a successful block — parent refreshes the live list + leaves the stream. */
  onBlocked?: () => void;
}

/**
 * The live viewer's "⋯" sheet: Report stream (reason list + optional note) and
 * Block {seller}. Mirrors VideoMoreSheet but targets a live stream — Report
 * hits POST /streams/:id/reports; Block reuses the same user→user block as the
 * clip feed (so the seller's future lives drop out of the live list too).
 *
 * Auth is gated by the caller (the ⋯ button runs requireAuth before opening),
 * so by the time this renders the viewer is signed in.
 */
export const LiveMoreSheet: React.FC<Props> = ({ visible, streamId, broadcasterId, storeLabel, onClose, onBlocked }) => {
  const [step, setStep] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) { setStep('menu'); setReason(null); setNote(''); setBusy(false); }
  }, [visible]);

  const label = storeLabel?.trim() || 'this seller';

  const submitReport = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await reportStream(streamId, reason, note.trim() || undefined);
      onClose();
      notify('Thanks for the report', 'We’ll review this live stream.');
    } catch (e: any) {
      notify('Couldn’t report', e?.response?.data?.message || 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const blockBroadcaster = async () => {
    if (!broadcasterId || busy) return;
    const ok = await confirmAsync(
      `Block ${label}?`,
      'You won’t see their live streams or videos anymore. You can unblock from Profile → Blocked accounts.',
      { confirmLabel: 'Block', destructive: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await videosAPI.block(broadcasterId);
      onClose();
      notify('Blocked', `You won’t see live streams or videos from ${label} anymore.`);
      onBlocked?.();
    } catch (e: any) {
      notify('Couldn’t block', e?.response?.data?.message || 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grabber} />

        {step === 'menu' ? (
          <View style={s.menu}>
            <Pressable style={s.row} onPress={() => setStep('report')}>
              <Flag size={20} color={Colors.danger} />
              <Text style={s.rowTxt}>Report this live</Text>
            </Pressable>
            {!!broadcasterId && (
              <Pressable style={s.row} onPress={blockBroadcaster} disabled={busy}>
                <UserX size={20} color={Colors.danger} />
                <Text style={s.rowTxt}>Block {label}</Text>
              </Pressable>
            )}
            <Pressable style={[s.row, s.cancelRow]} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.menu}>
            <View style={s.reportHead}>
              <Pressable onPress={() => setStep('menu')} hitSlop={8}><ChevronLeft size={22} color={Colors.text} /></Pressable>
              <Text style={s.reportTitle}>Why are you reporting this?</Text>
            </View>
            {REASONS.map((r) => {
              const on = reason === r.key;
              return (
                <Pressable key={r.key} style={s.reasonRow} onPress={() => setReason(r.key)}>
                  <Text style={[s.reasonTxt, on && s.reasonTxtOn]}>{r.label}</Text>
                  {on && <Check size={18} color={Colors.primary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
            <TextInput
              style={s.note}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={Colors.textSecondary}
              maxLength={300}
              multiline
            />
            <Pressable style={[s.submit, (!reason || busy) && s.submitOff]} onPress={submitReport} disabled={!reason || busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>Submit report</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', marginTop: 8, marginBottom: 4 },
  menu: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowTxt: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  cancelRow: { justifyContent: 'center', borderBottomWidth: 0, marginTop: 2 },
  cancelTxt: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textSecondary },

  reportHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  reportTitle: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text },
  reasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  reasonTxt: { fontSize: 14.5, fontFamily: Fonts.medium, color: Colors.text },
  reasonTxtOn: { color: Colors.primary, fontFamily: Fonts.bold },
  note: {
    marginTop: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.text, minHeight: 56,
    textAlignVertical: 'top', fontFamily: Fonts.regular,
  },
  submit: { marginTop: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.danger },
  submitOff: { opacity: 0.5 },
  submitTxt: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },
});

export default LiveMoreSheet;
