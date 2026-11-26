import { activeProvider } from './videoProvider.js';

// Feature kill-switches for the paid media providers. When a provider's plan
// lapses (isn't recharged), flip the matching env flag to `true` and that
// feature refuses GRACEFULLY — the client gets a clear "please upgrade the
// <provider> plan to continue" message instead of a raw provider/network error.
//
// Which provider powers which feature:
//   • Uploaded videos (VOD)  → the active VIDEO_PROVIDER (Cloudflare today, or Mux)
//   • Live streaming          → always Mux (RTMP ingest → HLS)
// so the video message names activeProvider() and the live message names Mux.
//
// Flags are read LAZILY (per call), NOT as module-load constants — same reason
// as videoProvider.js: these modules are imported (routes → controller) BEFORE
// app.js runs dotenv.config(), so a load-time read would freeze to the
// pre-dotenv value. Reading per call guarantees the .env is loaded.
//
// Unset / empty / false  = feature enabled (normal operation).

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const isOn = (v) => TRUTHY.has(String(v ?? '').trim().toLowerCase());

const PROVIDER_LABEL = { cloudflare: 'Cloudflare', mux: 'Mux' };
const label = (p) => PROVIDER_LABEL[p] || (p ? p[0].toUpperCase() + p.slice(1) : 'video');

// ── Uploaded videos (VOD) ────────────────────────────────────────────────────
export const videoUploadsDisabled = () => isOn(process.env.VIDEO_UPLOADS_DISABLED);
export const videoUploadsGateMessage = () =>
  `Video uploads are paused — please upgrade the ${label(activeProvider())} plan to continue.`;

// ── Live streaming (always Mux) ──────────────────────────────────────────────
export const liveDisabled = () => isOn(process.env.LIVE_STREAMING_DISABLED);
export const liveGateMessage = () =>
  'Going live is paused — please upgrade the Mux plan to continue.';

// Single source of truth for the public /api/config endpoint AND the controller
// gates — so what the app reads up front always matches what the server enforces.
// `message` is the staff-facing upgrade line (shown on the seller/admin create
// screens); it's '' when enabled. Buyer surfaces show their own friendly copy.
export function featureStatus() {
  const uploads = videoUploadsDisabled();
  const live = liveDisabled();
  return {
    videoUploads: { disabled: uploads, message: uploads ? videoUploadsGateMessage() : '' },
    live:         { disabled: live, message: live ? liveGateMessage() : '' },
  };
}
