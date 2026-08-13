import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videosAPI, VideoComment } from '../api/videos';
import { useAuthStore } from '../store';

type Page = { data: { comments: VideoComment[]; nextCursor: string | null } };

/**
 * Flat comments for one video: cursor-paginated list + optimistic add/delete.
 * Also keeps the feed cache's `stats.comments` in sync so the rail count updates.
 */
export function useComments(videoId: string | null) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const key = ['videoComments', videoId];

  const q = useInfiniteQuery({
    queryKey: key,
    enabled: !!videoId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => videosAPI.listComments(videoId!, { cursor: pageParam, limit: 20 }),
    getNextPageParam: (last) => last.data.nextCursor ?? undefined,
  });

  const comments: VideoComment[] = (q.data?.pages ?? []).flatMap((p) => p.data.comments);

  // Nudge the video's comment counter in the feed cache (rail count).
  const bumpCount = (delta: number) => {
    qc.setQueryData(['videoFeed'], (old: any) => {
      if (!old?.pages) return old;
      const pages = old.pages.map((pg: any) => ({
        ...pg,
        data: {
          ...pg.data,
          videos: pg.data.videos.map((v: any) =>
            v._id === videoId
              ? { ...v, stats: { ...v.stats, comments: Math.max(0, (v.stats?.comments ?? 0) + delta) } }
              : v),
        },
      }));
      return { ...old, pages };
    });
  };

  const prepend = (c: VideoComment) => qc.setQueryData(key, (old: any) => {
    if (!old?.pages?.length) return old;
    const pages = old.pages.slice();
    pages[0] = { ...pages[0], data: { ...pages[0].data, comments: [c, ...pages[0].data.comments] } };
    return { ...old, pages };
  });

  const dropById = (id: string) => qc.setQueryData(key, (old: any) => {
    if (!old?.pages) return old;
    const pages = old.pages.map((pg: Page) => ({
      ...pg, data: { ...pg.data, comments: pg.data.comments.filter((c) => c._id !== id) },
    }));
    return { ...old, pages };
  });

  const add = useMutation({
    mutationFn: (text: string) => videosAPI.addComment(videoId!, text),
    onMutate: (text) => {
      const tempId = `temp-${Date.now()}`;
      prepend({
        _id: tempId, text, createdAt: new Date().toISOString(), mine: true,
        user: { _id: me?.id || 'me', name: me?.name, username: me?.username, avatarUrl: me?.avatarUrl },
      });
      bumpCount(1);
      return { tempId };
    },
    onSuccess: (res, _text, ctx) => {
      // Swap the temp row for the server's canonical comment.
      dropById(ctx!.tempId);
      prepend(res.data.comment);
    },
    onError: (_e, _text, ctx) => { if (ctx?.tempId) { dropById(ctx.tempId); bumpCount(-1); } },
  });

  const remove = useMutation({
    mutationFn: (commentId: string) => videosAPI.deleteComment(commentId),
    onMutate: (commentId) => { dropById(commentId); bumpCount(-1); },
    onError: () => qc.invalidateQueries({ queryKey: key }), // resync on failure
  });

  return { ...q, comments, add, remove };
}
