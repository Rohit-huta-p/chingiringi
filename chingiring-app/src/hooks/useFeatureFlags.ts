import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { configAPI, FeatureFlags } from '../api/config';

// Fail OPEN: while the request is loading or errors (e.g. a Render cold start),
// every feature is treated as enabled. The server-side gate is the real
// enforcement, so a missed flag never lets a doomed action through silently —
// it just means the proactive "paused" UI appears a beat late, not never.
const ENABLED: FeatureFlags = {
  videoUploads: { disabled: false, message: '' },
  live: { disabled: false, message: '' },
};

/**
 * Reads the backend feature pause-switches (GET /api/config) so screens can grey
 * out Go Live / upload up front and show a notice on the buyer feed. Shared query
 * key → fetched once and cached across every screen that calls it.
 *
 * Refreshes on app foreground (native) and window focus (web), so flipping the
 * flag off on the server re-enables the buttons without an app restart.
 */
export function useFeatureFlags(): FeatureFlags {
  const { data, refetch } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: configAPI.getFeatures,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  return data ?? ENABLED;
}
