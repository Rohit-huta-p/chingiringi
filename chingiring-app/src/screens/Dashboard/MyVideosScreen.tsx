import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, ChevronLeft, Info } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoList } from '../../components/VideoList';
import { VideoUploadModal } from '../../components/VideoUploadModal';
import { Colors, Fonts } from '../../constants/theme';
import { videosAPI, FeedVideo } from '../../api/videos';
import { confirmAsync, notify } from '../../utils/dialog';

/**
 * "My Videos" — the shopper-facing version of the admin video screen. Lists the
 * user's own clips (any status), with a Post CTA and edit/delete on their own.
 * User posts are moderated, so a clip shows "Under review" until an admin approves.
 * Reuses <VideoList/> + <VideoUploadModal/>.
 */
export const MyVideosScreen = () => {
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedVideo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['myVideos'],
    queryFn: () => videosAPI.getMine(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000, // surface processing / approval without a manual reload
  });
  const videos: FeedVideo[] = data?.data?.videos ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['myVideos'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => videosAPI.adminDelete(id), // owner-or-admin on the backend
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['videoFeed'] }); },
    onError: (e: any) => notify('Delete failed', e?.response?.data?.message || 'Could not delete the video.'),
  });
  const onDelete = async (v: FeedVideo) => {
    const ok = await confirmAsync('Delete video', 'Delete this clip? This can’t be undone.', { confirmLabel: 'Delete', destructive: true });
    if (ok) deleteMutation.mutate(v._id);
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const onEdit = (v: FeedVideo) => { setEditing(v); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const pending = videos.filter((v) => v.moderation?.state === 'pending').length;

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8} style={s.back}><ChevronLeft size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>My Videos</Text>
        <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.85}>
          <Plus size={16} color="#fff" strokeWidth={2.5} />
          <Text style={s.addBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={s.note}>
          <Info size={15} color={Colors.primary} />
          <Text style={s.noteTxt}>New clips are reviewed before they go live{pending ? ` · ${pending} under review` : ''}.</Text>
        </View>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <VideoList videos={videos} onEdit={onEdit} onDelete={onDelete} emptyHint='Tap “Post” to share your first clip.' />
        )}
      </ScrollView>

      <VideoUploadModal visible={showForm} onClose={closeForm} onUploaded={invalidate} editing={editing} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryLight10, borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 14 },
  noteTxt: { flex: 1, fontSize: 12.5, color: Colors.text, lineHeight: 17 },
  loading: { paddingVertical: 56, alignItems: 'center' },
});

export default MyVideosScreen;
