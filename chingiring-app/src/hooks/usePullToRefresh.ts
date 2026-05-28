import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { Colors } from '../constants/theme';

/**
 * Shared pull-to-refresh hook.
 * Re-hydrates the auth user (so avatar / name / phone updates from another
 * device or admin panel show up) and invalidates every React Query cache so
 * each screen refetches its data. Pass `extraKeys` to also invalidate
 * specific queries (rarely needed — invalidateQueries() with no args covers
 * all of them).
 *
 * Returns props ready to spread into a ScrollView / FlatList / SectionList
 * via the `refreshControl` element.
 *
 * Example:
 *   const refreshControl = usePullToRefresh();
 *   <ScrollView refreshControl={refreshControl}>…</ScrollView>
 */
export function usePullToRefresh(extraKeys: readonly string[][] = []) {
  const qc = useQueryClient();
  const hydrate = useAuthStore((st) => st.hydrate);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Fire-and-forget: kick off the auth re-hydrate + cache invalidations,
    // but do NOT block the spinner on them. TanStack Query's invalidateQueries
    // resolves only after every refetch settles (including default
    // retry-3-with-exponential-backoff on failures), which can hang the
    // spinner for tens of seconds on a slow or flaky network. Each screen's
    // own query loading state covers the data refresh visually.
    Promise.all([
      hydrate().catch(() => {}),
      qc.invalidateQueries().catch(() => {}),
      ...extraKeys.map((k) =>
        qc.invalidateQueries({ queryKey: k }).catch(() => {})
      ),
    ]).catch(() => {});
    // Show the spinner just long enough to acknowledge the pull gesture,
    // then always clear it — gesture feels responsive, never gets stuck.
    await new Promise((resolve) => setTimeout(resolve, 800));
    setRefreshing(false);
  // extraKeys identity changes ok — short array, callers usually pass inline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, hydrate]);

  return { refreshing, onRefresh, tintColor: Colors.primary, colors: [Colors.primary] };
}
