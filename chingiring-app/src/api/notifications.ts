import apiClient from './client';

export type NotificationType =
  | 'coins_credited'
  | 'coins_unlocked'
  | 'wallet_credited'
  | 'withdrawal_submitted'
  | 'withdrawal_paid'
  | 'withdrawal_rejected';

export interface AppNotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPrefs {
  cashback: boolean;
  withdrawals: boolean;
  push: boolean;
}

export const notificationsAPI = {
  // GET /api/notifications?before=<ISO createdAt cursor> → data: { notifications }
  list: async (before?: string): Promise<{ notifications: AppNotification[] }> => {
    const res = await apiClient.get('/api/notifications', { params: before ? { before } : {} });
    return res.data?.data ?? { notifications: [] };
  },

  // GET /api/notifications/unread-count → data: { count }
  unreadCount: async (): Promise<{ count: number }> => {
    const res = await apiClient.get('/api/notifications/unread-count');
    return res.data?.data ?? { count: 0 };
  },

  // PATCH /api/notifications/:id/read → { status, message }
  markRead: async (id: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.patch(`/api/notifications/${id}/read`);
    return res.data;
  },

  // PATCH /api/notifications/read-all → { status, message }
  markAllRead: async (): Promise<{ status: string; message: string }> => {
    const res = await apiClient.patch('/api/notifications/read-all');
    return res.data;
  },

  // POST /api/notifications/push-token  body: { token, platform }
  registerPushToken: async (token: string, platform: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.post('/api/notifications/push-token', { token, platform });
    return res.data;
  },

  // DELETE /api/notifications/push-token  body: { token }
  // NOTE: axios sends a DELETE body only via the `data` config key — the backend reads req.body.token.
  unregisterPushToken: async (token: string): Promise<{ status: string; message: string }> => {
    const res = await apiClient.delete('/api/notifications/push-token', { data: { token } });
    return res.data;
  },

  // PATCH /api/profile/notification-prefs  body: { cashback?, withdrawals?, push? } → data: { user }
  // (The prefs route lives under /api/profile, NOT /api/notifications and NOT /api/users.)
  updatePrefs: async (prefs: Partial<NotificationPrefs>): Promise<{ user: any }> => {
    const res = await apiClient.patch('/api/profile/notification-prefs', prefs);
    return res.data?.data;
  },
};
