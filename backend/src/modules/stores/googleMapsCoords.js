// Parse { lat, lng } out of a pasted Google Maps link.
//
// Google's "Share → Copy link" usually gives a SHORT link (maps.app.goo.gl /
// goo.gl/maps) that carries no coordinates — it only redirects to the full URL
// that does. A browser can't read that redirect (CORS), so we resolve it here
// on the server: expand the short link, then pull coords out of the full URL.
//
// Full-URL coordinate forms we handle, in priority order:
//   .../data=...!3d12.97!4d77.59   ← the actual place marker (most accurate)
//   .../@12.97,77.59,17z           ← map centre
//   ?q=12.97,77.59 / ?ll= / ?destination= / ?daddr=
//   /search/12.97,+77.59

const SHORTENER_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

// Try every known coordinate pattern against a (already-expanded) URL string.
function parseCoordsFromUrl(url) {
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place marker
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // map centre
    /[?&](?:q|query|ll|sll|center|destination|daddr)=(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/,
    /\/search\/(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

function isValid(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    // reject the 0,0 "null island" that a bad parse tends to produce
    !(lat === 0 && lng === 0)
  );
}

function isShortLink(url) {
  try {
    return SHORTENER_HOSTS.includes(new URL(url).hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

// Follow the short link's redirect and return the final URL it lands on.
async function expandUrl(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return res.url || url; // res.url is the final URL after redirects
}

/**
 * @param {string} url  a Google Maps link (full or shortened)
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
export async function resolveGoogleMapsCoords(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const raw = url.trim();

  // Fast path: coordinates already in the pasted URL — no network call.
  const direct = parseCoordsFromUrl(raw);
  if (direct) return direct;

  // Otherwise, if it's a shortener, expand it and parse the destination.
  if (isShortLink(raw)) {
    try {
      const expanded = await expandUrl(raw);
      return parseCoordsFromUrl(expanded);
    } catch {
      return null; // network/redirect failure — caller keeps existing coords
    }
  }

  return null;
}

// ── self-check: node src/modules/stores/googleMapsCoords.js ──────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (name, cond) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  // full place URL with !3d/!4d marker → prefers the marker over the @centre
  const place = 'https://www.google.com/maps/place/Croma/@12.9,77.5,17z/data=!3m1!4b1!4m6!3d12.9716!4d77.5946';
  const p = parseCoordsFromUrl(place);
  assert('place !3d/!4d parsed', p && near(p.lat, 12.9716) && near(p.lng, 77.5946));

  // @centre only
  const at = parseCoordsFromUrl('https://www.google.com/maps/@19.0760,72.8777,15z');
  assert('@centre parsed', at && near(at.lat, 19.076) && near(at.lng, 72.8777));

  // ?q=lat,lng
  const q = parseCoordsFromUrl('https://maps.google.com/?q=28.6139,77.2090');
  assert('?q= parsed', q && near(q.lat, 28.6139) && near(q.lng, 77.209));

  // garbage / no coords
  assert('no-coords → null', parseCoordsFromUrl('https://maps.app.goo.gl/abc123') === null);
  // null island rejected
  assert('0,0 rejected', parseCoordsFromUrl('https://www.google.com/maps/@0,0,3z') === null);
  // out of range rejected
  assert('out-of-range rejected', parseCoordsFromUrl('https://www.google.com/maps/@999,999,3z') === null);
  assert('short link detected', isShortLink('https://maps.app.goo.gl/abc') === true);
  assert('full link not short', isShortLink('https://www.google.com/maps/@1,2,3z') === false);
}
