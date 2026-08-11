import { describe, it, expect } from '@jest/globals';
import AdminSettings from '../modules/admin/adminSettingsModel.js';

describe('AdminSettings share-economy defaults', () => {
  it('defaults coinsPerShare=50, maxSharesPerDay=100, coinsPerRupee=1000', () => {
    const s = new AdminSettings(); // Mongoose applies defaults synchronously, no DB
    expect(s.coinsPerShare).toBe(50);
    expect(s.maxSharesPerDay).toBe(100);
    expect(s.coinsPerRupee).toBe(1000);
  });
});
