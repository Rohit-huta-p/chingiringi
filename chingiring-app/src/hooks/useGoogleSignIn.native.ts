import { useState } from 'react';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { authAPI } from '../api/auth';
import { useAuthStore } from '../store';

// Native Google Sign-In via the Google Identity SDK. Replaces the expo-auth-session
// browser flow, which Google rejects on native (implicit id_token + Android client
// → "Error 400: invalid_request"). Metro auto-resolves this .native file on iOS/
// Android; web keeps useGoogleSignIn.ts. On success it POSTs the id_token to
// /auth/google — same backend contract — then hydrates.

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;

/** Configured once the Web client ID (the id_token audience) is present. */
export const googleConfigured = !!webClientId;

let didConfigure = false;
function ensureConfigured() {
  if (didConfigure || !webClientId) return;
  // webClientId → the id_token's `aud`, which the backend verifies against
  // GOOGLE_WEB_CLIENT_ID. On Android the SDK uses the app's own OAuth client
  // (matched by package + SHA-1) automatically — no androidClientId needed here.
  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
  });
  didConfigure = true;
}

export function useGoogleSignIn(onError?: (msg: string) => void) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const setShowWelcome = useAuthStore((s) => s.setShowWelcome);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!googleConfigured) {
      onError?.('Google sign-in isn’t configured yet.');
      return;
    }
    ensureConfigured();
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response: any = await GoogleSignin.signIn();

      // v13+ returns { type: 'cancelled' | 'success', data }. Bail quietly on cancel.
      if (response?.type && response.type !== 'success') return;

      let idToken: string | undefined = response?.data?.idToken ?? response?.idToken ?? undefined;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }
      if (!idToken) {
        onError?.('Google sign-in failed. Please try again.');
        return;
      }

      const res = await authAPI.google({ idToken }); // interceptor stores tokens
      if (res?.isNewUser) setShowWelcome(true);
      await hydrate();
    } catch (e: any) {
      const code = e?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) {
        // user cancelled or a request is already running — stay quiet
      } else if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        onError?.('Google Play Services is unavailable or outdated.');
      } else {
        onError?.(e?.response?.data?.message || e?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading, ready: googleConfigured };
}
