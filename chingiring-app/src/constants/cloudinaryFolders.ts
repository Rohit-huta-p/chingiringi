/**
 * Cloudinary folder taxonomy — one root, entity-scoped by store where the
 * client has the id, staging where it doesn't yet (onboarding / admin "create",
 * where the DB still links the asset once the entity is saved).
 *
 *   chingiringi/stores/<storeId>/{logo,photos,products,streams}
 *   chingiringi/staging/{logos,photos,products,streams}      (no store id yet)
 *   chingiringi/admin/{banners,deals,categories}             (platform-level)
 *
 * Private KYC media is foldered server-side, NOT here — see the backend
 * services/cloudinaryKyc.js: chingiringi/kyc/<storeId>/{doc,id,selfie}.
 */
const ROOT = 'chingiringi';

const scoped = (id: string | null | undefined, leaf: string, staging: string) =>
  id ? `${ROOT}/stores/${id}/${leaf}` : `${ROOT}/staging/${staging}`;

export const cloudFolder = {
  storeLogo:     (storeId?: string | null) => scoped(storeId, 'logo', 'logos'),
  storePhotos:   (storeId?: string | null) => scoped(storeId, 'photos', 'photos'),
  storeProducts: (storeId?: string | null) => scoped(storeId, 'products', 'products'),
  storeStreams:  (storeId?: string | null) => scoped(storeId, 'streams', 'streams'),
  banners:       `${ROOT}/admin/banners`,
  deals:         `${ROOT}/admin/deals`,
  categories:    `${ROOT}/admin/categories`,
  adminProducts: `${ROOT}/admin/products`, // admin catalog / affiliate products (no seller store)
} as const;

export default cloudFolder;
