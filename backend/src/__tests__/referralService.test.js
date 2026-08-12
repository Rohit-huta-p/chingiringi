import { describe, it, expect } from '@jest/globals';
import { pickStoreUrl, canApplyReferral, referralConfirmDecision, APPLY_WINDOW_MS } from '../modules/referrals/referralService.js';

const URLS = { ios: 'IOS', android: 'AND', web: 'WEB' };

describe('pickStoreUrl', () => {
  it('routes by device UA, defaults to web', () => {
    expect(pickStoreUrl('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', URLS)).toBe('IOS');
    expect(pickStoreUrl('Mozilla/5.0 (iPad)', URLS)).toBe('IOS');
    expect(pickStoreUrl('Mozilla/5.0 (Linux; Android 14)', URLS)).toBe('AND');
    expect(pickStoreUrl('Mozilla/5.0 (Windows NT 10.0)', URLS)).toBe('WEB');
    expect(pickStoreUrl('', URLS)).toBe('WEB');
  });
});

describe('canApplyReferral', () => {
  const base = { referrerId: 'A', refereeId: 'B', refereeReferredBy: null, refereeCreatedAtMs: 1000, nowMs: 1000, windowMs: APPLY_WINDOW_MS };
  it('accepts a fresh, un-referred, non-self referee', () => {
    expect(canApplyReferral(base)).toEqual({ ok: true, reason: 'ok' });
  });
  it('rejects a missing referrer (invalid code)', () => {
    expect(canApplyReferral({ ...base, referrerId: null })).toEqual({ ok: false, reason: 'invalid_code' });
  });
  it('rejects self-referral', () => {
    expect(canApplyReferral({ ...base, refereeId: 'A' })).toEqual({ ok: false, reason: 'self' });
  });
  it('rejects an already-referred user', () => {
    expect(canApplyReferral({ ...base, refereeReferredBy: 'X' })).toEqual({ ok: false, reason: 'already_referred' });
  });
  it('rejects an account older than the apply window', () => {
    expect(canApplyReferral({ ...base, nowMs: 1000 + APPLY_WINDOW_MS + 1 })).toEqual({ ok: false, reason: 'too_old' });
  });
});

describe('referralConfirmDecision', () => {
  const base = { status: 'pending', refereeCreatedAtMs: 1000, nowMs: 1000, lockDays: 30 };
  it('confirms a fresh pending referral', () => {
    expect(referralConfirmDecision(base)).toEqual({ confirm: true, reason: 'ok' });
  });
  it('does not confirm a non-pending referral', () => {
    expect(referralConfirmDecision({ ...base, status: 'confirmed' })).toEqual({ confirm: false, reason: 'not_pending' });
    expect(referralConfirmDecision({ ...base, status: undefined })).toEqual({ confirm: false, reason: 'not_pending' });
  });
  it('expires a pending referral past the lock window', () => {
    const past = 1000 + 31 * 24 * 60 * 60 * 1000;
    expect(referralConfirmDecision({ ...base, nowMs: past })).toEqual({ confirm: false, reason: 'expired' });
  });
});
