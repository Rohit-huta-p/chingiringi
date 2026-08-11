import { describe, it, expect } from '@jest/globals';
import { buildTemplate } from '../modules/notifications/notificationTemplates.js';

describe('buildTemplate — share notifications', () => {
  it('share_pending', () => {
    expect(buildTemplate('share_pending', { coins: 50 })).toEqual({
      title: 'Reward on the way 🚀',
      body: '50 CR is pending — it unlocks the moment a friend opens your link.',
    });
  });
  it('share_confirmed', () => {
    expect(buildTemplate('share_confirmed', { coins: 50, itemType: 'product' })).toEqual({
      title: '50 CR unlocked 🎉',
      body: 'A friend opened your shared product — the coins are in your wallet. Keep sharing to earn more!',
    });
  });
});
