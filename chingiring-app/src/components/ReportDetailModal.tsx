import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { X, Flag } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts } from '../constants/theme';
import { videosAPI, FeedVideo } from '../api/videos';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam or scam',
  inappropriate: 'Nudity or inappropriate',
  violence: 'Violence or harmful',
  hate: 'Hate or harassment',
  misleading: 'False or misleading',
  copyright: 'Copyright violation',
  other: 'Something else',
};

interface Props {
  video: FeedVideo | null; // null = closed
  onClose: () => void;
}

/** Admin audit view — who reported this clip, why, and when. */
export const ReportDetailModal: React.FC<Props> = ({ video, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['videoReports', video?._id],
    queryFn: () => videosAPI.adminReportDetail(video!._id),
    enabled: !!video,
  });
  const reports = data?.data?.reports ?? [];

  return (
    <Modal visible={!!video} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.head}>
            <View style={s.headLeft}>
              <Flag size={16} color="#dc2626" />
              <Text style={s.title} numberOfLines={1}>Reports{video?.store?.name ? ` · ${video.store.name}` : ''}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><X size={20} color={Colors.text} /></Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 28 }} />
          ) : (
            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
              {reports.length === 0 && <Text style={s.empty}>No reports on record.</Text>}
              {reports.map((r) => (
                <View key={r._id} style={s.row}>
                  <View style={s.rowTop}>
                    <Text style={s.reporter} numberOfLines={1}>
                      {r.reporter?.name || r.reporter?.username || 'User'}
                    </Text>
                    <Text style={[s.status, r.status === 'open' ? s.statusOpen : s.statusDone]}>{r.status}</Text>
                  </View>
                  <Text style={s.reason}>{REASON_LABELS[r.reason] ?? r.reason}</Text>
                  {!!r.note && <Text style={s.note}>“{r.note}”</Text>}
                  <Text style={s.time}>{new Date(r.createdAt).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: Colors.background, borderRadius: 18, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  title: { flex: 1, fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text },
  list: { marginTop: 4 },
  empty: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 20, textAlign: 'center' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reporter: { flex: 1, fontSize: 13.5, fontFamily: Fonts.bold, color: Colors.text },
  status: { fontSize: 10.5, fontFamily: Fonts.bold, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, overflow: 'hidden' },
  statusOpen: { backgroundColor: '#fef3c7', color: '#b45309' },
  statusDone: { backgroundColor: '#f1f5f9', color: '#64748b' },
  reason: { fontSize: 13, color: '#b91c1c', fontFamily: Fonts.semiBold, marginTop: 3 },
  note: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 3, lineHeight: 17, fontStyle: 'italic' },
  time: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
});

export default ReportDetailModal;
