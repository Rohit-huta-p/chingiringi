/**
 * verification.ts — Seller store management & verification API.
 *
 * Routes (built by E1 in Sprint 2):
 *   GET  /api/stores/mine              → { store } (seller's own store + products)
 *   PATCH /api/stores/:id/verification → { docType, docUrl } | { status, rejectionReason }
 */
import apiClient from './client';
import type { Store } from './stores';
import type { CloudFile } from '../components/useImageUpload';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type DocType = 'gst' | 'fssai' | 'tradeLicence';
export type IdentityType = 'aadhaar' | 'pan' | 'dl' | 'passport';

export interface VerificationDoc {
  type: string;
  url: string;              // legacy public URL (empty for new private uploads)
  publicId?: string;        // private (authenticated) Cloudinary asset
  format?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

/** Store owner's personal identity — govt ID + selfie, reviewed with the store doc. */
export interface IdentityDoc {
  type?: string;
  docUrl?: string;          // legacy public URLs (empty for new private uploads)
  docPublicId?: string;
  docFormat?: string;
  selfieUrl?: string;
  selfiePublicId?: string;
  selfieFormat?: string;
  submittedAt?: string;
}

/** Result of a private KYC upload — identifiers only, never a public URL. */
export interface KycUploadResult {
  publicId: string;
  format?: string;
  version?: number;
}

/** On-demand signed URLs for a store's KYC media (null where absent). */
export interface KycUrls {
  doc: string | null;
  id: string | null;
  selfie: string | null;
}

/** Owner account, surfaced only on the admin verification queue for KYC matching. */
export interface StoreOwner {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

/** Extended Store with seller-only fields from the v2 storeModel. */
export interface SellerStore extends Store {
  ownerId?: string;
  owner?: StoreOwner | null;
  followerCount?: number;
  isLive?: boolean;
  verificationStatus?: VerificationStatus;
  verificationDoc?: VerificationDoc;
  identityDoc?: IdentityDoc;
}

/**
 * Either part may be sent alone; the store flips to 'pending' once both exist.
 * New clients send private Cloudinary publicIds (+ format); the *Url fields are
 * legacy and left unset for secure uploads.
 */
export interface SubmitVerificationPayload {
  docType?: DocType;
  docUrl?: string;
  docPublicId?: string;
  docFormat?: string;
  identityType?: IdentityType;
  identityDocUrl?: string;
  identityDocPublicId?: string;
  identityDocFormat?: string;
  selfieUrl?: string;
  selfiePublicId?: string;
  selfieFormat?: string;
}

export const verificationAPI = {
  /**
   * GET /api/stores/mine
   * Returns the authenticated seller's own store (with products populated).
   * Returns null if the seller hasn't created a store yet.
   */
  getMyStore: async (): Promise<SellerStore | null> => {
    try {
      const res = await apiClient.get('/api/stores/mine');
      // Backend shape is { status, data: { store } }; be robust to a flatter
      // { store } too. NOTE: res.data.data (the wrapper) must NOT be returned.
      return res.data?.data?.store ?? res.data?.store ?? null;
    } catch (err: any) {
      // 404 means no store yet — not an error for our callers
      if (err?.status === 404) return null;
      throw err;
    }
  },

  /**
   * PATCH /api/stores/:id/verification
   * Seller submits a verification document. Backend sets status → 'pending'.
   */
  submitVerification: async (
    storeId: string,
    payload: SubmitVerificationPayload,
  ): Promise<SellerStore> => {
    const res = await apiClient.patch(`/api/stores/${storeId}/verification`, payload);
    return res.data?.store ?? res.data?.data;
  },

  /**
   * POST /api/stores/kyc/upload — upload one KYC image as a PRIVATE asset.
   * Returns identifiers (publicId + format) to submit with the verification; the
   * raw image is never publicly reachable via a plain URL.
   */
  kycUpload: async (file: CloudFile): Promise<KycUploadResult> => {
    const fd = new FormData();
    fd.append('file', file as any);
    const res = await apiClient.post('/api/stores/kyc/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = res.data?.data;
    if (!data?.publicId) throw new Error('Upload did not return a document id.');
    return data as KycUploadResult;
  },

  /**
   * GET /api/stores/:id/kyc — freshly-signed, inline-renderable URLs for a
   * store's KYC media. Owner (own store) or admin only; minted on demand, never
   * stored. Returns null for a slot with no document.
   */
  getStoreKycUrls: async (storeId: string): Promise<KycUrls> => {
    const res = await apiClient.get(`/api/stores/${storeId}/kyc`);
    const data = res.data?.data ?? {};
    return { doc: data.doc ?? null, id: data.id ?? null, selfie: data.selfie ?? null };
  },

  // ── Admin-only ────────────────────────────────────────────────────────────

  /**
   * GET /api/stores?verificationStatus=pending,rejected&limit=100
   * Returns stores whose verification is pending or rejected (admin review queue).
   * Pass statuses=[] to get all.
   */
  adminListVerifications: async (
    statuses: VerificationStatus[] = ['pending', 'rejected'],
  ): Promise<SellerStore[]> => {
    const params: Record<string, string> = {};
    if (statuses.length > 0) params.status = statuses.join(',');
    // Protected admin endpoint — returns the private verification + identity docs
    // (the public /api/stores strips them).
    const res = await apiClient.get('/api/stores/admin/verifications', { params });
    return (res.data?.data?.stores ?? res.data?.stores ?? []) as SellerStore[];
  },

  /**
   * PATCH /api/stores/:id/verification
   * Admin approves, rejects, or re-opens (→ 'pending') a store verification.
   */
  adminSetStatus: async (
    storeId: string,
    status: 'verified' | 'rejected' | 'pending',
    rejectionReason?: string,
  ): Promise<void> => {
    const body: Record<string, string> = { status };
    if (rejectionReason) body.rejectionReason = rejectionReason;
    await apiClient.patch(`/api/stores/${storeId}/verification`, body);
  },
};
