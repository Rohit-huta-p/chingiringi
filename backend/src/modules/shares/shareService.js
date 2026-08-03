// Pure daily-cap decision — no DB, no I/O. Dedup (once-per-item-per-day) is
// enforced separately by the ShareEvent unique index, not here.
export function evaluateShareQuota({ todayCount, maxSharesPerDay }) {
  if (todayCount >= maxSharesPerDay) {
    return { ok: false, code: 'DAILY_LIMIT', message: 'Daily share limit reached' };
  }
  return { ok: true };
}

// IST calendar-day bucket 'YYYY-MM-DD'. The daily cap resets at IST midnight.
// ponytail: fixed +5:30 offset, not a full tz lib — India-only app.
export function istDayBucket(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
