import { create } from 'zustand';
import { authAPI } from '../api/auth';

export interface UserType {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isReady: boolean;
  user: UserType | null;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isReady: false,
  user: null,

  hydrate: async () => {
    try {
      const response = await authAPI.getMe();
      if (response?.data?.user) {
        set({ isAuthenticated: true, user: response.data.user, isReady: true });
      } else {
        set({ isAuthenticated: false, user: null, isReady: true });
      }
    } catch {
      set({ isAuthenticated: false, user: null, isReady: true });
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (err: any) {
      console.warn("Backend logout failed", err.message);
    }
    // Strict purge on the state immediately
    set({ isAuthenticated: false, user: null });
  }
}));
