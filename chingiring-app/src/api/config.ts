/**
 * api/config.ts — public runtime config (feature pause-switches).
 *
 * GET /api/config tells the app which paid-media features are paused so it can
 * proactively disable Go Live / upload before a user taps. The server gate in
 * the controllers stays the hard backstop; this is just the heads-up.
 */
import apiClient from './client';

export interface FeatureFlag {
  disabled: boolean;
  /** Staff-facing "upgrade the <provider> plan" line (shown on create screens); '' when enabled. */
  message: string;
}

export interface FeatureFlags {
  /** Uploaded videos (VOD) — powered by the active VIDEO_PROVIDER (Cloudflare/Mux). */
  videoUploads: FeatureFlag;
  /** Live streaming — always Mux. */
  live: FeatureFlag;
}

export const configAPI = {
  async getFeatures(): Promise<FeatureFlags> {
    const res = await apiClient.get('/api/config');
    // Backend shape is { status, data: { features } } and the interceptor returns
    // the FULL response, so features live at res.data.data.features — not res.data
    // (that's the wrapper). See api-response-shape-wrapper.
    return (res.data?.data?.features ?? res.data?.features) as FeatureFlags;
  },
};
