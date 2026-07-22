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

  // ─── Products ──────────────────────────────────────────────────────────────
  getProducts: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/api/admin/products', { params });
    return response.data;
  },
  createProduct: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/products', data);
    return response.data;
  },
  updateProduct: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id: string) => {
    const response = await apiClient.delete(`/api/products/${id}`);
    return response.data;
  },

  // ─── Categories ────────────────────────────────────────────────────────────
  // Public GET hits the same /api/categories endpoint; admin CRUD goes
  // through the admin-protected POST/PUT/DELETE routes on the same path.
  getCategories: async () => {
    const response = await apiClient.get('/api/categories');
    return response.data;
  },
  createCategory: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/categories', data);
    return response.data;
  },
  updateCategory: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/categories/${id}`, data);
    return response.data;
  },
  // reassignTo: omit to attempt a plain delete (409 if the category is in use);
  // pass a target category id (or '' for uncategorised) to move its
  // products/deals first, then delete.
  deleteCategory: async (id: string, reassignTo?: string) => {
    const response = await apiClient.delete(`/api/categories/${id}`, {
      params: reassignTo !== undefined ? { reassignTo } : undefined,
    });
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

  // ─── Offline Stores ─────────────────────────────────────────────────────────
  // Public GET for shoppers hits /api/stores; admin list (with deal terms) is
  // /api/admin/stores; writes go through the admin-gated /api/stores routes.
  getStores: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/api/admin/stores', { params });
    return response.data;
  },
  createStore: async (data: Record<string, any>) => {
    const response = await apiClient.post('/api/stores', data);
    return response.data;
  },
  updateStore: async (id: string, data: Record<string, any>) => {
    const response = await apiClient.put(`/api/stores/${id}`, data);
    return response.data;
  },
  deleteStore: async (id: string) => {
    const response = await apiClient.delete(`/api/stores/${id}`);
    return response.data;
  },

  // ─── Wallet Operations Hub ─────────────────────────────────────────────────

  /** Pending Queue tab — withdrawals + lock-expired txns + recent imports. */
  getQueueSummary: async () => {
    const response = await apiClient.get('/api/admin/queue');
    return response.data;
  },

  /** User Wallet tab — clicks + transactions interleaved on a single timeline. */
  getUserTimeline: async (userId: string, params?: { limit?: number }) => {
    const response = await apiClient.get(`/api/admin/users/${userId}/timeline`, { params });
    return response.data;
  },

  /** Reports Inbox tab — bulk-credit from a parsed merchant report. */
  importReport: async (data: {
    merchant: string;
    periodStart?: string;
    periodEnd?: string;
    rows: Array<{
      orderId: string;
      subid?: string;
      amount?: number;
      commission: number;
      status?: string;
      timestamp?: string;
    }>;
  }) => {
    const response = await apiClient.post('/api/admin/reports/import', data);
    return response.data;
  },

  /** Reports Inbox — history list. */
  listReportImports: async (params?: { limit?: number }) => {
    const response = await apiClient.get('/api/admin/reports/imports', { params });
    return response.data;
  },

  /** Reports Inbox — drill into a single past import for forensics. */
  getReportImport: async (id: string) => {
    const response = await apiClient.get(`/api/admin/reports/imports/${id}`);
    return response.data;
  },

  // ─── Coin-economy settings ─────────────────────────────────────────────────
  getSettings: async () => {
    const response = await apiClient.get('/api/admin/settings');
    return response.data;
  },
  updateSettings: async (data: {
    passThroughPercent?: number;
    coinsPerRupee?: number;
    defaultLockDays?: number;
    cuelinksPublisherId?: string;
    amazonAssociateTag?: string;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
    razorpayAccountNumber?: string;
    razorpayEnabled?: boolean;
  }) => {
    const response = await apiClient.patch('/api/admin/settings', data);
    return response.data;
  },
};
