import apiClient from './client';

export const referralsAPI = {
  apply: async (code: string) => {
    const res = await apiClient.post('/api/referrals/apply', { code });
    return res.data;
  },
  claim: async () => {
    const res = await apiClient.post('/api/referrals/claim');
    return res.data;
  },
  getStats: async () => {
    const res = await apiClient.get('/api/referrals/stats');
    return res.data;
  },
};
