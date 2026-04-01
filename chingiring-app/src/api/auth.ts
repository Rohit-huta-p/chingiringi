import apiClient from './client';

export const authAPI = {
  signup: async (data: any) => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },
  login: async (data: any) => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },
  sendOtp: async (data: { phone?: string; email?: string }) => {
    const response = await apiClient.post('/auth/send-otp', data);
    return response.data;
  },
  verifyOtp: async (data: { identifier: string; otp: string }) => {
    const response = await apiClient.post('/auth/verify-otp', data);
    return response.data;
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
  forgotPassword: async (data: { email: string }) => {
    const response = await apiClient.post('/auth/forgot-password', data);
    return response.data;
  },
  resetPassword: async (data: any) => {
    const response = await apiClient.post('/auth/reset-password', data);
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }
};
