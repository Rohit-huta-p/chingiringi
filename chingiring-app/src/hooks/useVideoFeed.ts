import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { videosAPI, FeedVideo } from '../api/videos';

/**
 * Cursor-paginated shoppable video feed. Flattens pages into a single list.
 *
 * Hands-off freshness: refetches on window/app focus and polls every 45s while the
 * Videos screen is the focused route, so a newly-uploaded clip appears on its own
 * once it finishes encoding — no manual pull-to-refresh needed.
 */
export function useVideoFeed() {
  const isFocused = useIsFocused();
  const q = useInfiniteQuery({
    queryKey: ['videoFeed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => videosAPI.getFeed({ cursor: pageParam, limit: 5 }),
    getNextPageParam: (last) => last.data.nextCursor ?? undefined,
    refetchOnWindowFocus: true,
    // Poll ONLY while Videos is the active screen — never from other tabs or in the background.
    refetchInterval: isFocused ? 45_000 : false,
  });

  // Native has no window-focus event → refetch when the app returns to the foreground.
  const { refetch } = q;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && isFocused) refetch();
    });
    return () => sub.remove();
  }, [isFocused, refetch]);

  const videos: FeedVideo[] = (q.data?.pages ?? []).flatMap((p) => p.data.videos);
  return { ...q, videos };
}

/** Engagement mutations for the feed. Fire-and-forget; UI updates optimistically. */
export function useVideoEngagement() {
  const qc = useQueryClient();
  const like = useMutation({ mutationFn: (id: string) => videosAPI.toggleLike(id) });
  const save = useMutation({ mutationFn: (id: string) => videosAPI.toggleSave(id) });
  const share = useMutation({ mutationFn: (id: string) => videosAPI.trackShare(id) });
  const view = useMutation({
    mutationFn: (v: { id: string; watchSec: number }) => videosAPI.trackView(v.id, v.watchSec),
  });
  return { like, save, share, view, qc };
}
