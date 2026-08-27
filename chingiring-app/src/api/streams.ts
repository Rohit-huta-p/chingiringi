/**
 * api/streams.ts — Frontend streaming endpoints.
 *
 * Owned by the Streaming track (screens/Live/, hooks/).
 */
import apiClient from './client';

// ── Create stream ──────────────────────────────────────────────────────────

export interface CreateStreamRequest {
  title: string;
  storeId?: string;
  category?: string;
  /** Product ids to feature on the stream — surfaced to viewers via getStream(). */
  productIds?: string[];
}

export interface CreateStreamResponse {
  /** MongoDB _id of the new Stream document */
  streamId: string;
  /** Daily.co broadcaster token */
  broadcasterToken: string;
  /** Daily.co room URL — pass to DailyCall.join() */
  roomUrl: string;
}

/**
 * POST /api/streams
 * Creates a Daily.co room, saves a Stream doc, returns broadcaster credentials.
 * Called from GoLiveModal when the seller taps "Start Streaming".
 */
export async function createStream(
  payload: CreateStreamRequest,
): Promise<CreateStreamResponse> {
  const res = await apiClient.post<CreateStreamResponse>('/api/streams', payload);
  return res.data;
}

// ── End stream ─────────────────────────────────────────────────────────────

/**
 * POST /api/streams/:id/end
 * Marks the stream as ended and emits stream_ended to all viewers.
 * Called from BroadcasterScreen when the seller taps "End Stream".
 */
export async function endStream(streamId: string): Promise<void> {
  await apiClient.post(`/api/streams/${streamId}/end`);
}

// ── Viewer token ───────────────────────────────────────────────────────────

export interface ViewerTokenResponse {
  viewerToken: string;
  roomUrl: string;
}

/**
 * POST /api/streams/:id/viewer-token
 * Returns a Daily.co viewer token for an active stream.
 * Called on mount in ViewerScreen before joining the Daily.co call.
 */
export async function getViewerToken(streamId: string): Promise<ViewerTokenResponse> {
  const res = await apiClient.post<ViewerTokenResponse>(`/api/streams/${streamId}/viewer-token`);
  return res.data;
}

// ── Stream detail (store + featured products) ──────────────────────────────

export interface StreamProductLite {
  _id: string;
  name: string;
  price: number;
  mrp?: number;
  imageUrl?: string;
  images?: string[];
}

export interface StreamStoreLite {
  _id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
}

export interface StreamDetail {
  _id: string;
  title: string;
  status: 'idle' | 'live' | 'ended';
  viewerCount: number;
  storeId: StreamStoreLite | string;
  products: StreamProductLite[];
}

/**
 * GET /api/streams/:id
 * Public. Used by ViewerScreen to render the store header (tap → store
 * profile) and the Featured Products bar. Best-effort — a failure just means
 * those two pieces stay hidden; the video/chat/hearts still work.
 */
export async function getStream(streamId: string): Promise<StreamDetail | null> {
  try {
    const res = await apiClient.get(`/api/streams/${streamId}`);
    return res.data?.data?.stream ?? res.data?.stream ?? null;
  } catch {
    return null;
  }
}

// ── My streams (history) ────────────────────────────────────────────────────

export interface StreamSummary {
  _id: string;
  title: string;
  status: 'idle' | 'live' | 'ended';
  viewerCount: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  storeId?: StreamStoreLite | string;
}

/**
 * GET /api/streams/mine
 * Authenticated — the seller's own streams (live + ended), newest first.
 * Powers the Dashboard "Recent Streams" and Go Live "Previous streams".
 * Best-effort — a failure just yields an empty list (the empty state shows).
 */
export async function getMyStreams(limit = 20): Promise<StreamSummary[]> {
  try {
    const res = await apiClient.get('/api/streams/mine', { params: { limit } });
    return res.data?.data?.streams ?? res.data?.streams ?? [];
  } catch {
    return [];
  }
}

/** Compact "21 Aug · 340 watched · 18:42" line for a past stream. */
export function formatStreamMeta(s: StreamSummary): string {
  const parts: string[] = [];
  const when = s.startedAt || s.createdAt;
  if (when) parts.push(new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  if (s.status === 'live') {
    parts.push('LIVE now');
  } else {
    if (typeof s.viewerCount === 'number') parts.push(`${s.viewerCount.toLocaleString('en-IN')} watched`);
    if (s.startedAt && s.endedAt) {
      const secs = Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000));
      parts.push(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    }
  }
  return parts.join(' · ');
}
