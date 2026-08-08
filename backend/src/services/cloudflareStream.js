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
  return { uid: json.result.uid, uploadURL: json.result.uploadURL };
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
