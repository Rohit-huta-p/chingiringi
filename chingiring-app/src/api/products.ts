import apiClient from './client';

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  coinsPrice: number;
  imageUrl: string;    // cover image (mirrors images[0])
  mobileImageUrl?: string; // optional mobile-specific cover (mirrors mobileImages[0])
  images?: string[];   // full gallery, cover first
  mobileImages?: string[]; // mobile-specific gallery, cover first; mobile surfaces prefer it
  stock: number;
  sold: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export const productsAPI = {
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    featured?: string;
    sort?: string;
  }) => {
    const response = await apiClient.get('/api/products', { params });
    return response.data;
  },

  getProduct: async (id: string) => {
    const response = await apiClient.get(`/api/products/${id}`);
    return response.data;
  },

  getFeaturedProducts: async () => {
    const response = await apiClient.get('/api/products/featured');
    return response.data;
  },
};
