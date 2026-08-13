import apiClient from './client';

export interface Wallet {
  _id: string;
  userId: string;
  pendingCashback: number;
  confirmedCashback: number;
  coins: number;
  pendingCoins?: number;
  lifetimeEarned: number;
}

export interface ShareRewards { pending: number; confirmed: number; }

// Withdrawals awaiting/processing admin payout — ₹ total + count (GET /api/wallet).
export interface PendingWithdrawals { total: number; count: number; }

export interface Transaction {
  _id: string;
  userId: string;
  type: 'cashback' | 'referral' | 'withdrawal' | 'bonus' | 'coin_credit' | 'coin_debit';
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'processing' | 'completed';
  description: string;
  dealId?: string;
  metadata?: {
    brand?: string;
    orderId?: string;
    lockExpiresAt?: string;
    rejectionReason?: string;
    payoutId?: string;
  };
  createdAt: string;
}

export const walletAPI = {
  getWallet: async () => {
    const response = await apiClient.get('/api/wallet');
    return response.data;
  },

  getWalletSummary: async () => {
    const response = await apiClient.get('/api/wallet/summary');
    return response.data;
  },

  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    period?: string;
  }) => {
    const response = await apiClient.get('/api/wallet/transactions', { params });
    return response.data;
  },

  getTransaction: async (id: string) => {
    const response = await apiClient.get(`/api/wallet/transactions/${id}`);
    return response.data;
  },

  requestWithdrawal: async (data: {
    coins: number;
    method: 'UPI' | 'Bank';
    paymentDetails: string;
    accountNumber?: string;
    ifsc?: string;
  }) => {
    const response = await apiClient.post('/api/wallet/withdraw', data);
    return response.data;
  },
};
