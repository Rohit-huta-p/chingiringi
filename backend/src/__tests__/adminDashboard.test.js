import { describe, it, expect } from '@jest/globals';
import { pctDelta, dayWindows, trendDays, fillTrend } from '../modules/admin/dashboardStats.js';

describe('pctDelta', () => {
  it('computes signed percent to 1dp', () => {
    expect(pctDelta(120, 100)).toBe(20);
    expect(pctDelta(80, 100)).toBe(-20);
    expect(pctDelta(133, 120)).toBe(10.8);
  });
  it('returns null when prior is zero/absent (no baseline)', () => {
    expect(pctDelta(5, 0)).toBeNull();
    expect(pctDelta(5, undefined)).toBeNull();
  });
});

describe('dayWindows', () => {
  it('derives IST day boundaries around now', () => {
    const w = dayWindows(new Date('2026-08-09T06:00:00Z')); // 11:30 IST on the 9th
    expect(w.today).toBe('2026-08-09');
    expect(w.yesterday).toBe('2026-08-08');
    expect(w.start30).toBe('2026-07-11'); // 29 days before today = 30-day inclusive window
    expect(w.start60).toBe('2026-06-11'); // start of the prior 30-day window
  });
});

describe('trendDays + fillTrend', () => {
  it('zero-fills gaps and preserves order and labels', () => {
    const days = trendDays(new Date('2026-08-09T06:00:00Z'), 3); // Aug 7,8,9 IST
    const filled = fillTrend(days, [{ _id: '2026-08-08', shares: 4 }]);
    expect(filled.map((d) => d.shares)).toEqual([0, 4, 0]);
    expect(filled[2].label).toBe('Aug 9');
  });
});
