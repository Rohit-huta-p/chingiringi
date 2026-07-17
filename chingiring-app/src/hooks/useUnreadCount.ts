import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '../api/notifications';
import { useAuthStore } from '../store';

/** Unread notification count for the nav badge. Polls every 60s + on window focus. 0 when logged out. */
export function useUnreadCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsAPI.unreadCount(),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    enabled: isAuthenticated,
  });
  return data?.count ?? 0;
}
