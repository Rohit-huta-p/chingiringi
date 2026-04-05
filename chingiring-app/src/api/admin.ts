import apiClient from './client';

export const adminAPI = {
  // ─── Dashboard ─────────────────────────────────────────────────────────────
  getDashboardStats: async () => {
    const response = await apiClient.get('/api/admin/dashboard');
    return response.data;
  },

  // ─── Users ─────────────────────────────────────────────────────────────────
  getUsers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/api/admin/users', { params });
    return response.data;
  },

  // ─── Deals ─────────────────────────────────────────────────────────────────
  getDeals: async (params?: { page?: number; limit?: number }) => {
    const response = await apiClient.get('/api/admin/deals', { params });
    return response.data;
  },
  createDeal: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/deals', data);
    return response.data;
  },
  updateDeal: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/deals/${id}`, data);
    return response.data;
  },
  deleteDeal: async (id: string) => {
    const response = await apiClient.delete(`/api/deals/${id}`);
    return response.data;
  },
};
