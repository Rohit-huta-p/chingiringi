// Best-effort OpenGraph scraper so the admin can prefill a product from its buy
// link (image + title + price) instead of uploading. Many sites — Amazon in
// particular — block server-side fetches or omit og tags; when that happens we
// return empty fields and the admin falls back to manual upload. Admin-only.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Block obvious internal / metadata targets (SSRF guard). This endpoint is
// admin-only, but never let it be pointed at the loopback / link-local / RFC1918
// ranges or non-http schemes.
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '169.254.169.254' || h.startsWith('169.254.')) return true; // cloud metadata / link-local
  if (h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true; // 172.16.0.0/12
  return false;
}

function firstMatch(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x2F;/gi, '/');
}

// POST /api/admin/fetch-url-meta  { url } → { image, title, price, blocked? }
export const fetchUrlMeta = async (req, res) => {
  const url = (req.body?.url || '').trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400);
    throw new Error('A valid http(s) URL is required.');
  }
  if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    res.status(400);
    throw new Error('That URL is not allowed.');
  }

  let html = '';
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      return res.json({ status: 'success', data: { image: '', title: '', price: null, blocked: resp.status } });
    }
    // Only read the head-ish portion — og tags live near the top and this keeps
    // a huge product page from blowing up memory.
    html = (await resp.text()).slice(0, 250_000);
  } catch (e) {
    return res.json({ status: 'success', data: { image: '', title: '', price: null, error: 'fetch_failed' } });
  }

  const image = decodeEntities(firstMatch(html, [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]));
  const title = decodeEntities(firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]));
  const priceStr = firstMatch(html, [
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const price = priceStr && Number.isFinite(Number(priceStr)) ? Number(priceStr) : null;

  res.json({ status: 'success', data: { image, title, price } });
};
