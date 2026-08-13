import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TextInput, Pressable, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { X, Trash2, Send, MessageCircle } from 'lucide-react-native';
import { Colors, Fonts } from '../constants/theme';
import { FeedVideo, VideoComment } from '../api/videos';
import { useComments } from '../hooks/useComments';
import { useAuthStore } from '../store';
import { confirmAsync } from '../utils/dialog';

interface Props {
  visible: boolean;
  video: FeedVideo | null;
  onClose: () => void;
  /** Desktop web: render as a panel INSIDE the parent (the video frame) instead of
   *  a full-screen Modal. The parent mounts it inside the frame when open. */
  inline?: boolean;
}

// Compact relative time (matches the local formatters used elsewhere in the app).
const timeAgo = (iso: string): string => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
};

export const CommentsSheet: React.FC<Props> = ({ visible, video, onClose, inline }) => {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'admin';
  const [text, setText] = useState('');

  const { comments, add, remove, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useComments(video?._id ?? null);
  const count = hasNextPage ? (video?.stats?.comments ?? comments.length) : comments.length;

  const canDelete = (c: VideoComment) =>
    !!c.mine || isAdmin || (!!video?.createdBy && !!me?.id && String(video.createdBy) === String(me.id));

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    add.mutate(t);
    setText('');
  };

  const onDelete = async (c: VideoComment) => {
    const ok = await confirmAsync('Delete comment', 'Remove this comment?', { confirmLabel: 'Delete', destructive: true });
    if (ok) remove.mutate(c._id);
  };

  const renderItem = ({ item }: { item: VideoComment }) => {
    const name = item.user?.name || item.user?.username || 'User';
    const initial = name.trim()[0]?.toUpperCase() ?? '?';
    return (
      <View style={s.row}>
        {item.user?.avatarUrl
          ? <Image source={{ uri: item.user.avatarUrl }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarTxt}>{initial}</Text></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.meta}><Text style={s.name}>{name}</Text>  {timeAgo(item.createdAt)}</Text>
          <Text style={s.text}>{item.text}</Text>
        </View>
        {canDelete(item) && (
          <Pressable onPress={() => onDelete(item)} hitSlop={8} style={s.del}>
            <Trash2 size={15} color="#94a3b8" />
          </Pressable>
        )}
      </View>
    );
  };

  const body = (
    <>
      <View style={s.grabber} />
      <View style={s.header}>
        <Text style={s.title}>Comments{count ? ` · ${count}` : ''}</Text>
        <Pressable onPress={onClose} hitSlop={8}><X size={22} color={Colors.text} /></Pressable>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={comments.length ? s.listPad : s.listEmpty}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        ListEmptyComponent={
          isLoading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
            : (
              <View style={s.empty}>
                <MessageCircle size={34} color="#cbd5e1" strokeWidth={1.6} />
                <Text style={s.emptyTitle}>No comments yet</Text>
                <Text style={s.emptySub}>Be the first to comment.</Text>
              </View>
            )
        }
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 14 }} /> : null}
      />

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment…"
          placeholderTextColor={Colors.textSecondary}
          multiline
          maxLength={500}
        />
        <Pressable style={[s.post, !text.trim() && s.postOff]} onPress={submit} disabled={!text.trim()} hitSlop={6}>
          <Send size={18} color="#fff" />
        </Pressable>
      </View>
    </>
  );

  // Desktop: an in-container panel (bottom sheet clipped to the video frame).
  if (inline) {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.inlineSheet}>{body}</View>
      </View>
    );
  }

  // Mobile: full-screen slide-up Modal.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.kav}
        pointerEvents="box-none"
      >
        <View style={s.sheet}>{body}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '72%', backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  inlineSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '72%', backgroundColor: Colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text },

  listPad: { paddingHorizontal: 16, paddingVertical: 12 },
  listEmpty: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'flex-start' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e2e8f0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  avatarTxt: { color: '#fff', fontFamily: Fonts.bold, fontSize: 14 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  name: { fontFamily: Fonts.bold, color: Colors.text, fontSize: 13 },
  text: { fontSize: 14, color: Colors.text, lineHeight: 19, marginTop: 2, fontFamily: Fonts.regular },
  del: { padding: 4, marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 40 },
  emptyTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#94a3b8', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#cbd5e1' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 12, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  input: { flex: 1, maxHeight: 110, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  post: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  postOff: { opacity: 0.4 },
});

export default CommentsSheet;
