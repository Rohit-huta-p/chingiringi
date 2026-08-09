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
