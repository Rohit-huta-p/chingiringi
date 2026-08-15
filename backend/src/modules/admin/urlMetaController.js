// Best-effort OpenGraph scraper so the admin can prefill a product from its buy
// link (image + title + price) instead of uploading. Many sites — Amazon in
// particular — block server-side fetches or omit og tags; when that happens we
// return empty fields and the admin falls back to manual upload. Admin-only.

import { merchantFromUrl } from '../../utils/merchant.js';

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

// schema.org/Product JSON-LD — walk arrays and @graph to collect every Product
// node embedded on the page.
function collectProducts(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => collectProducts(n, out)); return; }
  const t = node['@type'];
  if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) out.push(node);
  if (node['@graph']) collectProducts(node['@graph'], out);
}

// Pull the best Product node out of all <script type="application/ld+json">
// blocks. Prefer one that carries offers (so we get a price). Modern stores
// (Shopify, Myntra, Flipkart, most non-Amazon) ship this — it's far richer than
// OG tags. Bad/partial JSON blocks are skipped, not fatal.
function extractJsonLdProduct(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const found = [];
  let m;
  while ((m = re.exec(html))) {
    try { collectProducts(JSON.parse(m[1].trim()), found); } catch { /* skip bad block */ }
  }
  return found.find((p) => p.offers) || found[0] || null;
}

// JSON-LD `image` may be a string, an array of strings, or an ImageObject with
// a .url. Normalise to a capped list of URL strings.
function normalizeImages(img) {
  let arr = [];
  if (typeof img === 'string') arr = [img];
  else if (Array.isArray(img)) arr = img.map((x) => (typeof x === 'string' ? x : x?.url)).filter(Boolean);
  else if (img && typeof img === 'object' && typeof img.url === 'string') arr = [img.url];
  return arr.slice(0, 8);
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

  // The store, derived from the domain — reliable even if the page scrape below
  // is blocked, so it's returned on every path.
  const merchant = merchantFromUrl(url);

  let html = '';
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      return res.json({ status: 'success', data: { image: '', title: '', price: null, merchant, description: '', blocked: resp.status } });
    }
    // Only read the head-ish portion — og tags live near the top and this keeps
    // a huge product page from blowing up memory.
    html = (await resp.text()).slice(0, 500_000);
  } catch (e) {
    return res.json({ status: 'success', data: { image: '', title: '', price: null, merchant, description: '', error: 'fetch_failed' } });
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
  const ogPrice = priceStr && Number.isFinite(Number(priceStr)) ? Number(priceStr) : null;

  // Structured data wins where present; OG fills anything it omits.
  const ld = extractJsonLdProduct(html);
  let images = [];
  let mrp = null;
  let rating = null;
  let ratingCount = null;
  let ldTitle = '';
  let ldPrice = null;
  let description = '';
  if (ld) {
    if (typeof ld.name === 'string') ldTitle = ld.name.trim();
    if (typeof ld.description === 'string') description = ld.description.trim();
    images = normalizeImages(ld.image);
    const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    if (offer) {
      const p = Number(offer.price ?? offer.lowPrice);
      if (Number.isFinite(p) && p > 0) ldPrice = p;
      const hi = Number(offer.highPrice);
      if (Number.isFinite(hi) && ldPrice != null && hi > ldPrice) mrp = hi;
    }
    const ar = ld.aggregateRating;
    if (ar) {
      const rv = Number(ar.ratingValue);
      if (Number.isFinite(rv)) rating = Math.max(0, Math.min(5, rv));
      const rc = Number(ar.reviewCount ?? ar.ratingCount);
      if (Number.isFinite(rc) && rc >= 0) ratingCount = Math.round(rc);
    }
  }

  // Description: JSON-LD first, then OG / meta description. Whitespace-collapsed
  // and capped so the form isn't flooded with a giant blob.
  if (!description) {
    description = decodeEntities(firstMatch(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]));
  }
  description = description.replace(/\s+/g, ' ').trim().slice(0, 600);

  res.json({
    status: 'success',
    data: {
      image: images[0] || image || '',
      images: images.length ? images : image ? [image] : [],
      title: (ldTitle && decodeEntities(ldTitle)) || title || '',
      description,
      price: ldPrice ?? ogPrice,
      mrp,
      rating,
      ratingCount,
      merchant,
      source: ld ? 'jsonld' : 'og',
    },
  });
};
