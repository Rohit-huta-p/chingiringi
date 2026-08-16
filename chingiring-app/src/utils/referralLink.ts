// Pure helper: pull a referral code out of a `?ref=<code>` URL — the shareable
// referral link (e.g. https://chingiringi.com/?ref=A1B2C3D4) or a native deep
// link (chingiring://signup?ref=A1B2C3D4). No React Native imports, so it stays
// runnable under `node --experimental-strip-types` (see referralLink.test.ts).
//
// The code is sanitised to [A-Z0-9] and capped — a referral code is uppercase
// hex, so anything else is noise (and never reaches HTML/JS downstream).
export function parseReferralCode(url?: string | null): string | null {
  if (!url) return null;
  const m = /[?&]ref=([^&#]+)/i.exec(url);
  if (!m) return null;
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* malformed escape — keep raw */ }
  const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  return code || null;
}
