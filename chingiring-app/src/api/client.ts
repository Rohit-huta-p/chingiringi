import axios from 'axios';
import { Platform } from 'react-native';

// For Web testing, use localhost to avoid Cross-Site Cookie blocking. For native devices, use the LAN IP.
const defaultURL = Platform.OS === 'web' ? 'http://localhost:8000' : 'http://192.168.1.90:8000';
const baseURL = process.env.EXPO_PUBLIC_API_URL || defaultURL;
console.log("Backend Target URL:", baseURL);

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true, // Crucial for passing HTTP-Only cookies globally across network boundaries
  headers: {
    'Content-Type': 'application/json',
  },
});

// We no longer need a request interceptor to attach Bearer tokens since the network stack dynamically attaches the Set-Cookie headers on all subsequent calls!

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loops if login or refresh routes themselves 401
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt a silent token refresh. Because withCredentials is true, the browser will seamlessly transmit the stored refreshToken cookie.
        await axios.post(`${baseURL}/auth/refresh`, {}, {
          withCredentials: true
        });

        // The backend `/auth/refresh` responds with a newly minted Set-Cookie accessToken
        // Because Axios retains `withCredentials`, we simply re-issue the original failing request directly:
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed (cookie expired, missing, or revoked). App needs to be punted to login safely via Zustand Hydration
        return Promise.reject(refreshError);
      }
    }
    
    const errorMessage = error.response?.data?.message || error.message;
    return Promise.reject(new Error(errorMessage));
  }
);

export default apiClient;
