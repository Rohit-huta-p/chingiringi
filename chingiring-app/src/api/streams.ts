/**
 * api/streams.ts — Frontend streaming endpoints.
 *
 * Owned by the Streaming track (screens/Live/, hooks/).
 */
import apiClient from './client';

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
