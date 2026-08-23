/**
 * verification.ts — Seller store management & verification API.
 *
 * Routes (built by E1 in Sprint 2):
 *   GET  /api/stores/mine              → { store } (seller's own store + products)
 *   PATCH /api/stores/:id/verification → { docType, docUrl } | { status, rejectionReason }
 */
import apiClient from './client';
import type { Store } from './stores';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type DocType = 'gst' | 'fssai' | 'tradeLicence';

export interface VerificationDoc {
  type: string;
  url: string;
  submittedAt?: string;
  rejectionReason?: string;
}

/** Extended Store with seller-only fields from the v2 storeModel. */
export interface SellerStore extends Store {
  ownerId?: string;
  followerCount?: number;
  isLive?: boolean;
  verificationStatus?: VerificationStatus;
  verificationDoc?: VerificationDoc;
}

export interface SubmitVerificationPayload {
  docType: DocType;
  docUrl: string;
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
      return res.data?.store ?? res.data?.data ?? null;
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

  // ── Admin-only ────────────────────────────────────────────────────────────

  /**
   * GET /api/stores?verificationStatus=pending,rejected&limit=100
   * Returns stores whose verification is pending or rejected (admin review queue).
   * Pass statuses=[] to get all.
   */
  adminListVerifications: async (
    statuses: VerificationStatus[] = ['pending', 'rejected'],
  ): Promise<SellerStore[]> => {
    const params: Record<string, string> = { limit: '100', sort: '-updatedAt' };
    if (statuses.length > 0) params.verificationStatus = statuses.join(',');
    const res = await apiClient.get('/api/stores', { params });
    return (res.data?.data?.stores ?? res.data?.stores ?? []) as SellerStore[];
  },

  /**
   * PATCH /api/stores/:id/verification
   * Admin approves or rejects a store verification.
   */
  adminSetStatus: async (
    storeId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string,
  ): Promise<void> => {
    const body: Record<string, string> = { status };
    if (rejectionReason) body.rejectionReason = rejectionReason;
    await apiClient.patch(`/api/stores/${storeId}/verification`, body);
  },
};
