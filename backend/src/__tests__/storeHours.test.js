import { describe, it, expect } from '@jest/globals';
import { parseTime, formatTime, isOpenNow } from '../modules/stores/storeHours.js';

describe('storeHours', () => {
  it('parseTime handles valid and invalid input', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('22:00')).toBe(1320);
    expect(parseTime('7:5')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it('formatTime renders 12-hour clock', () => {
    expect(formatTime('22:00')).toBe('10:00 PM');
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('00:15')).toBe('12:15 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('nope')).toBe('');
  });

  it('isOpenNow respects a same-day window', () => {
    // Wed 2026-07-22, 14:00
    const now = new Date(2026, 6, 22, 14, 0);
    expect(isOpenNow('10:00', '22:00', [], now)).toBe(true);
    expect(isOpenNow('10:00', '13:00', [], now)).toBe(false);
  });

  it('isOpenNow respects open days', () => {
    const wed = new Date(2026, 6, 22, 14, 0); // getDay() === 3
    expect(isOpenNow('10:00', '22:00', [1, 2, 3, 4, 5], wed)).toBe(true);
    expect(isOpenNow('10:00', '22:00', [0, 6], wed)).toBe(false);
  });

  it('isOpenNow handles an overnight window', () => {
    const lateNight = new Date(2026, 6, 22, 1, 0); // 01:00
    expect(isOpenNow('18:00', '02:00', [], lateNight)).toBe(true);
    const midday = new Date(2026, 6, 22, 12, 0);
    expect(isOpenNow('18:00', '02:00', [], midday)).toBe(false);
  });
});
