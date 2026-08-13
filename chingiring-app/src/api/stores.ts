import apiClient from './client';
import type { StoreCategory } from '../data/offlineStores';

export interface Store {
  _id: string;
  name: string;
  shortName: string;
  slug?: string;
  category: StoreCategory;
  description?: string;
  logoUrl?: string;
  images?: string[];
  phone?: string;
  address: string;
  area?: string;
  city?: string;
  /** Pasted Google Maps link (admin) — backend parses lat/lng from it. */
  mapsUrl?: string;
  /** Parsed from mapsUrl on save; used to place the store's map pin. */
  lat?: number | null;
  lng?: number | null;
  openTime?: string;
  closeTime?: string;
  openDays?: number[];
  /** Computed server-side for display. */
  opensAt?: string;
  isOpen?: boolean;
  /** The public discount the shopper gets. */
  userDiscountPercent: number;
  isActive: boolean;
  isFeatured: boolean;
  isVerified?: boolean;
  rating: number;
  reviewsCount: number;
  // ── admin-only (present only on /api/admin/stores) ──
  platformCommissionPercent?: number;
  maxDiscountCap?: number;
  minBillAmount?: number;
  settlementCycle?: 'weekly' | 'monthly';
  payoutAccount?: { method?: string; upiId?: string; bankName?: string; accountLast4?: string };
  totalGmv?: number;
  totalTxns?: number;
  createdAt?: string;
}

export const storesAPI = {
  list: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    featured?: string;
    sort?: string;
  }) => {
    const response = await apiClient.get('/api/stores', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await apiClient.get(`/api/stores/${id}`);
    return response.data;
  },
};
