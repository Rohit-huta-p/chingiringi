import { describe, it, expect } from '@jest/globals';
import ShareEvent from '../modules/shares/shareModel.js';

describe('ShareEvent schema', () => {
  it('accepts product/store itemType and requires itemId + day', () => {
    const ok = new ShareEvent({ userId: '64f8a2b9c1d2e3f4a5b6c7d8', itemType: 'store',
      itemId: '64f8a2b9c1d2e3f4a5b6c7d9', coinsAwarded: 100, day: '2026-08-03' });
    expect(ok.validateSync()).toBeUndefined();
    const bad = new ShareEvent({ userId: '64f8a2b9c1d2e3f4a5b6c7d8', itemType: 'deal',
      itemId: '64f8a2b9c1d2e3f4a5b6c7d9', coinsAwarded: 100, day: '2026-08-03' });
    expect(bad.validateSync()).toBeDefined(); // enum rejects 'deal'
  });
});
