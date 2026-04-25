import apiClient from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Legacy coarse position values — kept for backwards compatibility. */
export type BannerPosition = 'hero' | 'sidebar' | 'inline';

/**
 * Fine-grained placement slots on the dashboard.
 * Source of truth for where a banner renders on HomeScreen.
 */
export type BannerSlot =
  | 'hero'          // Top hero banner (split-color taco style)
  | 'flash-strip'   // Thin gradient strip with badges
  | 'dual-left'     // Left half of the paired dual banner
  | 'dual-right'    // Right half of the paired dual banner
  | 'earn-coins'    // Yellow gradient coins promo
  | 'refer-earn'    // Blue gradient refer-and-earn promo
  | 'inline-1'      // Flexible inline slot #1
  | 'inline-2';     // Flexible inline slot #2

export const BANNER_SLOTS: BannerSlot[] = [
  'hero',
  'flash-strip',
  'dual-left',
  'dual-right',
  'earn-coins',
  'refer-earn',
  'inline-1',
  'inline-2',
];

/**
 * Human-readable labels + descriptions for each slot, used by the admin slot
 * picker. The description is what admins see when choosing where a banner
 * should live.
 */
export const SLOT_INFO: Record<
  BannerSlot,
  { label: string; description: string; paired?: BannerSlot }
> = {
  hero: {
    label: 'Hero',
    description: 'Top banner on the homepage (full-width splash)',
  },
  'flash-strip': {
    label: 'Flash Strip',
    description: 'Thin gradient strip with badges between product rows',
  },
  'dual-left': {
    label: 'Dual — Left',
    description: 'Left half of the side-by-side dual banner',
    paired: 'dual-right',
  },
  'dual-right': {
    label: 'Dual — Right',
    description: 'Right half of the side-by-side dual banner',
    paired: 'dual-left',
  },
  'earn-coins': {
    label: 'Earn Coins Strip',
    description: 'Wallet / rewards promo banner',
  },
  'refer-earn': {
    label: 'Refer & Earn Strip',
    description: 'Refer-a-friend promo banner',
  },
  'inline-1': {
    label: 'Inline Slot 1',
    description: 'Flexible inline banner slot #1',
  },
  'inline-2': {
    label: 'Inline Slot 2',
    description: 'Flexible inline banner slot #2',
  },
};

export type BannerLinkType = 'deal' | 'category' | 'url';

export interface BannerBadge {
  label: string;
  color: string; // hex
}

export interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  overlayImage?: string;
  linkType: BannerLinkType;
  linkValue: string;
  ctaLabel?: string;
  slot: BannerSlot;
  /** @deprecated use slot */
  position?: BannerPosition;
  gradientColors?: string[];
  textColor?: string;
  badges?: BannerBadge[];
  isActive: boolean;
  sortOrder?: number;
  startsAt?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type BannerDraft = Omit<Banner, '_id' | 'createdAt' | 'updatedAt'>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive a best-effort `slot` for records that only have the legacy `position`
 * column. Prefers `slot` when present; otherwise maps coarse position values
 * onto their closest fine-grained equivalents.
 */
export function normalizeSlot(b: Partial<Banner>): BannerSlot {
  if (b.slot) return b.slot;
  switch (b.position) {
    case 'hero':
      return 'hero';
    case 'sidebar':
      return 'inline-1';
    case 'inline':
      return 'inline-2';
    default:
      return 'hero';
  }
}

/** Ensure every banner has a `slot` set (derives from `position` if missing). */
export function withDerivedSlot(banners: Banner[]): Banner[] {
  return banners.map((b) => (b.slot ? b : { ...b, slot: normalizeSlot(b) }));
}

// ─── API client ─────────────────────────────────────────────────────────────

export const bannersAPI = {
  /**
   * Fetch active banners. Optionally filter by `slot` to narrow down to a
   * specific homepage placement.
   */
  getActiveBanners: async (params?: { slot?: BannerSlot; position?: BannerPosition }) => {
    const response = await apiClient.get<{
      status: string;
      data: { banners: Banner[] };
    }>('/api/banners', { params });
    const raw = response.data;
    return {
      ...raw,
      data: {
        banners: withDerivedSlot(raw.data?.banners ?? []),
      },
    };
  },

  /** Get active banner for a slot (first by sortOrder), or null. */
  getFirstBySlot: async (slot: BannerSlot): Promise<Banner | null> => {
    const res = await bannersAPI.getActiveBanners({ slot });
    return res.data.banners?.[0] ?? null;
  },
};

/** Bucket a flat banner list by slot. */
export function bucketBySlot(banners: Banner[]): Partial<Record<BannerSlot, Banner[]>> {
  const out: Partial<Record<BannerSlot, Banner[]>> = {};
  for (const b of banners) {
    if (!b.slot) continue;
    (out[b.slot] ??= []).push(b);
  }
  for (const k of Object.keys(out) as BannerSlot[]) {
    out[k]!.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  return out;
}
