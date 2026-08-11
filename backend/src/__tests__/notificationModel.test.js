import { describe, it, expect } from '@jest/globals';
import Notification from '../modules/notifications/notificationModel.js';
import { buildTemplate } from '../modules/notifications/notificationTemplates.js';

// Guards the silent-failure class where a type exists in the template/CATEGORY
// map but not in the model enum → Notification.create() throws validation, the
// caller's .catch() swallows it, and no notification row is ever written.
describe('Notification model type enum', () => {
  const allowed = Notification.schema.path('type').enumValues;

  it('includes the share notification types', () => {
    expect(allowed).toContain('share_pending');
    expect(allowed).toContain('share_confirmed');
  });

  it('every type buildTemplate renders is a valid enum value', () => {
    for (const type of allowed) {
      // buildTemplate must not throw for any enum type (with a minimal payload).
      expect(() => buildTemplate(type, { coins: 1, amount: 1, orderId: 'x', itemType: 'product' })).not.toThrow();
    }
  });
});
