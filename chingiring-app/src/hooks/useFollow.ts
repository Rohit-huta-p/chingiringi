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
  _isHydrated: boolean;
  _setFollowed: (ids: Set<string>) => void;
  _addFollow: (id: string) => void;
  _removeFollow: (id: string) => void;
  /**
   * Fetch the user's followed stores from the backend and populate followedIds.
   * Call once on auth hydrate (e.g. from BuyerProfileScreen on mount).
   * Safe to call multiple times — no-ops if already hydrated.
   */
  hydrateFollowedIds: () => Promise<void>;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followedIds: new Set(),
  _isHydrated: false,
  _setFollowed: (ids) => set({ followedIds: ids }),
  _addFollow: (id) =>
    set((s) => ({ followedIds: new Set([...s.followedIds, id]) })),
  _removeFollow: (id) =>
    set((s) => {
      const next = new Set(s.followedIds);
      next.delete(id);
      return { followedIds: next };
    }),
  hydrateFollowedIds: async () => {
    if (get()._isHydrated) return;
    try {
      const stores = await followsAPI.getFollowing();
      const ids = new Set(stores.map((s) => s._id));
      set({ followedIds: ids, _isHydrated: true });
    } catch {
      // Silently fail — user just won't have followed stores sorted/highlighted
      // until a successful hydrate. Mark hydrated anyway to avoid retry storms.
      set({ _isHydrated: true });
    }
  },
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

  const { hydrateFollowedIds } = useFollowStore();
  return { follow, unfollow, isFollowing, followedIds, hydrateFollowedIds };
}
