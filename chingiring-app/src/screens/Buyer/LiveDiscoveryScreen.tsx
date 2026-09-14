/**
 * Live stream data module.
 *
 * Exports the shared `LiveStream` shape and `fetchActiveStreams()`
 * (GET /api/streams/active), consumed by:
 *   - OfflineStoresScreen — the buyer "Stores" tab's Live | Stores toggle
 *   - StoreDetailScreen   — "live now" check for a single store
 *
 * NOTE: this file used to also host a standalone <LiveDiscoveryScreen>
 * component and its cards. That screen was superseded by the Live | Stores
 * toggle inside OfflineStoresScreen and was never mounted in any navigator,
 * so it was removed during cleanup. The filename is kept so existing import
 * paths ('../Buyer/LiveDiscoveryScreen') stay valid.
 */
import apiClient from '../../api/client';
import type { StoreCategory } from '../../data/offlineStores';

// ── Stream shape from GET /streams/active ─────────────────────────────────
export interface LiveStream {
  _id: string;
  storeId: string;
  storeName: string;
  storeLogoUrl?: string;
  /** Seller-set cover thumbnail (GoLive). Preferred over the store logo on the card. */
  thumbnail?: string;
  title: string;
  viewerCount: number;
  status: 'live' | 'idle' | 'ended';
  /** The broadcasting store's category — used to filter the live feed by category. */
  category?: StoreCategory;
}

export async function fetchActiveStreams(): Promise<LiveStream[]> {
  try {
    const res = await apiClient.get('/api/streams/active');
    const payload = res.data?.data?.streams ?? res.data?.streams ?? res.data?.data ?? res.data;
    const rows = Array.isArray(payload) ? payload : [];
    // The backend populates `storeId` as an object ({ _id, name, logoUrl, ... }),
    // not the flat storeName/storeLogoUrl the UI expects. Flatten here so every
    // consumer (OfflineStores live grid, StoreDetail) gets a stable shape and
    // `storeId` stays a plain id for navigation.
    return rows.map((s: any): LiveStream => {
      const store = s.storeId && typeof s.storeId === 'object' ? s.storeId : null;
      return {
        _id: s._id,
        storeId: store?._id ?? s.storeId ?? '',
        storeName: s.storeName ?? store?.name ?? store?.shortName ?? 'Store',
        storeLogoUrl: s.storeLogoUrl ?? store?.logoUrl ?? undefined,
        thumbnail: s.thumbnail || undefined,
        title: s.title ?? '',
        viewerCount: s.viewerCount ?? 0,
        status: s.status ?? 'live',
        category: store?.category ?? undefined,
      };
    });
  } catch {
    return []; // graceful: backend may not be ready yet
  }
}
