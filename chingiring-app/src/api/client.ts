import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

function getBaseURL(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // Try to auto-detect LAN IP from Expo's dev server connection
  const debuggerHost = Constants.expoGoConfig?.debuggerHost ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }

  if (Platform.OS === 'web') return 'http://localhost:8000';
  return 'exp://10.40.27.107:8081';
}

const isNative = Platform.OS !== 'web';
const baseURL = getBaseURL();
console.log('[API] baseURL:', baseURL, '| platform:', Platform.OS);

// ── Token storage — Bearer everywhere ──────────────────────────────────
// Native uses SecureStore (encrypted keychain). Web uses localStorage.
//
// Web previously relied on httpOnly cookies with SameSite=None; Secure.
// That works in Chrome/Firefox but Safari's ITP treats cross-origin
// Set-Cookie as tracking and silently drops it. Result: user "logs in"
// (200 response) but every subsequent request 401s because the cookie
// isn't attached. Switching to bearer tokens on web too makes auth work
// in every browser identically to native.
async function getToken(key: string): Promise<string | null> {
  if (isNative) return SecureStore.getItemAsync(key);
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(key);
}

async function setToken(key: string, value: string): Promise<void> {
  if (isNative) return SecureStore.setItemAsync(key, value);
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, value);
}

async function clearTokens(): Promise<void> {
  if (isNative) {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('cachedUser');
    return;
  }
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
  window.localStorage.removeItem('cachedUser');
}

// Cached user — works on native (offline-first) and web (session restore).
export async function getCachedUser(): Promise<any | null> {
  let raw: string | null = null;
  if (isNative) {
    raw = await SecureStore.getItemAsync('cachedUser');
  } else if (typeof window !== 'undefined' && window.localStorage) {
    raw = window.localStorage.getItem('cachedUser');
  }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setCachedUser(user: any): Promise<void> {
  const payload = JSON.stringify(user);
  if (isNative) return SecureStore.setItemAsync('cachedUser', payload);
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem('cachedUser', payload);
}

// Pending referral code — stashed when a guest arrives via a referral link so it
// survives browsing/reload until they sign in. Same storage split as tokens
// (SecureStore native / localStorage web).
export async function getStoredReferralCode(): Promise<string | null> {
  if (isNative) return SecureStore.getItemAsync('pendingReferralCode');
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem('pendingReferralCode');
}

export async function setStoredReferralCode(code: string | null): Promise<void> {
  if (isNative) {
    if (code) await SecureStore.setItemAsync('pendingReferralCode', code);
    else await SecureStore.deleteItemAsync('pendingReferralCode');
    return;
  }
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (code) window.localStorage.setItem('pendingReferralCode', code);
  else window.localStorage.removeItem('pendingReferralCode');
}

export async function hasStoredAccessToken(): Promise<boolean> {
  const t = await getToken('accessToken');
  return !!t;
}

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  // Cookies kept as fallback for same-origin dev / same-domain prod setups.
  // Primary auth is Bearer header (works cross-origin in every browser).
  withCredentials: !isNative,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token as Bearer on EVERY request (web + native). Cookies
// still ride along on web via withCredentials as a bonus, but Bearer is
// the reliable path — Safari ITP blocks the cross-origin cookies.
apiClient.interceptors.request.use(async (config) => {
  const accessToken = await getToken('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  async (response) => {
    // Store tokens from response body on both platforms.
    if (response.data?.tokens) {
      const { accessToken, refreshToken } = response.data.tokens;
      if (accessToken) await setToken('accessToken', accessToken);
      if (refreshToken) await setToken('refreshToken', refreshToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      const errorMessage = error.response?.data?.message || error.message;
      return Promise.reject(new Error(errorMessage));
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Refresh flow — same on web + native. Send refresh token in body,
        // get back new tokens, store, retry the original request.
        const refreshToken = await getToken('refreshToken');
        if (refreshToken) {
          const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          if (res.data?.tokens) {
            await setToken('accessToken', res.data.tokens.accessToken);
            await setToken('refreshToken', res.data.tokens.refreshToken);
          }
        } else if (!isNative) {
          // No stored refresh token on web — try the cookie path as a
          // fallback for any pre-existing session left over from the old
          // cookie-based auth.
          await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        } else {
          return Promise.reject(error);
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        return Promise.reject(refreshError);
      }
    }

    // Reject with a real Error (so `.message` works everywhere) but keep the
    // structured response so callers can branch on status / code / data
    // (e.g. a 409 CATEGORY_IN_USE that drives a reassignment UI). Before, we
    // dropped `error.response` entirely and only the message survived.
    const errorMessage = error.response?.data?.message || error.message;
    const wrapped: any = new Error(errorMessage);
    wrapped.response = error.response;
    wrapped.status = error.response?.status;
    wrapped.code = error.response?.data?.code;
    wrapped.data = error.response?.data?.data;
    return Promise.reject(wrapped);
  }
);

export { clearTokens, isNative };
export default apiClient;
