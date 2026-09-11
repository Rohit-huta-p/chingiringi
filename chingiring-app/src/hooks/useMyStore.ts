/**
 * useMyStore — single source of truth for the seller's own store.
 *
 * Wraps GET /api/stores/mine (verificationAPI.getMyStore, which parses the
 * { status, data: { store } } backend envelope in ONE place) behind a single
 * shared react-query cache entry. The Dashboard, My Store and Go Live tabs all
 * call this hook, so they read the same store object — no divergent local
 * fetchers or response-shape parsing that can drift apart.
 *
 * Invalidate MY_STORE_QUERY_KEY (see BusinessOnboarding after store creation
 * and StoreVerification after submit/skip) to refresh every seller screen at
 * once. Import the constant instead of re-typing the tuple so the key can't
 * diverge from what this hook registers.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { verificationAPI, type SellerStore } from '../api/verification';

/** Shared cache key for the seller's own store. Import everywhere it's needed. */
export const MY_STORE_QUERY_KEY = ['seller', 'myStore'] as const;

/** The seller's own store (GET /api/stores/mine); `null` when no store exists yet. */
export function useMyStore(): UseQueryResult<SellerStore | null> {
  return useQuery<SellerStore | null>({
    queryKey: MY_STORE_QUERY_KEY,
    queryFn: verificationAPI.getMyStore,
    staleTime: 60_000,
  });
}
