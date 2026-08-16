import React, {
  createContext, useCallback, useContext, useRef, useState,
} from 'react';
import { useAuthStore } from '../store';
import { useWindowDimensions, Platform } from 'react-native';
import { MobileAuthModal } from '../components/MobileAuthModal';
import { DesktopAuthModal } from '../components/DesktopAuthModal';

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

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
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

  // Fire the pending action + close. Both modals hold the whole flow inline
  // (login / signup / OTP verify) and call this only when auth is truly done —
  // completion is modal-driven, not a navigation event.
  const complete = useCallback(() => {
    setVisible(false);
    const cb = pendingCb.current;
    pendingCb.current = null;
    if (cb) setTimeout(cb, 250);
  }, []);

  // Same props on both — desktop split-screen card, mobile full-screen sheet.
  const AuthModalComponent = isDesktop ? DesktopAuthModal : MobileAuthModal;

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <AuthModalComponent
        visible={visible}
        opts={opts}
        onComplete={complete}
        onCancel={() => setVisible(false)}
      />
    </AuthGateContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAuthGate = () => useContext(AuthGateContext);
