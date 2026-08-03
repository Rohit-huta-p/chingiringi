import { describe, it, expect } from '@jest/globals';
import { evaluateShareQuota, istDayBucket } from '../modules/shares/shareService.js';

describe('evaluateShareQuota', () => {
  it('allows a share under the cap', () => {
    expect(evaluateShareQuota({ todayCount: 0, maxSharesPerDay: 100 })).toEqual({ ok: true });
    expect(evaluateShareQuota({ todayCount: 99, maxSharesPerDay: 100 }).ok).toBe(true);
  });
  it('rejects at/over the cap with DAILY_LIMIT', () => {
    const r = evaluateShareQuota({ todayCount: 100, maxSharesPerDay: 100 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('DAILY_LIMIT');
  });
});

describe('istDayBucket', () => {
  it('rolls to the next day at IST midnight, not UTC', () => {
    // 2026-08-03 20:00 UTC == 2026-08-04 01:30 IST → IST day is the 4th
    expect(istDayBucket(new Date('2026-08-03T20:00:00Z'))).toBe('2026-08-04');
    // 2026-08-03 10:00 UTC == 2026-08-03 15:30 IST → still the 3rd
    expect(istDayBucket(new Date('2026-08-03T10:00:00Z'))).toBe('2026-08-03');
  });
});
