import { describe, it, expect } from '@jest/globals';
import { evaluateShareConfirm, isLikelyBot } from '../modules/shares/shareConfirm.js';

const base = { status: 'pending', sharerIp: '1.1.1.1', visitorIp: '2.2.2.2', visitorUa: 'Mozilla/5.0 (iPhone)', ageSeconds: 60 };

describe('isLikelyBot', () => {
  it('flags known preview crawlers, passes real browsers', () => {
    expect(isLikelyBot('facebookexternalhit/1.1')).toBe(true);
    expect(isLikelyBot('WhatsApp/2.23')).toBe(true);
    expect(isLikelyBot('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false);
    expect(isLikelyBot('')).toBe(true); // no UA → treat as bot
  });
});

describe('evaluateShareConfirm', () => {
  it('confirms a different-IP human open after the delay', () => {
    expect(evaluateShareConfirm(base)).toEqual({ confirm: true, reason: 'ok' });
  });
  it('rejects the sharer opening their own link (same IP)', () => {
    expect(evaluateShareConfirm({ ...base, visitorIp: '1.1.1.1' })).toEqual({ confirm: false, reason: 'self_ip' });
  });
  it('rejects preview-bot opens', () => {
    expect(evaluateShareConfirm({ ...base, visitorUa: 'facebookexternalhit/1.1' })).toEqual({ confirm: false, reason: 'bot' });
  });
  it('rejects opens within the min-age window', () => {
    expect(evaluateShareConfirm({ ...base, ageSeconds: 3 })).toEqual({ confirm: false, reason: 'too_soon' });
  });
  it('rejects when already confirmed', () => {
    expect(evaluateShareConfirm({ ...base, status: 'confirmed' })).toEqual({ confirm: false, reason: 'already_confirmed' });
  });
  it('rejects when no visitor IP is known', () => {
    expect(evaluateShareConfirm({ ...base, visitorIp: '' })).toEqual({ confirm: false, reason: 'no_visitor_ip' });
  });
  it('returns the most-specific reason when several conditions fail at once', () => {
    // confirmed beats bot+self_ip+too_soon
    expect(evaluateShareConfirm({ ...base, status: 'confirmed', visitorUa: 'facebookexternalhit/1.1', visitorIp: base.sharerIp, ageSeconds: 1 }))
      .toEqual({ confirm: false, reason: 'already_confirmed' });
    // bot beats self_ip+too_soon
    expect(evaluateShareConfirm({ ...base, visitorUa: 'WhatsApp/2', visitorIp: base.sharerIp, ageSeconds: 1 }))
      .toEqual({ confirm: false, reason: 'bot' });
  });
  it('covers expired and unknown-status reasons', () => {
    expect(evaluateShareConfirm({ ...base, status: 'expired' })).toEqual({ confirm: false, reason: 'expired' });
    expect(evaluateShareConfirm({ ...base, status: 'weird' })).toEqual({ confirm: false, reason: 'not_found' });
  });
  it('fails closed when ageSeconds is missing/NaN', () => {
    expect(evaluateShareConfirm({ ...base, ageSeconds: undefined })).toEqual({ confirm: false, reason: 'too_soon' });
  });
});
