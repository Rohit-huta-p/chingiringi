import apiClient from './client';

// Products are entered inline per video (not linked to the products catalog).
export interface TaggedProduct {
  title: string;
  description?: string;
  price: number;
}

// Store is free-text per video (not linked to the offline-stores list).
export interface VideoStore {
  name: string;
  logoUrl?: string;
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

  // ── admin authoring (protect + admin) ──────────────────────────────────
  /** Mint a one-time Cloudflare Stream direct-upload URL. */
  createUploadUrl: async (storeName?: string) => {
    const res = await apiClient.post('/api/videos/upload-url', { storeName });
    return res.data as { status: string; data: { streamUid: string; uploadURL: string } };
  },
  /** Save video metadata after the file is uploaded to Cloudflare. */
  createVideo: async (payload: {
    streamUid: string;
    store: VideoStore;
    caption?: string;
    taggedProducts?: TaggedProduct[];
    cta?: { type: 'shop' | 'store' | 'none'; url?: string };
  }) => {
    const res = await apiClient.post('/api/videos', payload);
    return res.data as { status: string; data: { video: FeedVideo } };
  },
};
