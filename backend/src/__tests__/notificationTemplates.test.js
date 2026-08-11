import { describe, it, expect } from '@jest/globals';
import { buildTemplate } from '../modules/notifications/notificationTemplates.js';

describe('buildTemplate — share notifications', () => {
  it('share_pending', () => {
    expect(buildTemplate('share_pending', { coins: 50 })).toEqual({
      title: 'Share registered ⏳',
      body: '50 CR pending — unlocks when a friend opens your link.',
    });
  });
  it('share_confirmed', () => {
    expect(buildTemplate('share_confirmed', { coins: 50, itemType: 'product' })).toEqual({
      title: 'Your share paid off 🎉',
      body: 'Someone opened your shared product — 50 CR added to your wallet.',
    });
  });
});
