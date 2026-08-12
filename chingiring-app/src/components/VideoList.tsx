import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Trash2, Play, Eye, Heart, Inbox } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import { FeedVideo } from '../api/videos';

// status → badge colours (matches the admin product-status pill vocabulary).
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  processing: { label: 'Processing', bg: '#fef3c7', fg: '#b45309' },
  ready:      { label: 'Live',       bg: '#dcfce7', fg: '#16a34a' },
  error:      { label: 'Error',      bg: '#fee2e2', fg: '#dc2626' },
  flagged:    { label: 'Flagged',    bg: '#ffedd5', fg: '#c2410c' },
  removed:    { label: 'Removed',    bg: '#f1f5f9', fg: '#94a3b8' },
};

export interface VideoListProps {
  videos: FeedVideo[];
  /** Admin passes this to show a Delete action; omit for a read-only list. */
  onDelete?: (v: FeedVideo) => void;
  /** Optional tap handler on the thumbnail (e.g. preview / open). */
  onPress?: (v: FeedVideo) => void;
  emptyHint?: string;
}

/**
 * Reusable grid of posted videos. The admin screen passes `onDelete`; the
 * shopper-facing "my videos" screen can reuse this later with its own actions
 * (or none). Purely presentational — data + mutations live in the parent.
 */
export const VideoList: React.FC<VideoListProps> = ({ videos, onDelete, onPress, emptyHint }) => {
  const { width } = useWindowDimensions();
  const PAD = 16, GAP = 10;
  const colW = Math.min((width - PAD * 2 - GAP) / 2, 240);

  if (!videos.length) {
    return (
      <View style={s.empty}>
        <Inbox size={40} color="#cbd5e1" strokeWidth={1.5} />
        <Text style={s.emptyTitle}>No videos yet</Text>
        <Text style={s.emptySub}>{emptyHint ?? 'Tap “Post Video” to add your first clip.'}</Text>
      </View>
    );
  }

  return (
    <View style={s.grid}>
      {videos.map((v) => {
        const st = STATUS[v.status] ?? STATUS.processing;
        const nProducts = v.taggedProducts?.length ?? 0;
        return (
          <View key={v._id} style={[s.card, { width: colW }]}>
            <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress ? () => onPress(v) : undefined}>
              <View style={s.thumbWrap}>
                {v.thumbnailUrl ? (
                  <Image source={{ uri: v.thumbnailUrl }} style={s.thumb} resizeMode="cover" />
                ) : (
                  <View style={[s.thumb, s.thumbPlaceholder]}><Play size={26} color="#64748b" /></View>
                )}
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeTxt, { color: st.fg }]}>{st.label}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={s.info}>
              <Text style={s.store} numberOfLines={1}>{v.store?.name || '—'}</Text>
              <Text style={s.caption} numberOfLines={2}>{v.caption || 'No caption'}</Text>

              <View style={s.metaRow}>
                <View style={s.metaItem}><Eye size={12} color="#94a3b8" /><Text style={s.metaTxt}>{v.stats?.views ?? 0}</Text></View>
                <View style={s.metaItem}><Heart size={12} color="#94a3b8" /><Text style={s.metaTxt}>{v.stats?.likes ?? 0}</Text></View>
                {nProducts > 0 && <Text style={s.prodTag}>{nProducts} product{nProducts > 1 ? 's' : ''}</Text>}
              </View>

              {onDelete && (
                <TouchableOpacity style={s.delBtn} onPress={() => onDelete(v)}>
                  <Trash2 size={13} color="#ef4444" strokeWidth={2.2} />
                  <Text style={s.delTxt}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  thumbWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#1e293b', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontFamily: Fonts.bold },

  info: { padding: 10 },
  store: { fontSize: 13, fontFamily: Fonts.bold, color: '#1e293b' },
  caption: { fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 16, minHeight: 32 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: { fontSize: 11, color: '#94a3b8', fontFamily: Fonts.semiBold },
  prodTag: { fontSize: 10.5, color: '#3b82f6', fontFamily: Fonts.bold, marginLeft: 'auto' },

  delBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10,
    paddingVertical: 7, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2',
  },
  delTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#ef4444' },

  empty: { alignItems: 'center', paddingVertical: 56 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 260 },
});

export default VideoList;
