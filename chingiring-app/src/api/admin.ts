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
  updateUserStatus: async (id: string, action: 'block' | 'unblock', reason?: string) => {
    const response = await apiClient.patch(`/api/admin/users/${id}/status`, {
      action,
      reason,
    });
    return response.data;
  },
  adjustUserWallet: async (
    id: string,
    data: {
      type: 'credit' | 'debit';
      amount: number;
      currency?: 'cashback' | 'coins';
      note?: string;
    },
  ) => {
    const response = await apiClient.post(`/api/admin/users/${id}/wallet-adjust`, data);
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

  // ─── Banners ───────────────────────────────────────────────────────────────
  getBanners: async () => {
    const response = await apiClient.get('/api/admin/banners');
    return response.data;
  },
  createBanner: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/banners', data);
    return response.data;
  },
  updateBanner: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/banners/${id}`, data);
    return response.data;
  },
  deleteBanner: async (id: string) => {
    const response = await apiClient.delete(`/api/banners/${id}`);
    return response.data;
  },

  // ─── Withdrawals (Payouts) ─────────────────────────────────────────────────
  getWithdrawals: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => {
    const response = await apiClient.get('/api/admin/withdrawals', { params });
    return response.data;
  },
  updateWithdrawal: async (
    id: string,
    data: { action: 'process' | 'complete' | 'reject'; note?: string; txnId?: string },
  ) => {
    const response = await apiClient.patch(`/api/admin/withdrawals/${id}`, data);
    return response.data;
  },

  // ─── Coupons ───────────────────────────────────────────────────────────────
  getCoupons: async () => {
    const response = await apiClient.get('/api/admin/coupons');
    return response.data;
  },
  createCoupon: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/admin/coupons', data);
    return response.data;
  },
  updateCoupon: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/admin/coupons/${id}`, data);
    return response.data;
  },
  deleteCoupon: async (id: string) => {
    const response = await apiClient.delete(`/api/admin/coupons/${id}`);
    return response.data;
  },
  getCouponUsage: async (id: string) => {
    const response = await apiClient.get(`/api/admin/coupons/${id}/usage`);
    return response.data;
  },
};
