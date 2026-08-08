import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { authAPI } from '../api/auth';
import { useAuthStore } from '../store';

// Finishes the auth session if the browser redirect lands back while the app
// is still warming up (no-op on native). Safe to call at module load.
WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined;

/** True once at least one OAuth client ID is configured. */
export const googleConfigured = !!(webClientId || iosClientId || androidClientId);

/**
 * Google Sign-In via expo-auth-session's id_token flow. On success it POSTs the
 * id_token to `/auth/google`; the axios interceptor persists the returned tokens
 * and `hydrate()` flips the app into the authed stack — same path as password login.
 *
 * Pass an `onError` (e.g. setErrorMsg) to surface failures in the calling screen.
 */
export function useGoogleSignIn(onError?: (msg: string) => void) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const setShowWelcome = useAuthStore((s) => s.setShowWelcome);
  const [loading, setLoading] = useState(false);

  // expo-auth-session THROWS during render if the current platform's client ID
  // is undefined. Feed harmless placeholders when unconfigured so the login
  // screen never crashes; `signIn` is gated on `googleConfigured`, so nothing
  // actually fires until real IDs are set.
  const placeholder = 'unconfigured.apps.googleusercontent.com';
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webClientId ?? placeholder,
    iosClientId: iosClientId ?? placeholder,
    androidClientId: androidClientId ?? placeholder,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken =
        (response.params as any)?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        setLoading(false);
        onError?.('Google sign-in failed. Please try again.');
        return;
      }
      (async () => {
        try {
          const res = await authAPI.google({ idToken }); // interceptor stores tokens
          if (res?.isNewUser) setShowWelcome(true);
          await hydrate();
        } catch (e: any) {
          onError?.(e?.message || 'Google sign-in failed. Please try again.');
        } finally {
          setLoading(false);
        }
      })();
    } else if (response.type !== 'locked') {
      // dismiss / cancel / error — stop the spinner. Only 'error' is worth a message.
      setLoading(false);
      if (response.type === 'error') {
        onError?.('Google sign-in failed. Please try again.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const signIn = async () => {
    if (!googleConfigured) {
      onError?.('Google sign-in isn’t configured yet.');
      return;
    }
    setLoading(true);
    try {
      await promptAsync();
    } catch {
      setLoading(false);
      onError?.('Google sign-in failed. Please try again.');
    }
  };

  return { signIn, loading, ready: !!request };
}
