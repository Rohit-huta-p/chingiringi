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

/** New banner shape — replaces the 8-slot taxonomy for new banners. */
export type BannerType = 'hero' | 'dual';

/** Right half of a dual banner. Top-level Banner fields are the left half. */
export interface BannerSide {
  imageUrl?: string;
  mobileImageUrl?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  linkType?: BannerLinkType;
  linkValue?: string;
}

/**
 * Default gradient per slot — used when a banner has no `imageUrl` AND no
 * explicit `gradientColors` override. Source of truth for the slot-coloured
 * placeholders that appear in both the admin form's slot picker and the
 * home-page banner cards (HomeScreen + MobileHomeScreen). Keeping the map
 * here means an admin can preview the colour scheme in the form and trust
 * it'll match production exactly.
 *
 * Two-stop gradients to keep the LinearGradient API consistent. Add a third
 * mid-stop locally if a slot needs richer depth.
 */
export const SLOT_GRADIENTS: Record<BannerSlot, [string, string]> = {
  hero:          ['#4A7A32', '#FDE68A'],
  'flash-strip': ['#0C1021', '#4784E2'],
  'dual-left':   ['#C084FC', '#F0ABFC'],
  'dual-right':  ['#FBCFE8', '#F9A8D4'],
  'earn-coins':  ['#F59E0B', '#FDE68A'],
  'refer-earn':  ['#0C1021', '#4784E2'],
  'inline-1':    ['#64748b', '#94a3b8'],
  'inline-2':    ['#64748b', '#94a3b8'],
};

/**
 * Resolve gradient for a banner with three-tier priority:
 *   1. Admin-set `gradientColors` (explicit override)
 *   2. Slot default from `SLOT_GRADIENTS`
 *   3. Brand fallback (only if slot is unknown — should never hit)
 */
export function resolveBannerGradient(
  banner: Pick<Banner, 'gradientColors' | 'slot' | 'position'>,
): [string, string] {
  if (banner.gradientColors && banner.gradientColors.length >= 2) {
    return [banner.gradientColors[0], banner.gradientColors[1]];
  }
  const slot = banner.slot ?? normalizeSlot(banner);
  return SLOT_GRADIENTS[slot] ?? ['#4784E2', '#91BDFF'];
}

export interface BannerBadge {
  label: string;
  color: string; // hex
}

export interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl?: string;
  overlayImage?: string;
  linkType: BannerLinkType;
  linkValue: string;
  ctaLabel?: string;
  slot: BannerSlot;
  /** @deprecated use slot */
  position?: BannerPosition;
  /** Banner layout type (replaces slot for new banners). */
  type?: BannerType;
  /** 0-based index of the home row-gap this banner sits in. */
  rowIndex?: number;
  /** Right half for dual banners; top-level fields are the left half. */
  right?: BannerSide;
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

/**
 * Fill the new layout fields for legacy banners: default `type` to 'hero' and
 * derive `rowIndex` from `sortOrder` when missing. Legacy dual pairs are NOT
 * merged — they degrade to a single hero. Run after withDerivedSlot.
 */
export function withDerivedBannerLayout(banners: Banner[]): Banner[] {
  return banners.map((b) => ({
    ...b,
    type: b.type ?? 'hero',
    rowIndex: b.rowIndex ?? b.sortOrder ?? 0,
  }));
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
        banners: withDerivedBannerLayout(withDerivedSlot(raw.data?.banners ?? [])),
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
