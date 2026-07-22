import apiClient from './client';

export interface ApiReviewUser {
  _id: string;
  name: string;
  avatarUrl?: string;
}

export interface ApiReview {
  _id: string;
  product: string;
  user: ApiReviewUser | null;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewsResponse {
  status: string;
  data: { reviews: ApiReview[]; count: number; averageRating: number };
}

export const reviewsAPI = {
  getProductReviews: async (productId: string): Promise<ProductReviewsResponse> => {
    const response = await apiClient.get(`/api/products/${productId}/reviews`);
    return response.data;
  },

  createReview: async (productId: string, body: { rating: number; text: string }) => {
    const response = await apiClient.post(`/api/products/${productId}/reviews`, body);
    return response.data;
  },
};

// Backend reviews carry rating + text + author; the detail screens' ReviewCard
// wants { author, initial, initialBg, title, body, daysAgo }. Map between them
// here so both surfaces stay identical. No product title — reviews are text-only.
const AVATAR_COLORS = ['#fde68a', '#bfdbfe', '#fecaca', '#bbf7d0', '#ddd6fe', '#fbcfe8'];

export interface UiReview {
  _id: string;
  author: string;
  initial: string;
  initialBg: string;
  rating: number;
  title: string;
  body: string;
  daysAgo?: number;
}

export function toUiReview(r: ApiReview): UiReview {
  const name = r.user?.name?.trim() || 'User';
  const initial = name.charAt(0).toUpperCase() || 'U';
  const initialBg = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86_400_000),
  );
  return {
    _id: r._id,
    author: name,
    initial,
    initialBg,
    rating: r.rating,
    title: '',
    body: r.text,
    daysAgo,
  };
}
