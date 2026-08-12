import { describe, it, expect } from '@jest/globals';
import AdminSettings from '../modules/admin/adminSettingsModel.js';

describe('AdminSettings referral knobs', () => {
  it('schema defaults are 25000 / 5000', () => {
    const path = AdminSettings.schema.path('coinsPerReferralReferrer');
    expect(path).toBeTruthy();
    expect(path.options.default).toBe(25000);
    expect(AdminSettings.schema.path('coinsPerReferralReferee').options.default).toBe(5000);
  });
});
