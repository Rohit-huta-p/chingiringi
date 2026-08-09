import * as cloudflare from './cloudflareStream.js';
import * as mux from './muxVideo.js';

// VIDEO_PROVIDER selects the active video host. Read LAZILY (at call time) — not
// as a module-load constant — because ESM evaluates imports before the importing
// module's body, so this file is imported (via routes → controller) BEFORE app.js
// runs dotenv.config(). A load-time read would freeze to 'cloudflare' before the
// .env is loaded. Reading per-call guarantees the env is available.
const impls = { cloudflare, mux };

export function activeProvider() {
  return (process.env.VIDEO_PROVIDER || 'cloudflare').trim().toLowerCase();
}

export function videoProvider() {
  return impls[activeProvider()] || cloudflare;
}
