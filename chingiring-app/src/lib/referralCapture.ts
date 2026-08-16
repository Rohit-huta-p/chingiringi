import { Linking, Platform } from 'react-native';
import { useAuthStore } from '../store';
import { getStoredReferralCode } from '../api/client';
import { parseReferralCode } from '../utils/referralLink';

// Capture a referral code at app launch so a logged-out guest who arrived via a
// referral link keeps it through browsing until they sign in. Reads the entry
// URL first (web `location` / native deep link), else a previously-stashed code.
// Best-effort — never throws into app startup.
export async function initReferralCapture(): Promise<void> {
  try {
    const set = useAuthStore.getState().setPendingReferralCode;

    let url: string | null = null;
    if (Platform.OS === 'web') {
      url = typeof window !== 'undefined' ? window.location.href : null;
    } else {
      url = await Linking.getInitialURL();
    }

    const fromUrl = parseReferralCode(url);
    if (fromUrl) { set(fromUrl); return; }

    // No code in the entry URL — restore one stashed on a previous visit.
    const stored = await getStoredReferralCode();
    if (stored) set(stored);
  } catch {
    /* best-effort: a capture failure must never break app startup */
  }
}
