// Derive the STORE a product is sold at (for the product page's "Available at …")
// from its buy-link URL. This is the reliable path: it's the hostname, not the
// page's schema.org `brand` (which is the manufacturer, e.g. "Sony" ≠ "Amazon"),
// and it works even when the page scrape is blocked. Known stores get a friendly
// name; anything else falls back to the capitalized second-level domain
// (someshop.com → "Someshop").

const KNOWN = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  shopsy: 'Shopsy',
  myntra: 'Myntra',
  ajio: 'AJIO',
  nykaa: 'Nykaa',
  meesho: 'Meesho',
  snapdeal: 'Snapdeal',
  tatacliq: 'Tata CLiQ',
  croma: 'Croma',
  reliancedigital: 'Reliance Digital',
  jiomart: 'JioMart',
  firstcry: 'FirstCry',
  boat: 'boAt',
  decathlon: 'Decathlon',
  ebay: 'eBay',
  walmart: 'Walmart',
  aliexpress: 'AliExpress',
};

// Second-level labels that are really part of the public suffix (co.in, com.au,
// co.uk…) — skip them so we land on the real brand label.
const SUFFIX_SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'ac']);

export function merchantFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length < 2) return '';
    let sld = parts[parts.length - 2];
    if (parts.length >= 3 && SUFFIX_SLD.has(sld)) sld = parts[parts.length - 3];
    if (!sld) return '';
    return KNOWN[sld] ?? sld.charAt(0).toUpperCase() + sld.slice(1);
  } catch {
    return '';
  }
}
