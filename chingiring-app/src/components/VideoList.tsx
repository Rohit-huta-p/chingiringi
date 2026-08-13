import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Trash2, Pencil, Check, X, Play, Eye, Heart, Inbox } from 'lucide-react-native';
import { Fonts } from '../constants/theme';
import { FeedVideo } from '../api/videos';

type Pill = { label: string; bg: string; fg: string };

// Encoding status pills (blue "Processing" reads distinct from amber "Under review").
const STATUS: Record<string, Pill> = {
  processing: { label: 'Processing', bg: '#dbeafe', fg: '#1d4ed8' },
  ready:      { label: 'Live',       bg: '#dcfce7', fg: '#16a34a' },
  error:      { label: 'Error',      bg: '#fee2e2', fg: '#dc2626' },
  flagged:    { label: 'Flagged',    bg: '#ffedd5', fg: '#c2410c' },
  removed:    { label: 'Removed',    bg: '#f1f5f9', fg: '#94a3b8' },
};
const REVIEW: Pill = { label: 'Under review', bg: '#fef3c7', fg: '#b45309' };
const REJECTED: Pill = { label: 'Rejected', bg: '#fee2e2', fg: '#dc2626' };

// Encoding and moderation are independent, so show up to two pills. A user clip
// mid-encode + awaiting review shows BOTH "Processing" and "Under review".
const badgesFor = (v: FeedVideo): Pill[] => {
  const mod = v.moderation?.state;
  const out: Pill[] = [];
  if (v.status === 'processing' || v.status === 'error' || v.status === 'flagged') out.push(STATUS[v.status]);
  if (mod === 'pending') out.push(REVIEW);
  else if (mod === 'rejected') out.push(REJECTED);
  else if (v.status === 'ready') out.push(STATUS.ready); // Live (approved / legacy)
  return out.length ? out : [STATUS[v.status] ?? STATUS.processing];
};

export interface VideoListProps {
  videos: FeedVideo[];
  /** Admin passes this to show an Edit action; omit for a read-only list. */
  onEdit?: (v: FeedVideo) => void;
  /** Admin passes this to show a Delete action; omit for a read-only list. */
  onDelete?: (v: FeedVideo) => void;
  /** Admin moderation — Approve / Reject shown on `pending` clips. */
  onApprove?: (v: FeedVideo) => void;
  onReject?: (v: FeedVideo) => void;
  /** Optional tap handler on the thumbnail (e.g. preview / open). */
  onPress?: (v: FeedVideo) => void;
  emptyHint?: string;
}

/**
 * Reusable grid of posted videos. The admin screen passes `onDelete`; the
 * shopper-facing "my videos" screen can reuse this later with its own actions
 * (or none). Purely presentational — data + mutations live in the parent.
 */
export const VideoList: React.FC<VideoListProps> = ({ videos, onEdit, onDelete, onApprove, onReject, onPress, emptyHint }) => {
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
        const modState = v.moderation?.state;
        const badges = badgesFor(v);
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
                <View style={s.badgeRow}>
                  {badges.map((b, i) => (
                    <View key={i} style={[s.badge, { backgroundColor: b.bg }]}>
                      <Text style={[s.badgeTxt, { color: b.fg }]}>{b.label}</Text>
                    </View>
                  ))}
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

              {modState === 'rejected' && !!v.moderation?.reason && (
                <View style={s.reasonBox}>
                  <Text style={s.reasonTxt} numberOfLines={4}>{v.moderation.reason}</Text>
                </View>
              )}

              {modState === 'pending' && (onApprove || onReject) && (
                <View style={s.actions}>
                  {onApprove && (
                    <TouchableOpacity style={s.approveBtn} onPress={() => onApprove(v)}>
                      <Check size={13} color="#16a34a" strokeWidth={2.4} />
                      <Text style={s.approveTxt}>Approve</Text>
                    </TouchableOpacity>
                  )}
                  {onReject && (
                    <TouchableOpacity style={s.rejectBtn} onPress={() => onReject(v)}>
                      <X size={13} color="#dc2626" strokeWidth={2.4} />
                      <Text style={s.rejectTxt}>Reject</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {(onEdit || onDelete) && (
                <View style={s.actions}>
                  {onEdit && (
                    <TouchableOpacity style={s.editBtn} onPress={() => onEdit(v)}>
                      <Pencil size={13} color="#3b82f6" strokeWidth={2.2} />
                      <Text style={s.editTxt}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {onDelete && (
                    <TouchableOpacity style={s.delBtn} onPress={() => onDelete(v)}>
                      <Trash2 size={13} color="#ef4444" strokeWidth={2.2} />
                      <Text style={s.delTxt}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
  badgeRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontFamily: Fonts.bold },

  info: { padding: 10 },
  store: { fontSize: 13, fontFamily: Fonts.bold, color: '#1e293b' },
  caption: { fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 16, minHeight: 32 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: { fontSize: 11, color: '#94a3b8', fontFamily: Fonts.semiBold },
  prodTag: { fontSize: 10.5, color: '#3b82f6', fontFamily: Fonts.bold, marginLeft: 'auto' },
  reasonBox: { marginTop: 8, backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#fee2e2' },
  reasonTxt: { fontSize: 11.5, color: '#b91c1c', lineHeight: 16, fontFamily: Fonts.medium },

  actions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 7, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe',
  },
  editTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#3b82f6' },
  delBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 7, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2',
  },
  delTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#ef4444' },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 7, borderRadius: 8, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0',
  },
  approveTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#16a34a' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 7, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2',
  },
  rejectTxt: { fontSize: 12, fontFamily: Fonts.bold, color: '#dc2626' },

  empty: { alignItems: 'center', paddingVertical: 56 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.bold, color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 260 },
});

export default VideoList;
