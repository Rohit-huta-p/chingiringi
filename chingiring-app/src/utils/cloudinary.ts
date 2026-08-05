import { PixelRatio } from 'react-native';

/**
 * Rewrite a Cloudinary delivery URL to serve a crisp, right-sized image for a
 * given display box:
 *   - c_fill,g_auto : content-aware crop to the box's exact aspect (no dumb
 *     center-crop, no stretch)
 *   - w_,h_ × DPR   : exact device pixels (kills blur from browser upscaling)
 *   - f_auto,q_auto : best format (webp/avif) + auto quality (smaller + sharper)
 *
 * Non-Cloudinary URLs (e.g. a pasted Unsplash link) pass through unchanged, as
 * do URLs that already carry a transform. DPR is capped at 3 so we never request
 * absurdly large images on high-density phones.
 */
export function cloudinaryFill(
  url: string | undefined,
  boxW: number,
  boxH: number,
): string | undefined {
  if (!url || !url.includes('res.cloudinary.com/') || !url.includes('/upload/')) return url;
  // Already transformed (e.g. /upload/c_fill,.. or /upload/w_..) → leave as-is.
  if (/\/upload\/[a-z]{1,2}_/.test(url)) return url;

  // ceil (not round): on scaled displays / browser zoom the DPR is fractional
  // (e.g. 2.2). Rounding down under-requests pixels → the browser upscales →
  // blur. ceil always provisions enough. Capped at 3 to avoid absurd sizes.
  const dpr = Math.min(Math.max(Math.ceil(PixelRatio.get()) || 1, 1), 3);
  const w = Math.max(1, Math.round(boxW * dpr));
  const h = Math.max(1, Math.round(boxH * dpr));
  return url.replace('/upload/', `/upload/c_fill,g_auto,f_auto,q_auto,w_${w},h_${h}/`);
}
