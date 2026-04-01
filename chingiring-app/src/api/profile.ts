import apiClient from './client';

export interface UserProfile {
  _id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: string;
  referralCode?: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface Address {
  _id: string;
  userId: string;
  label: 'home' | 'work' | 'other';
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export const profileAPI = {
  getProfile: async () => {
    const response = await apiClient.get('/api/profile');
    return response.data;
  },

  updateProfile: async (data: { name?: string; email?: string; phone?: string }) => {
    const response = await apiClient.put('/api/profile', data);
    return response.data;
  },

  deleteAccount: async () => {
    const response = await apiClient.delete('/api/profile');
    return response.data;
  },
};

export const addressAPI = {
  getAddresses: async () => {
    const response = await apiClient.get('/api/addresses');
    return response.data;
  },

  createAddress: async (data: Omit<Address, '_id' | 'userId' | 'isDefault'>) => {
    const response = await apiClient.post('/api/addresses', data);
    return response.data;
  },

  updateAddress: async (id: string, data: Partial<Address>) => {
    const response = await apiClient.put(`/api/addresses/${id}`, data);
    return response.data;
  },

  deleteAddress: async (id: string) => {
    const response = await apiClient.delete(`/api/addresses/${id}`);
    return response.data;
  },

  setDefault: async (id: string) => {
    const response = await apiClient.patch(`/api/addresses/${id}/default`);
    return response.data;
  },
};
