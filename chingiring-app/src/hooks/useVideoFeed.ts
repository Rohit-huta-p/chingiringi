import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videosAPI, FeedVideo } from '../api/videos';

/** Cursor-paginated shoppable video feed. Flattens pages into a single list. */
export function useVideoFeed() {
  const q = useInfiniteQuery({
    queryKey: ['videoFeed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => videosAPI.getFeed({ cursor: pageParam, limit: 5 }),
    getNextPageParam: (last) => last.data.nextCursor ?? undefined,
  });
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
