import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MobileAdminNav } from '../../components/MobileAdminNav';
import { VideoList } from '../../components/VideoList';
import { VideoUploadModal } from '../../components/VideoUploadModal';
import { Colors, Fonts } from '../../constants/theme';
import { videosAPI, FeedVideo } from '../../api/videos';

/**
 * Admin videos — lists every posted clip (any status) with a "Post Video" CTA
 * that opens the upload form in a modal. Mirrors the product-management screen.
 * The list itself is <VideoList/>, reused later for a shopper "my videos" view.
 */
export const AdminVideoUploadScreen = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

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
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message || 'Failed to delete video'),
  });

  const onDelete = (v: FeedVideo) => {
    Alert.alert('Delete video', `Delete this ${v.store?.name || ''} clip? This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(v._id) },
    ]);
  };

  const live = videos.filter((v) => v.status === 'ready').length;
  const processing = videos.filter((v) => v.status === 'processing').length;

  return (
    <SafeAreaView style={s.root} edges={['left', 'right']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <MobileAdminNav active="AdminVideos" />

        <View style={s.body}>
          {/* Title + CTA */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle} numberOfLines={1}>Video Management</Text>
              <Text style={s.pageSub}>Manage shoppable clips</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.addBtnText}>Post Video</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={s.miniStat}><Text style={s.miniLabel}>Total</Text><Text style={s.miniVal}>{videos.length}</Text></View>
            <View style={s.miniStat}><Text style={s.miniLabel}>Live</Text><Text style={[s.miniVal, { color: '#22c55e' }]}>{live}</Text></View>
            <View style={s.miniStat}><Text style={s.miniLabel}>Processing</Text><Text style={[s.miniVal, { color: '#f59e0b' }]}>{processing}</Text></View>
          </View>

          {isLoading ? (
            <View style={s.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>
          ) : (
            <VideoList videos={videos} onDelete={onDelete} emptyHint='Tap “Post Video” to add your first clip.' />
          )}
        </View>
      </ScrollView>

      <VideoUploadModal visible={showForm} onClose={() => setShowForm(false)} onUploaded={invalidate} />
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
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  miniStat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  miniLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  miniVal: { fontSize: 20, fontFamily: Fonts.extraBold, color: '#1e293b' },
  loading: { paddingVertical: 56, alignItems: 'center' },
});

export default AdminVideoUploadScreen;
