import { istDayBucket } from '../shares/shareService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Signed percent change to 1 dp. null when prev is 0/absent (no baseline).
export function pctDelta(curr, prev) {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

// IST day-string boundaries. "last 30d" = day >= start30 (30 days incl today);
// "prior 30d" = start60 <= day < start30.
export function dayWindows(now = new Date()) {
  return {
    today: istDayBucket(now),
    yesterday: istDayBucket(new Date(now.getTime() - DAY_MS)),
    start30: istDayBucket(new Date(now.getTime() - 29 * DAY_MS)),
    start60: istDayBucket(new Date(now.getTime() - 59 * DAY_MS)),
  };
}

function labelFor(d) {
  const [, m, day] = istDayBucket(d).split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
}

// count IST day-strings, oldest→newest, ending today.
export function trendDays(now = new Date(), count = 30) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    out.push({ day: istDayBucket(d), label: labelFor(d) });
  }
  return out;
}

// Merge [{_id: day, shares}] onto the skeleton, 0-filling missing days.
export function fillTrend(days, rows) {
  const by = new Map(rows.map((r) => [r._id, r.shares]));
  return days.map((d) => ({ label: d.label, shares: by.get(d.day) || 0 }));
}
