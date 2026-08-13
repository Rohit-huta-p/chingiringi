import { Share, Platform } from 'react-native';
import { notify } from './dialog';

// Base for a shared link — /video/<id> is a dedicated page that resolves on both
// mobile and desktop web (and the app via universal link on native).
const WEB_BASE = 'https://chingiringi.com';

type ShareableVideo = { _id: string; store?: { name?: string }; caption?: string };

/**
 * Plain OS share for a clip — native share sheet on iOS/Android, the Web Share
 * API (with a copy-link fallback) on web. No rewards/coins; the caller may bump
 * the share counter when this resolves true.
 */
export async function shareVideo(video: ShareableVideo): Promise<boolean> {
  const store = video.store?.name?.trim();
  const title = store ? `${store} on ChingiRingi` : 'ChingiRingi';
  const caption = video.caption?.trim();
  const url = `${WEB_BASE}/video/${encodeURIComponent(video._id)}`;
  const message = `${caption || `Check out ${store || 'this clip'} on ChingiRingi 🎬`}\n${url}`;

  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    try {
      if (nav?.share) { await nav.share({ title, text: message, url }); return true; }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        notify('Link copied', 'Paste it anywhere to share this clip.');
        return true;
      }
    } catch {
      return false; // user cancelled the share dialog
    }
    notify('Share', message);
    return false;
  }

  try {
    const res = await Share.share({ title, message, url });
    return res.action === Share.sharedAction;
  } catch {
    return false;
  }
}
