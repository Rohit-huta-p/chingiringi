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
export function uploadKycImage(buffer, { storeId, kind } = {}) {
  if (!ensureConfig()) {
    const err = new Error('KYC media storage is not configured on the server.');
    err.statusCode = 503;
    return Promise.reject(err);
  }
  // Fold by store when we know it (chingiringi/kyc/<storeId>); onboarding uploads
  // (store not created yet) land in a staging folder and are still linked via the
  // publicId stored on the store at submit time.
  const folder = storeId ? `${KYC_ROOT}/${storeId}` : `${KYC_ROOT}/staging`;
  const opts = { folder, type: 'authenticated', resource_type: 'image', overwrite: false };
  // Deterministic id per slot once we have the store → a re-submit overwrites the
  // previous file instead of orphaning it (chingiringi/kyc/<storeId>/{doc,id,selfie}).
  if (storeId && KYC_KINDS.includes(kind)) {
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
