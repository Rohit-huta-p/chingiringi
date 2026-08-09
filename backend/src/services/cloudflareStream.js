import crypto from 'crypto';

const API = 'https://api.cloudflare.com/client/v4';
const acct = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const authHeader = () => ({ Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}` });

/** Create a one-time direct-upload URL. Client POSTs the video file to uploadURL. */
export async function createDirectUpload({ maxDurationSeconds = 120, meta = {} } = {}) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/direct_upload`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDurationSeconds, requireSignedURLs: false, meta }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Cloudflare direct_upload failed: ${JSON.stringify(json.errors || json)}`);
  }
  return { uid: json.result.uid, uploadURL: json.result.uploadURL, uploadMethod: 'POST' };
}

export async function deleteStreamVideo(uid) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/${uid}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  return res.ok;
}

/** Poll a video's status (used by the reconcile cron when a webhook is missed). */
export async function fetchStreamStatus(uid) {
  const res = await fetch(`${API}/accounts/${acct()}/stream/${uid}`, { headers: authHeader() });
  const json = await res.json();
  if (!res.ok || !json.success) return null;
  const r = json.result;
  return {
    state: r.status?.state,
    readyToStream: r.readyToStream,
    hls: r.playback?.hls,
    thumbnail: r.thumbnail,
    duration: r.duration,
  };
}

/**
 * Verify a Cloudflare Stream webhook. Header format:
 *   Webhook-Signature: time=1699999999,sig1=<hex hmac-sha256 of `time.body`>
 * Pure function — no network. Uses timing-safe comparison.
 */
export function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    String(signatureHeader).split(',').map((kv) => kv.split('=').map((s) => s.trim())),
  );
  const { time, sig1 } = parts;
  if (!time || !sig1) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(`${time}.${body}`).digest('hex');
  if (expected.length !== sig1.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig1));
  } catch {
    return false;
  }
}

// ── Unified provider interface (shared shape with muxVideo.js) ───────────────
export const name = 'cloudflare';

/** Verify using the env secret + the Cloudflare header. */
export function verifyWebhook(rawBody, headers = {}) {
  return verifyWebhookSignature(rawBody, headers['webhook-signature'], process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET);
}

/** Normalize a Cloudflare webhook → { matchUid, assetId, state, hlsUrl, thumbnailUrl, durationSec } | null. */
export function parseWebhook(payload) {
  const state = payload?.status?.state;
  const norm = (state === 'ready' || payload?.readyToStream) ? 'ready' : state === 'error' ? 'error' : 'other';
  if (norm === 'other') return null;
  return {
    matchUid: payload.uid,
    assetId: payload.uid,
    state: norm,
    hlsUrl: payload.playback?.hls || '',
    thumbnailUrl: payload.thumbnail || '',
    durationSec: Math.round(payload.duration || 0),
  };
}

/** Reconcile poll for a stored video (Cloudflare's asset id === streamUid). */
export async function pollStatus(video) {
  const s = await fetchStreamStatus(video.streamUid);
  if (!s) return null;
  return {
    state: (s.state === 'ready' || s.readyToStream) ? 'ready' : s.state === 'error' ? 'error' : 'processing',
    assetId: video.streamUid,
    hlsUrl: s.hls || '',
    thumbnailUrl: s.thumbnail || '',
    durationSec: Math.round(s.duration || 0),
  };
}

/** Best-effort delete (Cloudflare deletes by the stream uid). */
export async function deleteAsset(video) {
  return deleteStreamVideo(video.streamUid);
}
