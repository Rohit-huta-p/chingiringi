import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, UserX } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts } from '../../constants/theme';
import { videosAPI } from '../../api/videos';
import { notify } from '../../utils/dialog';

/** Creators the user has blocked from the video feed, with one-tap Unblock. */
export const BlockedAccountsScreen = () => {
  const nav = useNavigation<any>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['videoBlocks'], queryFn: () => videosAPI.listBlocks() });
  const blocks = data?.data?.blocks ?? [];

  const unblockMutation = useMutation({
    mutationFn: (creatorId: string) => videosAPI.unblock(creatorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videoBlocks'] });
      qc.invalidateQueries({ queryKey: ['videoFeed'] }); // their clips reappear
    },
    onError: (e: any) => notify('Couldn’t unblock', e?.response?.data?.message || 'Something went wrong — try again.'),
  });

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8} style={s.back}><ChevronLeft size={24} color={Colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>Blocked accounts</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={s.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : blocks.length === 0 ? (
          <View style={s.empty}>
            <UserX size={40} color="#cbd5e1" strokeWidth={1.5} />
            <Text style={s.emptyTitle}>No blocked accounts</Text>
            <Text style={s.emptySub}>Creators you block from the video feed will show up here.</Text>
          </View>
        ) : (
          blocks.map((b) => {
            const u = b.blockedUser;
            const name = u?.name || u?.username || 'User';
            const initial = name.trim()[0]?.toUpperCase() ?? '?';
            return (
              <View key={b._id} style={s.row}>
                {u?.avatarUrl
                  ? <Image source={{ uri: u.avatarUrl }} style={s.avatar} />
                  : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarTxt}>{initial}</Text></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{name}</Text>
                  <Text style={s.sub}>Blocked {new Date(b.createdAt).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity
                  style={s.unblockBtn}
                  onPress={() => u?._id && unblockMutation.mutate(u._id)}
                  disabled={unblockMutation.isPending}
                >
                  <Text style={s.unblockTxt}>Unblock</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text },
  loading: { paddingVertical: 56, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 6 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#94a3b8', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', maxWidth: 280 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#f1f5f9',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  avatarTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 15 },
  name: { fontSize: 14.5, fontFamily: Fonts.bold, color: Colors.text },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.primaryLight10, borderWidth: 1, borderColor: Colors.primary },
  unblockTxt: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary },
});

export default BlockedAccountsScreen;
