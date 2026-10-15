/**
 * cloudinaryKyc.js — private (authenticated) storage for seller KYC media.
 *
 * KYC images (store document, government ID, selfie) are uploaded to Cloudinary
 * with delivery `type: 'authenticated'`, so the raw asset is NOT reachable via a
 * plain URL. Viewing requires a *signed* delivery URL, which can only be minted
 * with the API secret on the server. We never store a public URL for these.
 *
 * Requires the following backend env (the two EXPO_PUBLIC_* vars are client-safe
 * and already present; the API key/secret are server-only and must be added):
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME  (or CLOUDINARY_CLOUD_NAME)
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * When the secret is absent, kycConfigured() is false and callers fall back to
 * the legacy (public, unsigned) upload path so local dev keeps working.
 */
import { v2 as cloudinary } from 'cloudinary';

const KYC_ROOT = 'chingiringi/kyc';
const KYC_KINDS = ['doc', 'id', 'selfie'];

let _configured = false;
function ensureConfig() {
  if (_configured) return true;
  // Read env LAZILY (at first call), not at module load. app.js runs
  // dotenv.config() as a body statement, which executes AFTER this module is
  // pulled in by the route chain (app.js → storeRoutes → storeController →
  // cloudinaryKyc). Capturing these into module-level consts would therefore
  // freeze them to '' and wedge KYC off even when the .env is correct.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  _configured = true;
  return true;
}

/** True once the server has the credentials needed to sign uploads and URLs. */
export const kycConfigured = () => ensureConfig();

/**
 * Upload an image buffer as a private (authenticated) asset.
 * Returns the identifiers needed to rebuild a signed delivery URL later —
 * never a public URL.
 */
export function uploadKycImage(buffer, { storeId, userId, kind } = {}) {
  if (!ensureConfig()) {
    const err = new Error('KYC media storage is not configured on the server.');
    err.statusCode = 503;
    return Promise.reject(err);
  }
  // Deterministic folder + id per owner & slot, so a re-upload OVERWRITES in place
  // (never leaves an orphaned copy) and the owner can be verified from the publicId
  // on delete. Store known → chingiringi/kyc/<storeId>/<kind>; onboarding (no store
  // yet) → chingiringi/kyc/staging/<userId>/<kind>. Either way the publicId is what
  // gets stored on the store at submit time.
  const scope = storeId ? String(storeId) : `staging/${userId}`;
  const opts = {
    folder: `${KYC_ROOT}/${scope}`,
    type: 'authenticated',
    resource_type: 'image',
    overwrite: false,
  };
  if (KYC_KINDS.includes(kind)) {
    opts.public_id = kind;
    opts.overwrite = true;
    opts.invalidate = true;
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
      resolve({ publicId: result.public_id, format: result.format, version: result.version });
    });
    stream.end(buffer);
  });
}

/**
 * Signed authenticated delivery URL. Renders inline in <img>/<Image>, but is
 * only mintable with the API secret, so it can't be guessed or shared long-term
 * the way a public URL can. Returns null when not configured or no publicId.
 */
export function signedKycUrl(publicId, { format, version } = {}) {
  if (!publicId || !ensureConfig()) return null;
  return cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: 'image',
    sign_url: true,
    secure: true,
    ...(format ? { format } : {}),
    ...(version ? { version } : {}),
  });
}

/**
 * Delete a private KYC asset by publicId. Resolves to a harmless no-op when not
 * configured or when no publicId is given, so callers can fire it without guards.
 */
export function deleteKycImage(publicId) {
  if (!publicId || !ensureConfig()) return Promise.resolve({ result: 'skipped' });
  return cloudinary.uploader.destroy(publicId, {
    type: 'authenticated', resource_type: 'image', invalidate: true,
  });
}

/**
 * True when `publicId` lives under the caller's OWN KYC folder — their onboarding
 * staging area (chingiringi/kyc/staging/<userId>/…) or their store's folder
 * (chingiringi/kyc/<storeId>/…). Used to authorise deletes so a seller can never
 * destroy another account's documents.
 */
export function ownsKycPublicId(publicId, { userId, storeId } = {}) {
  if (!publicId || typeof publicId !== 'string') return false;
  if (userId && publicId.startsWith(`${KYC_ROOT}/staging/${userId}/`)) return true;
  if (storeId && publicId.startsWith(`${KYC_ROOT}/${storeId}/`)) return true;
  return false;
}
