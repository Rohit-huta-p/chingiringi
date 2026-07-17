import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors } from '../../constants/theme';
import { Card } from '../../components/Card';
import { Coins, ArrowDownToLine } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI, AppNotification } from '../../api/notifications';

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export const NotificationsScreen = () => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list(),
  });

  const notifications: AppNotification[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsAPI.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { padding: isMobile ? 16 : 24 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <TouchableOpacity
          onPress={() => markAllMut.mutate()}
          disabled={unreadCount === 0 || markAllMut.isPending}
          style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
        >
          <Text style={[styles.markAllBtnText, unreadCount === 0 && styles.markAllBtnTextDisabled]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            You'll see cashback updates, deal alerts, and referral activity here.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {notifications.map((item) => {
            const isCoins = item.type === 'coins_credited' || item.type === 'coins_unlocked';
            const Icon = isCoins ? Coins : ArrowDownToLine;
            return (
              <TouchableOpacity
                key={item._id}
                style={[styles.notifItem, !item.read && styles.notifItemUnread]}
                onPress={() => {
                  if (!item.read) markReadMut.mutate(item._id);
                }}
                activeOpacity={item.read ? 1 : 0.7}
              >
                <View style={styles.notifRow}>
                  <View style={[
                    styles.txIconContainer,
                    { backgroundColor: isCoins ? '#ecfdf5' : Colors.primaryLight10 },
                  ]}>
                    <Icon size={18} color={isCoins ? Colors.success : Colors.primary} />
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.notifTime}>{formatTimeAgo(item.createdAt)}</Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  markAllBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  markAllBtnDisabled: {
    opacity: 0.5,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  markAllBtnTextDisabled: {
    color: Colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  notifItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  notifItemUnread: {
    backgroundColor: Colors.primaryLight10,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notifInfo: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
    marginTop: 6,
  },
});
