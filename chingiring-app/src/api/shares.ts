import apiClient from './client';

export interface ShareResult {
  coinsAwarded: number;
  remainingToday: number;
  duplicate?: boolean;
}

export interface ShareQuota {
  usedToday: number;
  remaining: number;
  cap: number;
}

export interface ShareStats {
  todayCount: number; // distinct users who shared this item today
}

export const sharesAPI = {
  postShare: async (itemType: 'product' | 'store', itemId: string) => {
    const res = await apiClient.post('/api/shares', { itemType, itemId });
    return res.data as { status: string; data: ShareResult };
  },
  getQuota: async () => {
    const res = await apiClient.get('/api/shares/quota');
    return res.data as { status: string; data: ShareQuota };
  },
  getStats: async (itemType: 'product' | 'store', itemId: string) => {
    const res = await apiClient.get('/api/shares/stats', { params: { itemType, itemId } });
    return res.data as { status: string; data: ShareStats };
  },
};
