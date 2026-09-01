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

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

const KYC_FOLDER = 'seller-verification-private';

let _configured = false;
function ensureConfig() {
  if (_configured) return true;
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) return false;
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
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
export function uploadKycImage(buffer) {
  if (!ensureConfig()) {
    const err = new Error('KYC media storage is not configured on the server.');
    err.statusCode = 503;
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: KYC_FOLDER, type: 'authenticated', resource_type: 'image', overwrite: false },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve({ publicId: result.public_id, format: result.format, version: result.version });
      },
    );
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
