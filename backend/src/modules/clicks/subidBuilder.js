/**
 * Merchant-aware subid URL rewriter.
 *
 * Every affiliate program lets publishers attach a custom string to each click
 * that gets echoed back in conversion reports — that's how you tell which user
 * caused the sale. The PARAM NAME differs per merchant: Amazon uses
 * `ascsubtag`, Cuelinks uses `subid`, Admitad uses `subid1`, Myntra historically
 * uses `sgid`, and so on. This module abstracts that detail away.
 *
 * To support a new merchant: add its host pattern to detectMerchant and its
 * subid param name to MERCHANT_SUBID_PARAM. Nothing else changes.
 */

export function detectMerchant(url) {
  if (!url) return 'unknown';
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('amazon'))   return 'amazon';
    if (host.includes('myntra'))   return 'myntra';
    if (host.includes('flipkart')) return 'flipkart';
    if (host.includes('meesho'))   return 'meesho';
    if (host.includes('ajio'))     return 'ajio';
    if (host.includes('nykaa'))    return 'nykaa';
    if (host.includes('cuelinks')) return 'cuelinks';
    if (host.includes('admitad'))  return 'admitad';
    if (host.includes('earnkaro')) return 'earnkaro';
    return host.split('.')[0]; // fallback: first domain segment
  } catch {
    return 'unknown';
  }
}

// Each merchant's custom subid param. Add new merchants here as you onboard
// them; the default 'subid' is a safe fallback that most networks honor.
const MERCHANT_SUBID_PARAM = {
  amazon:   'ascsubtag', // Amazon Associates custom tracking ID
  cuelinks: 'subid',
  admitad:  'subid1',
  flipkart: 'subid',
  myntra:   'sgid',
  meesho:   'subid',
  ajio:     'subid',
  nykaa:    'subid',
  earnkaro: 'subid',
};

/**
 * Append a subid to the affiliate URL using the merchant's preferred param name.
 *
 * @param url      raw affiliate URL stored in admin
 * @param subid    string to attribute the click to (e.g. "cr_<userId>")
 * @param merchant detected merchant name (use detectMerchant if unsure)
 * @returns rewritten URL with subid appended; original url on parse failure
 */
export function appendSubid(url, subid, merchant) {
  if (!url || !subid) return url;
  const param = MERCHANT_SUBID_PARAM[merchant] || 'subid';
  try {
    const u = new URL(url);
    u.searchParams.set(param, subid);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${param}=${encodeURIComponent(subid)}`;
  }
}

/**
 * Amazon URL prep — append our associate tag before subid rewrite. Amazon
 * requires the tag to attribute the sale; the ascsubtag identifies the user.
 * Skip if the URL already has a tag (respect explicit admin override).
 */
export function ensureAmazonTag(url, associateTag) {
  if (!url || !associateTag) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has('tag')) return url; // don't overwrite an explicit tag
    u.searchParams.set('tag', associateTag);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}tag=${encodeURIComponent(associateTag)}`;
  }
}

/**
 * Cuelinks wrapping — turn a raw merchant URL into a linksredirect.com URL
 * that Cuelinks routes through. Called at click time when Deal.viaCuelinks
 * is set, so the admin just pastes the raw Myntra/Flipkart/etc URL and we
 * handle the Cuelinks plumbing per-click.
 *
 * Format:
 *   https://linksredirect.com/?cid=<publisherId>&source=linkkit&url=<encoded>
 */
export function wrapCuelinks(rawUrl, publisherId) {
  if (!rawUrl || !publisherId) return rawUrl;
  const encoded = encodeURIComponent(rawUrl);
  return `https://linksredirect.com/?cid=${encodeURIComponent(publisherId)}&source=linkkit&url=${encoded}`;
}

// ── Merchant search URL builders ──────────────────────────────────────────────
// Called server-side at click time for search-fallback chips. The app sends
// { merchant, searchQuery } and the server builds the URL here so a merchant
// URL format change is a backend deploy, not an app store release.

function myntraSlug(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')   // strip punctuation
    .replace(/\s+/g, '-')          // spaces → hyphens
    .trim();
}

const MERCHANT_SEARCH_BUILDERS = {
  amazon:   (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  myntra:   (q) => `https://www.myntra.com/${myntraSlug(q)}?rawQuery=${encodeURIComponent(q)}`,
  meesho:   (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
};

/**
 * Build the search-results URL for a merchant given a query string.
 * Returns null for unknown merchants — caller should 400.
 */
export function buildMerchantSearchUrl(merchant, searchQuery) {
  const builder = MERCHANT_SEARCH_BUILDERS[merchant];
  if (!builder) return null;
  return builder(searchQuery.trim());
}
