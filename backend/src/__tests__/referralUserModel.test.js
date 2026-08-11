import { describe, it, expect } from '@jest/globals';
import User from '../modules/users/userModel.js';

describe('User referralStatus', () => {
  it('is an indexed pending/confirmed/expired enum with no default', () => {
    const p = User.schema.path('referralStatus');
    expect(p).toBeTruthy();
    expect(p.enumValues).toEqual(['pending', 'confirmed', 'expired']);
    expect(p.options.default).toBeUndefined();
    expect(p.options.index).toBe(true);
  });
});
