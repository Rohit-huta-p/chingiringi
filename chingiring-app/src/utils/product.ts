// Small pure helpers for the product detail page. Colocated (not a new lib) —
// shared by ProductDetailScreen (desktop) + MobileProductDetailScreen (mobile).

/** Discount % when MRP is above price; null when there's no real markdown. */
export function discountPct(mrp?: number, price?: number): number | null {
  if (!mrp || !price || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** Rupees saved vs MRP; null when there's no real markdown. */
export function savingsAmt(mrp?: number, price?: number): number | null {
  if (!mrp || !price || mrp <= price) return null;
  return mrp - price;
}

/**
 * Split the single `description` field into an About paragraph and Highlights
 * bullets — no separate schema field. Convention (admin picks by formatting):
 *   • one paragraph (no line breaks)  → About only, no bullets
 *   • two or more non-empty lines      → each line is a Highlight bullet, no About
 * Leading "-", "•" or "*" markers are stripped so admins can paste bullet lists.
 */
export function splitDescription(description?: string): { about: string; highlights: string[] } {
  const raw = (description ?? '').trim();
  if (!raw) return { about: '', highlights: [] };
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length >= 2) return { about: '', highlights: lines };
  return { about: raw, highlights: [] };
}

/**
 * 5→1 star histogram from the loaded reviews. Percentages are of the loaded
 * set only (the detail page fetches a page of reviews, not the full corpus),
 * so callers should label it as such and gate on a minimum count.
 */
export function ratingBars(reviews: { rating: number }[]): { star: number; count: number; pct: number }[] {
  const buckets = [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 }));
  reviews.forEach((r) => {
    const b = buckets.find((x) => x.star === Math.round(r.rating));
    if (b) b.count += 1;
  });
  const total = reviews.length || 1;
  buckets.forEach((b) => { b.pct = Math.round((b.count / total) * 100); });
  return buckets;
}
