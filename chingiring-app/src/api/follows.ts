import apiClient from './client';
import type { Store } from './stores';

export const followsAPI = {
  /** POST /stores/:id/follow */
  followStore: async (storeId: string): Promise<void> => {
    await apiClient.post(`/api/stores/${storeId}/follow`);
  },

  /** DELETE /stores/:id/follow */
  unfollowStore: async (storeId: string): Promise<void> => {
    await apiClient.delete(`/api/stores/${storeId}/follow`);
  },

  /** GET /users/me/following → Store[] */
  getFollowing: async (): Promise<Store[]> => {
    const res = await apiClient.get('/api/users/me/following');
    return res.data?.stores ?? res.data?.data ?? [];
  },
};
