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
  return 'https://chingiringi-backend.onrender.com';
}

const isNative = Platform.OS !== 'web';
const baseURL = getBaseURL();
console.log('[API] baseURL:', baseURL, '| platform:', Platform.OS);

// Token storage helpers for native
async function getToken(key: string): Promise<string | null> {
  if (!isNative) return null;
  return SecureStore.getItemAsync(key);
}

async function setToken(key: string, value: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(key, value);
}

async function clearTokens(): Promise<void> {
  if (!isNative) return;
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
}

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: !isNative, // Cookies for web only
  headers: {
    'Content-Type': 'application/json',
  },
});

// On native, attach the access token as Authorization header
apiClient.interceptors.request.use(async (config) => {
  if (isNative) {
    const accessToken = await getToken('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  async (response) => {
    // On native, store tokens from response body
    if (isNative && response.data?.tokens) {
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
        if (isNative) {
          // Send refresh token in body for native
          const refreshToken = await getToken('refreshToken');
          if (!refreshToken) return Promise.reject(error);
          const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
          if (res.data?.tokens) {
            await setToken('accessToken', res.data.tokens.accessToken);
            await setToken('refreshToken', res.data.tokens.refreshToken);
          }
        } else {
          await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (isNative) await clearTokens();
        return Promise.reject(refreshError);
      }
    }

    const errorMessage = error.response?.data?.message || error.message;
    return Promise.reject(new Error(errorMessage));
  }
);

export { clearTokens };
export default apiClient;
