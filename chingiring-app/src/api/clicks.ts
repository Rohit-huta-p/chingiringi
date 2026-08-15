import apiClient from './client';

/**
 * Click-tracking client. Call clicksAPI.log right before opening any affiliate
 * URL to get back a subid-rewritten URL that the merchant report can echo back
 * to us. Works for both authenticated and anonymous users — anonymous clicks
 * still log (with an anon subid) so the data is there once they sign in.
 *
 * Caller pattern:
 *   try {
 *     const { redirectUrl } = await clicksAPI.log({ dealId, source: 'home' });
 *     Linking.openURL(redirectUrl);
 *   } catch {
 *     // Don't break the click flow if logging fails — fall back to raw URL.
 *     Linking.openURL(deal.affiliateUrl);
 *   }
 */
export interface LogClickPayload {
  dealId?: string;
  productId?: string;
  url?: string;
  source?: string;
  merchant?: string;      // for merchant fallback search chips
  searchQuery?: string;   // for merchant fallback search chips
}

export interface LogClickResult {
  clickId: string;
  redirectUrl: string;
}

export const clicksAPI = {
  log: async (payload: LogClickPayload): Promise<LogClickResult> => {
    const res = await apiClient.post('/api/clicks/log', payload);
    return res.data?.data || { clickId: '', redirectUrl: '' };
  },
};
