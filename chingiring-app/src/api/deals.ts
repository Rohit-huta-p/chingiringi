import apiClient from './client';

export interface Deal {
  _id: string;
  title: string;
  description: string;
  brand: string;
  category: { _id: string; name: string; slug: string };
  cashbackPercent: number;
  cashbackType: 'percentage' | 'flat';
  flatCashback: number;
  affiliateUrl: string;
  imageUrl: string;
  lockPeriodDays: number;
  expiresAt: string;
  tags: string[];
  termsAndConditions: string;
  isActive: boolean;
  isFeatured: boolean;
  /** Admin-toggled — drives the "Trending Now" row on the user Deals page. */
  isTrending?: boolean;
  clickCount: number;
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  /** Optional category tile image (Cloudinary URL). Falls back to an emoji when empty. */
  imageUrl?: string;
  /** Optional theme color (hex). Selecting the category tints the home header. */
  color?: string;
  isActive: boolean;
  sortOrder: number;
  /** Admin-toggled — hide this category from the user Deals page. Default true. */
  showOnDealsPage?: boolean;
  /** Per-category position WITHIN the deals page. Lower = higher. */
  dealsPageSortOrder?: number;
}

export interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: 'deal' | 'category' | 'url';
  linkValue: string;
  position: 'hero' | 'sidebar' | 'inline';
}

export interface TrendingBrand {
  brand: string;
  totalClicks: number;
  maxCashback: number;
  dealCount: number;
  category: string;
}

interface PaginatedResponse<T> {
  data: {
    [key: string]: T[];
    pagination: any;
  };
}

export const dealsAPI = {
  getDeals: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    brand?: string;
    featured?: string;
    /** Pass `'true'` to filter to only admin-flagged trending deals. */
    trending?: string;
    sort?: string;
  }) => {
    const response = await apiClient.get('/api/deals', { params });
    return response.data;
  },

  getDeal: async (id: string) => {
    const response = await apiClient.get(`/api/deals/${id}`);
    return response.data;
  },

  getFeaturedDeals: async () => {
    const response = await apiClient.get('/api/deals/featured');
    return response.data;
  },

  getTrendingBrands: async () => {
    const response = await apiClient.get('/api/deals/trending-brands');
    return response.data;
  },

  trackClick: async (id: string) => {
    const response = await apiClient.post(`/api/deals/${id}/click`);
    return response.data;
  },
};

export const categoriesAPI = {
  getCategories: async () => {
    const response = await apiClient.get('/api/categories');
    return response.data;
  },

  getCategory: async (slug: string) => {
    const response = await apiClient.get(`/api/categories/${slug}`);
    return response.data;
  },
};

export const bannersAPI = {
  getBanners: async (position?: string) => {
    const response = await apiClient.get('/api/banners', {
      params: position ? { position } : undefined,
    });
    return response.data;
  },
};
