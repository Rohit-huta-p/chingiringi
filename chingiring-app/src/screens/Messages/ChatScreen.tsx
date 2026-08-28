import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Send } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import {
  getMessages, sendMessage, markConversationRead,
  type ChatMessage, type ChatOtherParty,
} from '../../api/chat';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useAuthStore } from '../../store';
import { Avatar, clockTime } from './parts';

/**
 * ChatScreen — a single conversation thread. Loads history, streams new
 * messages over the socket, and sends via REST with an optimistic bubble.
 *
 * Route params: { conversationId, title?, otherParty? }. otherParty drives the
 * header avatar + (for a store) tap-through to the store profile.
 */
export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);

  const conversationId: string = route.params?.conversationId;
  const otherParty: ChatOtherParty | undefined = route.params?.otherParty;
  const title: string = route.params?.title ?? otherParty?.name ?? 'Chat';
  // If the other party is a store, I'm the buyer here; otherwise I'm the seller.
  const myRole: 'buyer' | 'seller' = otherParty?.kind === 'store' ? 'buyer' : 'seller';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Append with dedupe by _id — the socket echoes the sender's own message.
  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
  }, []);

  // ── Initial history + clear unread ─────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const history = await getMessages(conversationId);
      if (!alive) return;
      setMessages(history);
      setLoading(false);
      // getMessages cleared my unread server-side — refresh the inbox + badge.
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
    })();
    return () => { alive = false; };
  }, [conversationId, queryClient]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useChatSocket({
    conversationId,
    onNewMessage: (m) => {
      appendMessage(m);
      if (m.senderId !== myId) {
        // Arrived while I'm looking at the thread → keep my badge clear.
        markConversationRead(conversationId);
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
      }
    },
    onMessagesRead: ({ readerRole }) => {
      // The other side read the thread → stamp my sent messages as read.
      if (readerRole !== myRole) {
        setMessages((prev) => prev.map((m) => (m.senderRole === myRole && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
      }
    },
  });

  useEffect(() => { if (!loading) scrollToEnd(); }, [messages.length, loading, scrollToEnd]);

  // ── Send (optimistic) ──────────────────────────────────────────────────────
  const onSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const temp: ChatMessage = {
      _id: tempId,
      conversationId,
      senderId: myId ?? 'me',
      senderRole: myRole,
      text: body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, temp]);

    try {
      const real = await sendMessage(conversationId, body);
      if (real) {
        // Swap the temp for the server message; drop any dup the socket echoed.
        setMessages((prev) => {
          const swapped = prev.map((m) => (m._id === tempId ? real : m));
          return swapped.filter((m, i, arr) => arr.findIndex((x) => x._id === m._id) === i);
        });
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(body); // restore so the user doesn't lose their message
      Alert.alert('Message not sent', 'Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }, [text, sending, conversationId, myId, myRole, queryClient]);

  const onHeaderPress = useCallback(() => {
    if (otherParty?.kind === 'store' && otherParty.storeId) {
      navigation.navigate('StoreDetail', { storeId: otherParty.storeId });
    }
  }, [navigation, otherParty]);

  // Index of my last message — the read receipt hangs off it.
  const lastMineIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === myId) return i;
    }
    return -1;
  }, [messages, myId]);

  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.senderId === myId;
    const showSeen = mine && index === lastMineIndex && !!item.readAt;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextTheirs]}>{item.text}</Text>
          <Text style={[styles.msgTime, mine ? styles.msgTimeMine : styles.msgTimeTheirs]}>{clockTime(item.createdAt)}</Text>
        </View>
        {showSeen ? <Text style={styles.seen}>Seen</Text> : null}
      </View>
    );
  }, [myId, lastMineIndex]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerParty}
          onPress={onHeaderPress}
          activeOpacity={otherParty?.kind === 'store' ? 0.6 : 1}
          disabled={otherParty?.kind !== 'store'}
        >
          <Avatar uri={otherParty?.avatarUrl || undefined} name={title} size={36} />
          <Text style={styles.headerName} numberOfLines={1}>{title}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.threadEmpty}>
              <Text style={styles.threadEmptyText}>
                Say hello 👋  Start the conversation with {title}.
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={Colors.textSecondary}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Send size={18} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerParty: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12 },
  headerName: { flex: 1, fontSize: 16, fontFamily: Fonts.bold, color: Colors.navy },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 12, paddingVertical: 14, gap: 8, flexGrow: 1 },

  bubbleRow: { maxWidth: '82%' },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: Colors.border },
  msgText: { fontSize: 15, fontFamily: Fonts.regular, lineHeight: 21 },
  msgTextMine: { color: '#fff' },
  msgTextTheirs: { color: Colors.navy },
  msgTime: { fontSize: 10.5, fontFamily: Fonts.regular, marginTop: 3, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(255,255,255,0.75)' },
  msgTimeTheirs: { color: Colors.textSecondary },
  seen: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.textSecondary, marginTop: 2, marginRight: 4 },

  threadEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  threadEmptyText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 42,
    backgroundColor: Colors.background, borderRadius: 21,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, fontFamily: Fonts.regular, color: Colors.navy,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.primaryLight, opacity: 0.6 },
});
