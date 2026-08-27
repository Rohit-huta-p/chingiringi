import apiClient from './client';

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  mrp?: number;         // max retail price (strike-through ref); 0/undefined = unset
  coinsPrice: number;
  imageUrl: string;    // cover image (mirrors images[0])
  mobileImageUrl?: string; // optional mobile-specific cover (mirrors mobileImages[0])
  images?: string[];   // full gallery, cover first
  mobileImages?: string[]; // mobile-specific gallery, cover first; mobile surfaces prefer it
  merchant?: string;    // where it's sold (e.g. "Amazon") — shown as "Available at …"
  rating?: number;      // admin-set headline rating (0–5)
  ratingCount?: number; // admin-set review/rating count
  sold: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields a seller may set on their own product (POST/PUT /api/products/mine). */
export interface MyProductInput {
  name: string;
  price: number;
  description?: string;
  category?: string;
  mrp?: number;
  imageUrl?: string;
  images?: string[];
  affiliateUrl?: string;
}

export const productsAPI = {
  getProducts: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    storeId?: string;  // Filter to products assigned to a specific store
    featured?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
    minCoins?: number;
    maxCoins?: number;
    minRating?: number;
    minDiscount?: number;
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

  /** Seller: create a product on their own store. */
  createMine: async (input: MyProductInput) => {
    const response = await apiClient.post('/api/products/mine', input);
    return response.data?.data?.product ?? response.data?.product;
  },

  /** Seller: update one of their own products. */
  updateMine: async (id: string, input: MyProductInput) => {
    const response = await apiClient.put(`/api/products/mine/${id}`, input);
    return response.data?.data?.product ?? response.data?.product;
  },

  /** Seller: delete one of their own products. */
  deleteMine: async (id: string) => {
    await apiClient.delete(`/api/products/mine/${id}`);
  },
};
