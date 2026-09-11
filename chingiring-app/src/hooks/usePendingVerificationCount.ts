/**
 * usePendingVerificationCount — live count of stores awaiting KYC review.
 *
 * Shares the EXACT query key the admin verifications screen uses
 * (['admin','verifications']) and the same fetch, so the two dedupe to a single
 * request and the screen's post-decision `invalidateQueries` also refreshes this
 * badge. `select` narrows the shared list to just the pending count, so nav
 * components re-render only when that number actually changes.
 *
 * Admin-gated: the underlying endpoint is admin-only, so the query stays
 * disabled until the signed-in user is an admin.
 */
import { useQuery } from '@tanstack/react-query';
import { verificationAPI, type SellerStore } from '../api/verification';
import { useAuthStore } from '../store';

// Must stay identical to AdminStoreVerificationsScreen's query key + fetch so
// they share one cache entry (and one invalidation).
export const ADMIN_VERIFICATIONS_QUERY_KEY = ['admin', 'verifications'] as const;

export function usePendingVerificationCount(): number {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const { data } = useQuery<SellerStore[], Error, number>({
    queryKey: ADMIN_VERIFICATIONS_QUERY_KEY,
    queryFn: () => verificationAPI.adminListVerifications(['pending', 'rejected', 'verified']),
    enabled: isAdmin,
    staleTime: 30_000,
    select: (stores) => stores.filter((s) => s.verificationStatus === 'pending').length,
  });
  return data ?? 0;
}

export default usePendingVerificationCount;
