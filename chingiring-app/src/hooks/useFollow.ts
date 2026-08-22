/**
 * useFollow — optimistic follow/unfollow with Zustand persistence.
 *
 * Followed store IDs are kept in a small followStore so LiveDiscoveryScreen
 * can sort followed stores to the top without re-fetching the network.
 */
import { create } from 'zustand';
import { followsAPI } from '../api/follows';

// ── Persistent follow store ────────────────────────────────────────────────
interface FollowState {
  followedIds: Set<string>;
  _setFollowed: (ids: Set<string>) => void;
  _addFollow: (id: string) => void;
  _removeFollow: (id: string) => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  followedIds: new Set(),
  _setFollowed: (ids) => set({ followedIds: ids }),
  _addFollow: (id) =>
    set((s) => ({ followedIds: new Set([...s.followedIds, id]) })),
  _removeFollow: (id) =>
    set((s) => {
      const next = new Set(s.followedIds);
      next.delete(id);
      return { followedIds: next };
    }),
}));

// ── Hook ───────────────────────────────────────────────────────────────────
export function useFollow() {
  const { followedIds, _addFollow, _removeFollow } = useFollowStore();

  /** Returns true if the given store is followed locally. */
  const isFollowing = (storeId: string) => followedIds.has(storeId);

  /**
   * Optimistically follow a store, then sync with the backend.
   * Reverts on error and throws so the caller can show a toast.
   */
  const follow = async (storeId: string) => {
    _addFollow(storeId);
    try {
      await followsAPI.followStore(storeId);
    } catch (err) {
      _removeFollow(storeId); // revert
      throw err;
    }
  };

  /**
   * Optimistically unfollow a store, then sync with the backend.
   * Reverts on error and throws so the caller can show a toast.
   */
  const unfollow = async (storeId: string) => {
    _removeFollow(storeId);
    try {
      await followsAPI.unfollowStore(storeId);
    } catch (err) {
      _addFollow(storeId); // revert
      throw err;
    }
  };

  return { follow, unfollow, isFollowing, followedIds };
}
