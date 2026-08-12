import { create } from 'zustand';
import { authAPI } from '../api/auth';
import { referralsAPI } from '../api/referrals';
import { clearTokens, getCachedUser, setCachedUser, hasStoredAccessToken, isNative } from '../api/client';
import { unregisterForPush } from '../lib/push';
import type { NotificationPrefs } from '../api/notifications';

export interface UserType {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role?: string;
  referralCode?: string;
  avatarUrl?: string;
  notificationPrefs?: NotificationPrefs;
}

interface AuthState {
  isAuthenticated: boolean;
  isReady: boolean;
  user: UserType | null;
  showWelcome: boolean;
  setShowWelcome: (v: boolean) => void;
  dismissWelcome: () => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isReady: false,
  user: null,
  showWelcome: false,

  // First-sign-in welcome. Set true only on account creation (see backend
  // `isNewUser`), consumed once by WelcomeModal, then dismissed.
  setShowWelcome: (v) => set({ showWelcome: v }),
  dismissWelcome: () => set({ showWelcome: false }),

  hydrate: async () => {
    // ─── 1. Offline-first on native: show cached user immediately if token exists ───
    if (isNative) {
      try {
        const tokenExists = await hasStoredAccessToken();
        const cached = await getCachedUser();
        if (tokenExists && cached) {
          // Show user as logged-in right away
          set({ isAuthenticated: true, user: cached, isReady: true });
        }
      } catch {
        // ignore — will fall through to network check
      }
    }

    // ─── 2. Validate with backend (cookies on web, bearer on native) ───
    try {
      const response = await authAPI.getMe();
      if (response?.data?.user) {
        set({ isAuthenticated: true, user: response.data.user, isReady: true });
        // Confirm a pending referral now that we know this is a real app login.
        // Native only — the web client must never call claim (that's the gate).
        // Best-effort: a failure here must never break hydrate.
        if (isNative) { referralsAPI.claim().catch(() => {}); }
        // Refresh cache
        if (isNative) await setCachedUser(response.data.user);
      } else {
        // No user returned — if we had a cached session, keep it (backend issue); otherwise clear
        if (!isNative) {
          set({ isAuthenticated: false, user: null, isReady: true });
        } else {
          set({ isReady: true });
        }
      }
    } catch {
      // Network/auth error:
      // - On web: no cookies → not authenticated
      // - On native: if cached user already set above, keep it; otherwise unauthenticated
      if (!isNative) {
        set({ isAuthenticated: false, user: null, isReady: true });
      } else {
        // If hydrate #1 didn't set authenticated (no token), finalize as logged-out
        set((state) => state.isAuthenticated ? { isReady: true } : { isAuthenticated: false, user: null, isReady: true });
      }
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (err: any) {
      console.warn('Backend logout failed', err.message);
    }
    // Unregister the push token while the auth token is still present (the
    // DELETE call needs it) — best-effort, cannot throw into logout.
    await unregisterForPush();
    // Clear stored tokens + cached user (native) and purge state
    await clearTokens();
    set({ isAuthenticated: false, user: null, showWelcome: false });
  },
}));
