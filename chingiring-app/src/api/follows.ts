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
    // Same { status, data: {...} } envelope as the rest of the backend —
    // drill one level deeper than before, and guarantee an array either
    // way so a shape mismatch can't crash callers that spread/map this.
    const payload = res.data?.data?.stores ?? res.data?.stores ?? res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  },
};
