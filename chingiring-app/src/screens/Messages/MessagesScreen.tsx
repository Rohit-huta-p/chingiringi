import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MessageCircle, Search, X } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { getConversations, type Conversation } from '../../api/chat';
import { useAuthStore } from '../../store';
import { Avatar, timeAgo } from './parts';

const UNREAD_RED = '#EF4444';

/**
 * MessagesScreen — the inbox. Lists the caller's conversations (buyer + seller
 * side unified), newest first, and opens a thread on tap. Registered in both
 * the buyer and seller stacks and reached from the header messages icon.
 *
 * On the seller Messages TAB (tabRoot) it wears the Stage-language treatment:
 * All / Unanswered filter, search, an orange "needs a reply" affordance, and a
 * product thumbnail for threads that are about an item. The buyer inbox (pushed,
 * no tabRoot) keeps its original blue rendering untouched.
 */
export function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  // When mounted as a bottom-tab root (seller's Messages tab) there is nothing
  // to go "back" to, and the absolute tab bar overlays the list — so drop the
  // back arrow and pad the list clear of the bar. Buyer reaches this screen as
  // a pushed stack screen (no tabRoot) and keeps the back arrow.
  const isTabRoot = !!route.params?.tabRoot;
  const seller = isTabRoot; // the seller Messages tab is the only tab-root mount
  const myId = useAuthStore((s) => s.user?.id);

  const [filter, setFilter] = useState<'all' | 'unanswered'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const {
    data: conversations = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: getConversations,
    staleTime: 15_000,
  });

  // Refresh when returning to the inbox (covers messages sent/received while
  // a thread was open or the app was backgrounded).
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  // A thread "needs a reply" when the other party spoke last — the seller's
  // core triage signal. Derived, not stored (no separate "answered" flag).
  const needsReply = useCallback(
    (c: Conversation) => !!c.lastSenderId && !!myId && c.lastSenderId !== myId,
    [myId],
  );

  const unansweredCount = useMemo(
    () => (seller ? conversations.filter(needsReply).length : 0),
    [seller, conversations, needsReply],
  );

  const visible = useMemo(() => {
    let list = conversations;
    if (seller && filter === 'unanswered') list = list.filter(needsReply);
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (c) =>
          c.otherParty.name.toLowerCase().includes(term) ||
          (c.lastMessage || '').toLowerCase().includes(term),
      );
    }
    return list;
  }, [conversations, seller, filter, query, needsReply]);

  const openThread = useCallback((c: Conversation) => {
    navigation.navigate('Chat', {
      conversationId: c._id,
      title: c.otherParty.name,
      otherParty: c.otherParty,
    });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Conversation }) => {
    const mineLast = !!item.lastSenderId && !!myId && item.lastSenderId === myId;
    const preview = `${mineLast ? 'You: ' : ''}${item.lastMessage || ''}`;

    // ── Seller row — Stage treatment ──────────────────────────────────────────
    if (seller) {
      const needs = needsReply(item);
      const thumb = item.lastProduct?.imageUrl;
      return (
        <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.7}>
          <Avatar uri={item.otherParty.avatarUrl || undefined} name={item.otherParty.name} size={52} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={[styles.name, needs && styles.nameUnread]} numberOfLines={1}>{item.otherParty.name}</Text>
              <Text style={[styles.time, needs && styles.timeSeller]}>{timeAgo(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.rowBottom}>
              {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : null}
              <Text style={[styles.preview, needs && styles.previewNeeds]} numberOfLines={1}>{preview}</Text>
              {needs ? <View style={styles.dot} /> : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ── Buyer row — original rendering (unchanged) ────────────────────────────
    const unread = item.unread > 0;
    return (
      <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.7}>
        <Avatar uri={item.otherParty.avatarUrl || undefined} name={item.otherParty.name} size={52} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{item.otherParty.name}</Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>{timeAgo(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>{preview}</Text>
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [myId, seller, needsReply, openThread]);

  const emptyCopy = useMemo(() => {
    if (query.trim()) return { title: 'No matches', sub: `No conversations match “${query.trim()}”.` };
    if (seller && filter === 'unanswered') {
      return { title: 'All caught up', sub: 'You’ve replied to everyone. New questions from buyers will show up here.' };
    }
    if (seller) {
      return { title: 'No messages yet', sub: 'When a buyer messages you about a product or your live stream, it shows up here.' };
    }
    return { title: 'No messages yet', sub: 'When you message a seller about their products or live streams, the conversation shows up here.' };
  }, [query, seller, filter]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, seller && styles.headerFlush, { paddingTop: insets.top + (seller ? 16 : 6) }]}>
        {isTabRoot ? null : (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, isTabRoot && styles.titleTabRoot]}>Messages</Text>
        {seller ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => { setSearchOpen((o) => { if (o) setQuery(''); return !o; }); }}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search messages'}
          >
            {searchOpen ? <X size={20} color={Colors.navy} strokeWidth={2.2} /> : <Search size={20} color={Colors.navy} strokeWidth={2} />}
          </TouchableOpacity>
        ) : null}
      </View>

      {seller && searchOpen ? (
        <View style={styles.searchRow}>
          <Search size={17} color={Colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or message"
            placeholderTextColor={Colors.textSecondary}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {seller ? (
        <View style={styles.pills}>
          <TouchableOpacity
            style={[styles.pill, filter === 'all' && styles.pillActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, filter === 'all' && styles.pillTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, filter === 'unanswered' && styles.pillActive]}
            onPress={() => setFilter('unanswered')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, filter === 'unanswered' && styles.pillTextActive]}>Unanswered</Text>
            {unansweredCount > 0 ? (
              <View style={styles.pillCount}>
                <Text style={styles.pillCountText}>{unansweredCount > 99 ? '99+' : unansweredCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          visible.length === 0 ? styles.emptyWrap : null,
          isTabRoot ? { paddingBottom: insets.bottom + 96 } : null,
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <View style={[styles.iconWrap, seller && styles.iconWrapSeller]}>
                <MessageCircle size={40} color={seller ? Colors.orange : Colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptySub}>{emptyCopy.sub}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Seller: the title + search + pills read as one white block bounded by a
  // single divider under the pills — so drop the border here and put it there.
  headerFlush: { borderBottomWidth: 0 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy },
  titleTabRoot: { paddingLeft: 8 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 10,
    paddingHorizontal: 12, height: 40,
    backgroundColor: Colors.background, borderRadius: 20,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: Colors.navy, padding: 0 },

  pills: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 16, paddingHorizontal: 15, paddingVertical: 7,
    backgroundColor: Colors.background,
  },
  pillActive: { backgroundColor: Colors.orange },
  pillText: { fontSize: 12.5, fontFamily: Fonts.semiBold, color: Colors.navy },
  pillTextActive: { color: '#fff', fontFamily: Fonts.bold },
  pillCount: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: UNREAD_RED, alignItems: 'center', justifyContent: 'center',
  },
  pillCountText: { fontSize: 10, fontFamily: Fonts.bold, color: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flex: 1, fontSize: 15.5, fontFamily: Fonts.semiBold, color: Colors.navy },
  nameUnread: { fontFamily: Fonts.bold },
  time: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
  timeUnread: { color: Colors.primary, fontFamily: Fonts.semiBold },
  timeSeller: { color: Colors.orange, fontFamily: Fonts.semiBold },
  preview: { flex: 1, fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary },
  previewUnread: { color: Colors.navy, fontFamily: Fonts.medium },
  previewNeeds: { color: Colors.navy, fontFamily: Fonts.semiBold },
  thumb: { width: 26, height: 26, borderRadius: 6, backgroundColor: Colors.border },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.orange },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 80 },

  emptyWrap: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  iconWrapSeller: { backgroundColor: 'rgba(249,115,22,0.10)' },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.navy },
  emptySub: {
    fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 300,
  },
});
