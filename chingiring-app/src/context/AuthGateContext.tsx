import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useAuthStore } from '../store';
import { AuthModal } from '../components/AuthModal';
import { navigationRef } from '../lib/navigationRef';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthGateIcon =
  | 'default' | 'wallet' | 'gift' | 'video' | 'cart' | 'share' | 'navigation' | 'star';

export type AuthGateOpts = {
  title?: string;
  subtitle?: string;
  icon?: AuthGateIcon;
};

type AuthGateCtx = {
  requireAuth: (cb?: () => void, opts?: AuthGateOpts) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthGateContext = createContext<AuthGateCtx>({ requireAuth: () => {} });

// ─── Auth screen names registered in the modal stack ─────────────────────────

const AUTH_SCREENS = ['AuthLogin', 'AuthSignup'];

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<AuthGateOpts | undefined>();
  const pendingCb = useRef<(() => void) | null>(null);

  const requireAuth = useCallback((cb?: () => void, o?: AuthGateOpts) => {
    // Synchronous read avoids stale closure issues.
    if (useAuthStore.getState().user) {
      cb?.();
      return;
    }
    pendingCb.current = cb ?? null;
    setOpts(o);
    setVisible(true);
  }, []);

  // When user transitions null → truthy (login/signup completed):
  // 1. Pop any auth modal screens off the stack.
  // 2. Fire the pending action after navigation settles.
  useEffect(() => {
    if (!user || !pendingCb.current) return;
    const cb = pendingCb.current;
    pendingCb.current = null;
    setVisible(false);

    // Pop auth screens if they're on top of the stack.
    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute && AUTH_SCREENS.includes(currentRoute.name)) {
      navigationRef.goBack();
    }

    // Delay so navigation finishes animating before the action runs.
    const t = setTimeout(cb, 350);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <AuthModal
        visible={visible}
        opts={opts}
        onClose={() => setVisible(false)}
      />
    </AuthGateContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAuthGate = () => useContext(AuthGateContext);
