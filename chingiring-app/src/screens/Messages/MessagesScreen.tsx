import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { Colors, Fonts } from '../../constants/theme';
import { getConversations, type Conversation } from '../../api/chat';
import { useAuthStore } from '../../store';
import { Avatar, timeAgo } from './parts';

/**
 * MessagesScreen — the inbox. Lists the caller's conversations (buyer + seller
 * side unified), newest first, and opens a thread on tap. Registered in both
 * the buyer and seller stacks and reached from the header messages icon.
 */
export function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const myId = useAuthStore((s) => s.user?.id);

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
  }, [myId, openThread]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={24} color={Colors.navy} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={conversations.length === 0 ? styles.emptyWrap : undefined}
        refreshControl={
          <RefreshControl refreshing={isRefetching && !isLoading} onRefresh={refetch} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <View style={styles.iconWrap}>
                <MessageCircle size={40} color={Colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                When you message a seller about their products or live streams, the conversation shows up here.
              </Text>
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.navy },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15.5, fontFamily: Fonts.semiBold, color: Colors.navy },
  nameUnread: { fontFamily: Fonts.bold },
  time: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },
  timeUnread: { color: Colors.primary, fontFamily: Fonts.semiBold },
  preview: { flex: 1, fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary },
  previewUnread: { color: Colors.navy, fontFamily: Fonts.medium },
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
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.navy },
  emptySub: {
    fontSize: 13.5, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 300,
  },
});
