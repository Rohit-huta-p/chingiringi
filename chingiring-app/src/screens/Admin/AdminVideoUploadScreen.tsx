import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { VideoList } from '../../components/VideoList';
import { VideoUploadModal } from '../../components/VideoUploadModal';
import { VideoPlayerModal } from '../../components/VideoPlayerModal';
import { RejectReasonModal } from '../../components/RejectReasonModal';
import { ReportDetailModal } from '../../components/ReportDetailModal';
import { Colors, Fonts } from '../../constants/theme';
import { videosAPI, FeedVideo } from '../../api/videos';
import { confirmAsync, notify } from '../../utils/dialog';

type Filter = 'all' | 'mine' | 'pending' | 'reported' | 'live' | 'rejected';
// Mirror VideoList's badge taxonomy: moderation wins, then status.
const modOf = (v: FeedVideo) => v.moderation?.state;
const isPending = (v: FeedVideo) => modOf(v) === 'pending';
const isRejected = (v: FeedVideo) => modOf(v) === 'rejected';
const isLive = (v: FeedVideo) => v.status === 'ready' && !isPending(v) && !isRejected(v);

/**
 * Admin videos — lists every posted clip (any status) with a "Post Video" CTA
 * and per-clip Edit / Delete. Mirrors the product-management screen. The list is
 * <VideoList/>, reused later for a shopper "my videos" view.
 */
export const AdminVideoUploadScreen = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedVideo | null>(null);
  const [playing, setPlaying] = useState<FeedVideo | null>(null);
  const [rejecting, setRejecting] = useState<FeedVideo | null>(null);
  const [reportsFor, setReportsFor] = useState<FeedVideo | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // "Mine" = admin-posted clips. New posts set creatorRole 'admin'; legacy posts
  // predate that field but carry createdByAdmin. User (UGC) posts have neither.
  const isMine = (v: FeedVideo) => v.creatorRole === 'admin' || !!v.createdByAdmin;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'videos'],
    queryFn: () => videosAPI.adminListAll(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000, // surface processing → live without a manual reload
  });
  const videos: FeedVideo[] = data?.data?.videos ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'videos'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => videosAPI.adminDelete(id),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['videoFeed'] }); },
    onError: (e: any) => notify('Delete failed', e?.response?.data?.message || 'Could not delete the video.'),
  });

  const onDelete = async (v: FeedVideo) => {
    const ok = await confirmAsync(
      'Delete video',
      `Delete this ${v.store?.name || ''} clip? This can’t be undone.`,
      { confirmLabel: 'Delete', destructive: true },
    );
    if (ok) deleteMutation.mutate(v._id);
  };

  const moderateMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) =>
      videosAPI.moderate(id, action, reason),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['videoFeed'] }); },
    onError: (e: any) => notify('Action failed', e?.response?.data?.message || 'Could not update the video.'),
  });
  const onApprove = (v: FeedVideo) => moderateMutation.mutate({ id: v._id, action: 'approve' });
  const onReject = (v: FeedVideo) => setRejecting(v); // opens the reason modal
  const submitReject = (reason: string) => {
    if (rejecting) moderateMutation.mutate({ id: rejecting._id, action: 'reject', reason });
    setRejecting(null);
  };

  const dismissMutation = useMutation({
    mutationFn: (videoId: string) => videosAPI.dismissReports(videoId),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => notify('Action failed', e?.response?.data?.message || 'Could not dismiss the reports.'),
  });
  const onDismissReports = async (v: FeedVideo) => {
    const ok = await confirmAsync('Dismiss reports', `Dismiss ${v.reportCount} report${(v.reportCount ?? 0) > 1 ? 's' : ''} on this ${v.store?.name || ''} clip? It stays live.`, { confirmLabel: 'Dismiss' });
    if (ok) dismissMutation.mutate(v._id);
  };

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const onEdit = (v: FeedVideo) => { setEditing(v); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  // Watch a clip before deciding — ready clips play, others explain themselves.
  const onPlay = (v: FeedVideo) => {
    if (v.status === 'ready' && v.hlsUrl) { setPlaying(v); return; }
    notify('Not playable yet', v.status === 'processing' ? 'Still encoding — check back in a moment.' : 'This clip has no playable video.');
  };

  const isReported = (v: FeedVideo) => (v.reportCount ?? 0) > 0;
  const counts: Record<Filter, number> = {
    all: videos.length,
    mine: videos.filter(isMine).length,
    pending: videos.filter(isPending).length,
    reported: videos.filter(isReported).length,
    live: videos.filter(isLive).length,
    rejected: videos.filter(isRejected).length,
  };
  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'pending', label: 'Under review' },
    { key: 'reported', label: 'Reported' },
    { key: 'live', label: 'Live' },
    { key: 'rejected', label: 'Rejected' },
  ];
  const shown = videos.filter((v) =>
    filter === 'mine' ? isMine(v)
      : filter === 'pending' ? isPending(v)
        : filter === 'reported' ? isReported(v)
          : filter === 'rejected' ? isRejected(v)
            : filter === 'live' ? isLive(v)
              : true);
  const emptyHint = filter === 'mine' ? 'You haven’t posted any clips yet.'
    : filter === 'pending' ? 'Nothing awaiting review 🎉'
      : filter === 'reported' ? 'No reported clips 🎉'
        : filter === 'rejected' ? 'No rejected clips.'
          : filter === 'live' ? 'No live clips yet.'
            : 'Tap “Post Video” to add your first clip.';

  return (
    <SafeAreaView style={s.root} edges={['left', 'right']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* <MobileAdminNav active="AdminVideos" /> */}

        <View style={s.body}>
          {/* Title + CTA */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle} numberOfLines={1}>Video Management</Text>
              <Text style={s.pageSub}>Manage shoppable clips</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.85}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Post Video</Text>
            </TouchableOpacity>
          </View>

          {/* Filter tabs — double as the queue counts. "Under review" is the actionable one;
              "Mine" is the admin's own uploads. Scrolls so the pills never cramp. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {TABS.map((t) => {
              const on = filter === t.key;
              const n = counts[t.key];
              const attention = (t.key === 'pending' || t.key === 'reported') && n > 0;
              return (
                <TouchableOpacity key={t.key} style={[s.tab, on && s.tabOn, attention && !on && s.tabAlert]} onPress={() => setFilter(t.key)} activeOpacity={0.85}>
                  <Text style={[s.tabTxt, on && s.tabTxtOn, attention && !on && s.tabTxtAlert]} numberOfLines={1}>{t.label} {n}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {isLoading ? (
            <View style={s.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <VideoList videos={shown} onPress={onPlay} onEdit={onEdit} onDelete={onDelete} onApprove={onApprove} onReject={onReject} onViewReports={setReportsFor} onDismissReports={onDismissReports} emptyHint={emptyHint} />
          )}
        </View>
      </ScrollView>

      <VideoUploadModal visible={showForm} onClose={closeForm} onUploaded={invalidate} editing={editing} />
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
      <RejectReasonModal
        visible={!!rejecting}
        storeName={rejecting?.store?.name}
        onCancel={() => setRejecting(null)}
        onSubmit={submitReject}
      />
      <ReportDetailModal video={reportsFor} onClose={() => setReportsFor(null)} />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontFamily: Fonts.extraBold, color: '#1e293b' },
  pageSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 0 },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16, paddingRight: 4 },
  tab: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  tabOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabAlert: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  tabTxt: { fontSize: 11.5, fontFamily: Fonts.bold, color: '#64748b' },
  tabTxtOn: { color: '#fff' },
  tabTxtAlert: { color: '#b45309' },
  loading: { paddingVertical: 56, alignItems: 'center' },
});

export default AdminVideoUploadScreen;
