import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Info } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoList } from './VideoList';
import { VideoUploadModal } from './VideoUploadModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { Colors, Fonts } from '../constants/theme';
import { videosAPI, FeedVideo } from '../api/videos';
import { confirmAsync, notify } from '../utils/dialog';

export interface MyVideosPanelHandle {
  /** Open the "post a video" form (called by a host header button or FAB). */
  openCreate: () => void;
}

interface Props {
  /** Accent for the spinner + review-note (buyer = primary blue, seller = orange). */
  accent?: string;
  /** Background tint for the review-note (should pair with `accent`). */
  accentBg?: string;
  /** Extra bottom padding so an absolute tab bar / FAB doesn't cover the last row. */
  contentPaddingBottom?: number;
  emptyHint?: string;
}

/**
 * The signed-in user's own posted clips (`getMine`) — a review note, the
 * <VideoList/> grid, and the post/edit/player modals. Extracted from
 * MyVideosScreen so the seller "My Store → Videos" tab reuses the exact same
 * list and flows. The post form is opened imperatively through the ref, so a
 * host (the MyVideos header button, or the My Store FAB) supplies its own
 * "Post" affordance.
 */
export const MyVideosPanel = forwardRef<MyVideosPanelHandle, Props>(function MyVideosPanel(
  { accent = Colors.primary, accentBg = Colors.primaryLight10, contentPaddingBottom = 32, emptyHint },
  ref,
) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedVideo | null>(null);
  const [playing, setPlaying] = useState<FeedVideo | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
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

  // Tap a card → play it if it's live; otherwise explain why it can't play yet.
  const onPlay = (v: FeedVideo) => {
    if (v.status === 'ready' && v.hlsUrl) { setPlaying(v); return; }
    const msg = v.moderation?.state === 'rejected' ? 'This clip was rejected, so it won’t play.'
      : v.moderation?.state === 'pending' ? 'This clip is under review — it’ll play once approved.'
      : v.status === 'processing' ? 'Still encoding — check back in a moment.'
      : 'This clip isn’t ready to play yet.';
    notify('Not ready', msg);
  };

  useImperativeHandle(ref, () => ({ openCreate }), []);

  const pending = videos.filter((v) => v.moderation?.state === 'pending').length;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[accent]} tintColor={accent} />}
      >
        <View style={[s.note, { backgroundColor: accentBg }]}>
          <Info size={15} color={accent} />
          <Text style={s.noteTxt}>New videos are reviewed before they go live{pending ? ` · ${pending} under review` : ''}.</Text>
        </View>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator size="large" color={accent} /></View>
        ) : (
          <VideoList videos={videos} onPress={onPlay} onEdit={onEdit} onDelete={onDelete} emptyHint={emptyHint ?? 'Tap “Post” to share your first clip.'} />
        )}
      </ScrollView>

      <VideoUploadModal visible={showForm} onClose={closeForm} onUploaded={invalidate} editing={editing} />
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </>
  );
});

const s = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 14 },
  noteTxt: { flex: 1, fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 17 },
  loading: { paddingVertical: 56, alignItems: 'center' },
});

export default MyVideosPanel;
