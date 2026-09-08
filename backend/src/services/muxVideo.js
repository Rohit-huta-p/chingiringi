import crypto from 'crypto';

// Mux Video provider. Same interface as cloudflareStream.js so the controller
// can dispatch to either behind the VIDEO_PROVIDER flag.
const API = 'https://api.mux.com';
const authHeader = () =>
  'Basic ' + Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString('base64');
const hls = (pid) => `https://stream.mux.com/${pid}.m3u8`;
const thumb = (pid) => `https://image.mux.com/${pid}/thumbnail.jpg`;

export const name = 'mux';

/** Create a direct upload. The client PUTs the raw file bytes to uploadURL. */
export async function createDirectUpload({ meta = {} } = {}) {
  const res = await fetch(`${API}/video/v1/uploads`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cors_origin: '*',
      new_asset_settings: { playback_policy: ['public'], video_quality: 'basic' },
      passthrough: (meta && meta.storeName) ? String(meta.storeName).slice(0, 255) : undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.data) {
    throw new Error(`Mux create upload failed: ${JSON.stringify(json.error || json)}`);
  }
  // The upload id is what the asset webhook references (data.upload_id).
  return { uid: json.data.id, uploadURL: json.data.url, uploadMethod: 'PUT' };
}

/**
 * Verify a Mux webhook. Header `Mux-Signature: t=<unix>,v1=<hex hmac-sha256 of `t.body`>`.
 * Reads the secret from env. Pure crypto, timing-safe.
 */
export function verifyWebhook(rawBody, headers = {}) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  const header = headers['mux-signature'];
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    String(header).split(',').map((kv) => kv.split('=').map((s) => s.trim())),
  );
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  if (expected.length !== v1.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

/** Normalize a Mux webhook → { matchUid, assetId, state, hlsUrl, thumbnailUrl, durationSec } | null. */
export function parseWebhook(payload) {
  const d = payload?.data || {};
  if (payload?.type === 'video.asset.ready') {
    const pid = d.playback_ids?.[0]?.id;
    return {
      matchUid: d.upload_id,          // correlates to the streamUid we stored at create
      assetId: d.id,
      state: 'ready',
      hlsUrl: pid ? hls(pid) : '',
      thumbnailUrl: pid ? thumb(pid) : '',
      durationSec: Math.round(d.duration || 0),
    };
  }
  if (payload?.type === 'video.asset.errored') {
    return { matchUid: d.upload_id, assetId: d.id, state: 'error' };
  }
  return null; // ignore other event types
}

/** Reconcile poll: upload id → asset id → status. */
export async function pollStatus(video) {
  let assetId = video.providerAssetId;
  if (!assetId) {
    const up = await fetch(`${API}/video/v1/uploads/${video.streamUid}`, { headers: { Authorization: authHeader() } });
    const uj = await up.json().catch(() => ({}));
    assetId = uj.data?.asset_id;
    if (!assetId) return null; // asset not created yet
  }
  const res = await fetch(`${API}/video/v1/assets/${assetId}`, { headers: { Authorization: authHeader() } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data) return null;
  const d = json.data;
  const pid = d.playback_ids?.[0]?.id;
  return {
    state: d.status === 'ready' ? 'ready' : d.status === 'errored' ? 'error' : 'processing',
    assetId,
    hlsUrl: pid ? hls(pid) : '',
    thumbnailUrl: pid ? thumb(pid) : '',
    durationSec: Math.round(d.duration || 0),
  };
}

/** Best-effort delete of the Mux asset. */
export async function deleteAsset(video) {
  const assetId = video.providerAssetId;
  if (!assetId) return false;
  const res = await fetch(`${API}/video/v1/assets/${assetId}`, { method: 'DELETE', headers: { Authorization: authHeader() } });
  return res.ok;
}

// ── Live streaming ───────────────────────────────────────────────────────────
// Broadcaster pushes RTMP(S) to `${MUX_RTMPS_URL}/${streamKey}`; viewers play the
// HLS URL built from the playback id. Same Basic auth as the VOD calls above.

export const MUX_RTMPS_URL = 'rtmps://global-live.mux.com:443/app';
export const MUX_RTMP_URL = 'rtmp://global-live.mux.com:5222/app';

/** HLS playback URL for a live stream's public playback id. */
export function livePlaybackUrl(playbackId) {
  return playbackId ? hls(playbackId) : '';
}

/**
 * Create a Mux live stream. Returns { id, streamKey, playbackId, rtmpsUrl }.
 * latencyMode 'low' ≈ 5s glass-to-glass — good for live shopping.
 */
export async function createLiveStream({ latencyMode = 'low', reconnectWindow = 60, passthrough } = {}) {
  const res = await fetch(`${API}/video/v1/live-streams`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
      latency_mode: latencyMode,
      reconnect_window: reconnectWindow,
      ...(passthrough ? { passthrough: String(passthrough).slice(0, 255) } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.data) {
    throw new Error(`Mux create live stream failed: ${JSON.stringify(json.error || json)}`);
  }
  const d = json.data;
  return {
    id:         d.id,
    streamKey:  d.stream_key,
    playbackId: d.playback_ids?.[0]?.id || '',
    rtmpsUrl:   MUX_RTMPS_URL,
  };
}

/** Signal a broadcast finished (finalizes the recording). Best-effort. */
export async function completeLiveStream(liveStreamId) {
  if (!liveStreamId) return false;
  const res = await fetch(`${API}/video/v1/live-streams/${liveStreamId}/complete`, {
    method: 'PUT',
    headers: { Authorization: authHeader() },
  });
  return res.ok;
}

/** Disable a live stream — stops accepting new RTMP connections. Best-effort. */
export async function disableLiveStream(liveStreamId) {
  if (!liveStreamId) return false;
  const res = await fetch(`${API}/video/v1/live-streams/${liveStreamId}/disable`, {
    method: 'POST',
    headers: { Authorization: authHeader() },
  });
  return res.ok;
}

/**
 * Normalize a Mux LIVE webhook → { muxStreamId, state } | null.
 * state: 'live' (active) · 'ended' (idle/disconnected) · 'connected'.
 * Wired in M3 to auto-flip stream status; helper ready now.
 */
/**
 * Current Mux live-stream status — the source of truth for whether ingest is
 * actually happening. Returns 'idle' | 'active' | 'connected' | 'disconnected' |
 * 'disabled', or null on error.
 */
export async function muxLiveStatus(liveStreamId) {
  try {
    const res = await fetch(`${API}/video/v1/live-streams/${liveStreamId}`, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.status ?? null;
  } catch {
    return null;
  }
}

export function parseLiveWebhook(payload) {
  const type = payload?.type;
  const id = payload?.data?.id;
  if (!id || typeof type !== 'string' || !type.startsWith('video.live_stream.')) return null;
  if (type === 'video.live_stream.active') return { muxStreamId: id, state: 'live' };
  // Only 'idle' (fires after the reconnect window elapses with no ingest) is a
  // real end. 'disconnected' can fire on a transient mid-stream blip, so it's
  // surfaced separately and NOT auto-ended on.
  if (type === 'video.live_stream.idle') return { muxStreamId: id, state: 'ended' };
  if (type === 'video.live_stream.disconnected') return { muxStreamId: id, state: 'disconnected' };
  if (type === 'video.live_stream.connected') return { muxStreamId: id, state: 'connected' };
  return null;
}
