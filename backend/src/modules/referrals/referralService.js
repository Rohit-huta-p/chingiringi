// Pure helpers — no DB, no req/res. Everything decidable about a referral.

export const APPLY_WINDOW_MS = 48 * 60 * 60 * 1000; // ponytail: retro-apply guard; widen if support asks

// Which store/page a not-installed visitor should land on, by device UA.
export function pickStoreUrl(ua, { ios, android, web }) {
  const s = String(ua || '');
  if (/iphone|ipad|ipod/i.test(s)) return ios;
  if (/android/i.test(s)) return android;
  return web;
}

// Can this code be captured onto this new user? (guards, not I/O)
export function canApplyReferral({ referrerId, refereeId, refereeReferredBy, refereeCreatedAtMs, nowMs, windowMs = APPLY_WINDOW_MS }) {
  if (!referrerId) return { ok: false, reason: 'invalid_code' };
  if (String(referrerId) === String(refereeId)) return { ok: false, reason: 'self' };
  if (refereeReferredBy) return { ok: false, reason: 'already_referred' };
  if (nowMs - refereeCreatedAtMs > windowMs) return { ok: false, reason: 'too_old' };
  return { ok: true, reason: 'ok' };
}

// Should a claim confirm+pay this referee's referral right now?
export function referralConfirmDecision({ status, refereeCreatedAtMs, nowMs, lockDays = 30 }) {
  if (status !== 'pending') return { confirm: false, reason: 'not_pending' };
  if (nowMs - refereeCreatedAtMs > lockDays * 24 * 60 * 60 * 1000) return { confirm: false, reason: 'expired' };
  return { confirm: true, reason: 'ok' };
}
