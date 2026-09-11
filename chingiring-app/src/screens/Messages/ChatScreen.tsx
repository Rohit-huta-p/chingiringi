import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Send, X } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import {
  getMessages, sendMessage, markConversationRead,
  type ChatMessage, type ChatOtherParty, type ChatProduct,
} from '../../api/chat';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useAuthStore } from '../../store';
import { Avatar, clockTime } from './parts';
import { ProductPreviewSheet } from '../../components/ProductPreviewSheet';

/**
 * ChatScreen — a single conversation thread. Loads history, streams new
 * messages over the socket, and sends via REST with an optimistic bubble.
 *
 * Route params: { conversationId, title?, otherParty? }. otherParty drives the
 * header avatar + (for a store) tap-through to the store profile.
 *
 * Can also render EMBEDDED (values via props instead of route params) inside a
 * bottom-sheet Modal — see ChatSheet — so the live viewer opens a chat as a
 * slide-up sheet that works on web and native alike.
 */
type ChatScreenProps = {
  conversationId?: string;
  otherParty?: ChatOtherParty;
  title?: string;
  prefill?: string;
  product?: ChatProduct | null;
  /** Dismiss handler when embedded (closes the sheet instead of nav.goBack). */
  onClose?: () => void;
  /** Sheet mode: no status-bar inset, an X (close) instead of the back chevron. */
  embedded?: boolean;
};

export function ChatScreen(props: ChatScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);

  const conversationId: string = props.conversationId ?? route.params?.conversationId;
  const otherParty: ChatOtherParty | undefined = props.otherParty ?? route.params?.otherParty;
  const title: string = props.title ?? route.params?.title ?? otherParty?.name ?? 'Chat';
  const embedded = !!props.embedded;
  const onCloseProp = props.onClose;
  const close = useCallback(() => {
    if (onCloseProp) onCloseProp();
    else navigation.goBack();
  }, [onCloseProp, navigation]);
  // Navigating away from an embedded sheet must dismiss it first, else the new
  // screen would render behind the still-open Modal.
  const goTo = useCallback((name: string, params?: object) => {
    if (embedded) close();
    navigation.navigate(name, params);
  }, [embedded, close, navigation]);
  // If the other party is a store, I'm the buyer here; otherwise I'm the seller.
  const myRole: 'buyer' | 'seller' = otherParty?.kind === 'store' ? 'buyer' : 'seller';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // Prefill text + a pinned product card arrive from a product page's "Chat to buy".
  const [text, setText] = useState<string>(props.prefill ?? route.params?.prefill ?? '');
  const [attached, setAttached] = useState<ChatProduct | null>(props.product ?? route.params?.product ?? null);
  const [previewProduct, setPreviewProduct] = useState<ChatProduct | null>(null);
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
    const productToSend = attached ?? undefined; // attaches to this send only
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
      product: productToSend,
    };
    setMessages((prev) => [...prev, temp]);

    try {
      const real = await sendMessage(conversationId, body, productToSend);
      if (real) {
        // Swap the temp for the server message; drop any dup the socket echoed.
        setMessages((prev) => {
          const swapped = prev.map((m) => (m._id === tempId ? real : m));
          return swapped.filter((m, i, arr) => arr.findIndex((x) => x._id === m._id) === i);
        });
        setAttached(null); // product delivered — unpin it
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(body); // restore so the user doesn't lose their message
      Alert.alert('Message not sent', 'Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  }, [text, sending, attached, conversationId, myId, myRole, queryClient]);

  const onHeaderPress = useCallback(() => {
    if (otherParty?.kind === 'store' && otherParty.storeId) {
      goTo('StoreDetail', { storeId: otherParty.storeId });
    }
  }, [goTo, otherParty]);

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
          {item.product ? (
            <TouchableOpacity
              style={styles.msgProduct}
              activeOpacity={0.8}
              onPress={() => {
                if (!item.product) return;
                // Seller previews it in a sheet; buyer opens the full product page.
                if (myRole === 'seller') setPreviewProduct(item.product);
                else if (item.product.productId) goTo('ProductDetail', { productId: item.product.productId });
              }}
            >
              {item.product.imageUrl ? (
                <Image source={{ uri: item.product.imageUrl }} style={styles.msgProductImg} />
              ) : (
                <View style={[styles.msgProductImg, styles.imgFallback]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.msgProductName} numberOfLines={2}>{item.product.name}</Text>
                {typeof item.product.price === 'number' ? (
                  <Text style={styles.msgProductPrice}>₹{item.product.price.toLocaleString('en-IN')}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextTheirs]}>{item.text}</Text>
          <Text style={[styles.msgTime, mine ? styles.msgTimeMine : styles.msgTimeTheirs]}>{clockTime(item.createdAt)}</Text>
        </View>
        {showSeen ? <Text style={styles.seen}>Seen</Text> : null}
      </View>
    );
  }, [myId, lastMineIndex, myRole, goTo]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: embedded ? 8 : insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={embedded ? 'Close' : 'Back'}
        >
          {embedded ? (
            <X size={24} color={Colors.navy} strokeWidth={2.2} />
          ) : (
            <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
          )}
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

      <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {attached ? (
          <View style={styles.attachCard}>
            {attached.imageUrl ? (
              <Image source={{ uri: attached.imageUrl }} style={styles.attachImg} />
            ) : (
              <View style={[styles.attachImg, styles.imgFallback]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.attachName} numberOfLines={1}>{attached.name}</Text>
              {typeof attached.price === 'number' ? (
                <Text style={styles.attachPrice}>₹{attached.price.toLocaleString('en-IN')}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setAttached(null)} hitSlop={8} style={styles.attachClose} accessibilityLabel="Remove product">
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.composerRow}>
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
      </View>

      <ProductPreviewSheet
        visible={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        productId={previewProduct?.productId}
        initial={previewProduct as any}
      />
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

  composerWrap: {
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 8, marginBottom: 8,
  },
  attachImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.border },
  imgFallback: { backgroundColor: Colors.border },
  attachName: { fontSize: 13.5, fontFamily: Fonts.semiBold, color: Colors.navy },
  attachPrice: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary, marginTop: 1 },
  attachClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  msgProduct: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 8, marginBottom: 8, maxWidth: 240,
  },
  msgProductImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.border },
  msgProductName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.navy },
  msgProductPrice: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.primary, marginTop: 1 },
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
