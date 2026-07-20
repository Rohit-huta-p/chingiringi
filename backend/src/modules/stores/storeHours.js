// Pure open-hours helpers — no DB, no external deps, fully unit-testable.

// "HH:mm" (24h) → minutes since midnight, or null if malformed.
export function parseTime(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// "HH:mm" (24h) → "h:mm AM/PM". Empty string if malformed.
export function formatTime(hhmm) {
  const mins = parseTime(hhmm);
  if (mins === null) return '';
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Open at `now`? openDays: array of 0–6 (Sun=0); empty = every day.
// Handles overnight windows where closeTime < openTime (e.g. 18:00–02:00).
export function isOpenNow(openTime, closeTime, openDays, now = new Date()) {
  const open = parseTime(openTime);
  const close = parseTime(closeTime);
  if (open === null || close === null) return false;

  const days = Array.isArray(openDays) ? openDays : [];
  if (days.length && !days.includes(now.getDay())) return false;

  const cur = now.getHours() * 60 + now.getMinutes();
  if (close > open) return cur >= open && cur < close; // same-day
  if (close < open) return cur >= open || cur < close; // overnight
  return true; // open === close → treat as 24h
}
