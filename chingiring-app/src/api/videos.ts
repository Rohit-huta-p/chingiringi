import apiClient from './client';

// Products are entered inline per video (not linked to the products catalog).
export interface TaggedProduct {
  title: string;
  description?: string;
  price: number;
  url?: string; // optional buy link — tapping the card opens it
}

// Store is free-text per video (not linked to the offline-stores list).
export interface VideoStore {
  name: string;
  logoUrl?: string;
  /** Optional store website — the store name links here, and it's shown at the caption end. */
  website?: string;
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
  stats: { views: number; likes: number; shares: number; saves: number; comments?: number };
  publishedAt: string;
  /** True when the signed-in user has already liked this clip (feed is optional-auth). */
  likedByMe?: boolean;
  /** Owner (admin OR user) + moderation state — present on admin/mine reads. */
  createdBy?: string;
  /** Set only on admin-posted clips (legacy clips have this but no `createdBy`). */
  createdByAdmin?: string;
  creatorRole?: 'admin' | 'user';
  moderation?: { state: 'pending' | 'approved' | 'rejected'; reason?: string };
}

export interface FeedPage {
  status: string;
  data: { videos: FeedVideo[]; nextCursor: string | null };
}

export interface VideoComment {
  _id: string;
  text: string;
  createdAt: string;
  user?: { _id: string; name?: string; username?: string; avatarUrl?: string };
  /** True when the comment belongs to the signed-in user (server-computed). */
  mine?: boolean;
}

export interface CommentsPage {
  status: string;
  data: { comments: VideoComment[]; nextCursor: string | null };
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

  // ── comments (flat) ────────────────────────────────────────────────────
  listComments: async (videoId: string, params?: { cursor?: string; limit?: number }) => {
    const res = await apiClient.get(`/api/videos/${videoId}/comments`, { params });
    return res.data as CommentsPage;
  },
  addComment: async (videoId: string, text: string) => {
    const res = await apiClient.post(`/api/videos/${videoId}/comments`, { text });
    return res.data as { status: string; data: { comment: VideoComment } };
  },
  deleteComment: async (commentId: string) => {
    const res = await apiClient.delete(`/api/videos/comments/${commentId}`);
    return res.data as { status: string; data: { deleted: boolean } };
  },

  // ── admin authoring (protect + admin) ──────────────────────────────────
  /** Mint a one-time direct-upload URL (Cloudflare = POST form, Mux = PUT raw). */
  createUploadUrl: async (storeName?: string) => {
    const res = await apiClient.post('/api/videos/upload-url', { storeName });
    return res.data as {
      status: string;
      data: { streamUid: string; uploadURL: string; uploadMethod: 'POST' | 'PUT'; provider: string };
    };
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
  /** All posted videos for admin management (every status, newest first). */
  adminListAll: async () => {
    const res = await apiClient.get('/api/videos/admin/all');
    return res.data as { status: string; data: { videos: FeedVideo[] } };
  },
  /** The signed-in user's own posted clips (any status). */
  getMine: async () => {
    const res = await apiClient.get('/api/videos/mine');
    return res.data as { status: string; data: { videos: FeedVideo[] } };
  },
  /** Admin: approve / reject a clip in the moderation queue. */
  moderate: async (id: string, action: 'approve' | 'reject', reason?: string) => {
    const res = await apiClient.patch(`/api/videos/admin/${id}`, { action, reason });
    return res.data as { status: string; data: { video: FeedVideo } };
  },
  /** Delete a video (admin) — removes the provider asset + the record. */
  adminDelete: async (id: string) => {
    const res = await apiClient.delete(`/api/videos/${id}`);
    return res.data as { status: string; data: { deleted: boolean } };
  },
  /** Edit a clip's metadata (store / caption / products / cta) — not the file. */
  adminUpdate: async (id: string, payload: {
    store?: VideoStore;
    caption?: string;
    taggedProducts?: TaggedProduct[];
    cta?: { type: 'shop' | 'store' | 'none'; url?: string };
  }) => {
    const res = await apiClient.patch(`/api/videos/${id}`, payload);
    return res.data as { status: string; data: { video: FeedVideo } };
  },
};
