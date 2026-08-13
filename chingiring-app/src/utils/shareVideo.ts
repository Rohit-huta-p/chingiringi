import { Share, Platform } from 'react-native';
import { notify } from './dialog';

// Where a shared link points. Opens the video feed on web / the app via universal
// link on native. (Deep-linking to the exact clip is a later add — needs a
// per-video route.)
const SHARE_URL = 'https://chingiringi.com/app/videos';

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
  const message = `${caption || `Check out ${store || 'this clip'} on ChingiRingi 🎬`}\n${SHARE_URL}`;

  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    try {
      if (nav?.share) { await nav.share({ title, text: message, url: SHARE_URL }); return true; }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(SHARE_URL);
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
    const res = await Share.share({ title, message, url: SHARE_URL });
    return res.action === Share.sharedAction;
  } catch {
    return false;
  }
}
