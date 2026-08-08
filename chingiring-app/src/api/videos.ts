import apiClient from './client';

export interface TaggedProduct {
  _id: string;
  name: string;
  price: number;
  mrp?: number;
  images?: string[];
  slug?: string;
}

export interface VideoStore {
  _id: string;
  name: string;
  shortName: string;
  slug?: string;
  logoUrl?: string;
  isVerified?: boolean;
}

export interface FeedVideo {
  _id: string;
  store: VideoStore;
  streamUid: string;
  status: 'processing' | 'ready' | 'error' | 'flagged' | 'removed';
  hlsUrl: string;
  thumbnailUrl: string;
  durationSec: number;
  caption: string;
  hashtags: string[];
  taggedProducts: TaggedProduct[];
  cta: { type: 'shop' | 'store' | 'none'; productId?: string; url?: string };
  stats: { views: number; likes: number; shares: number; saves: number };
  publishedAt: string;
}

export interface FeedPage {
  status: string;
  data: { videos: FeedVideo[]; nextCursor: string | null };
}

export const videosAPI = {
  getFeed: async (params?: { cursor?: string; limit?: number }) => {
    const res = await apiClient.get('/api/videos/feed', { params });
    return res.data as FeedPage;
  },
  getVideo: async (id: string) => {
    const res = await apiClient.get(`/api/videos/${id}`);
    return res.data as { status: string; data: { video: FeedVideo } };
  },
  getStoreVideos: async (storeId: string) => {
    const res = await apiClient.get(`/api/videos/store/${storeId}`);
    return res.data as { status: string; data: { videos: FeedVideo[] } };
  },
  trackView: async (id: string, watchSec: number) => {
    const res = await apiClient.post(`/api/videos/${id}/view`, { watchSec });
    return res.data;
  },
  toggleLike: async (id: string) => (await apiClient.post(`/api/videos/${id}/like`)).data,
  toggleSave: async (id: string) => (await apiClient.post(`/api/videos/${id}/save`)).data,
  trackShare: async (id: string) => (await apiClient.post(`/api/videos/${id}/share`)).data,
};
