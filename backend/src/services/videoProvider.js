import * as cloudflare from './cloudflareStream.js';
import * as mux from './muxVideo.js';

// VIDEO_PROVIDER selects the active video host. Both services expose the same
// interface: createDirectUpload, verifyWebhook, parseWebhook, pollStatus, deleteAsset.
const impls = { cloudflare, mux };

export const PROVIDER = (process.env.VIDEO_PROVIDER || 'cloudflare').toLowerCase();

export function videoProvider() {
  return impls[PROVIDER] || cloudflare;
}
