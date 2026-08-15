import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useAuthStore } from '../store';
import { useWindowDimensions, Platform } from 'react-native';
import { AuthModal } from '../components/AuthModal';
import { DesktopAuthModal } from '../components/DesktopAuthModal';
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
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
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

  // Fire the pending action + close. The desktop modal calls this when auth is
  // truly done (login / verify / "later") — it may hold on the OTP step after
  // signup, so completion is modal-driven there, not the raw user transition.
  const complete = useCallback(() => {
    setVisible(false);
    const cb = pendingCb.current;
    pendingCb.current = null;
    if (cb) setTimeout(cb, 250);
  }, []);

  // Mobile: auth happens on a pushed route screen (AuthLogin/AuthSignup), so the
  // modal can't call back — detect the null → truthy transition, pop the route,
  // then complete. Desktop is driven by DesktopAuthModal.onComplete, so skip here
  // (otherwise it would close + continue at account creation, before verify).
  useEffect(() => {
    if (!user || !pendingCb.current || isDesktop) return;
    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute && AUTH_SCREENS.includes(currentRoute.name)) {
      navigationRef.goBack();
    }
    complete();
  }, [user]);

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      {isDesktop ? (
        <DesktopAuthModal visible={visible} opts={opts} onComplete={complete} onCancel={() => setVisible(false)} />
      ) : (
        <AuthModal visible={visible} opts={opts} onClose={() => setVisible(false)} />
      )}
    </AuthGateContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAuthGate = () => useContext(AuthGateContext);
