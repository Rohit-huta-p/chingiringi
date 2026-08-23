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
