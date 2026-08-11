/**
 * Copy templates for each notification type. Pure function: given a type and
 * its data payload, returns the { title, body } shown in-app and pushed to
 * the device. Keeping copy here (not inline in notificationService.js) means
 * a future admin/localization pass only has to touch this file.
 */
export function buildTemplate(type, data) {
  switch (type) {
    case 'coins_credited':
      return {
        title: 'Cashback on the way 🎉',
        body: `${data.coins} coins from order ${data.orderId} are pending — they unlock in 30 days.`,
      };
    case 'coins_unlocked':
      return {
        title: 'Coins unlocked ✅',
        body: `${data.coins} coins are now available to withdraw.`,
      };
    case 'withdrawal_submitted':
      return {
        title: 'Withdrawal requested',
        body: `Your ₹${data.amount} withdrawal is being processed.`,
      };
    case 'withdrawal_paid':
      return {
        title: 'Withdrawal paid 💸',
        body: `₹${data.amount} has been sent to your ${data.method || 'account'}.`,
      };
    case 'withdrawal_rejected':
      return {
        title: 'Withdrawal rejected',
        body: `Your ₹${data.amount} withdrawal was rejected. Your coins were not debited.`,
      };
    case 'wallet_credited':
      return {
        title: 'Balance added 🎉',
        body:
          data.currency === 'coins'
            ? `${data.amount} coins have been added to your wallet.`
            : `₹${data.amount} has been added to your wallet.`,
      };
    case 'share_pending':
      return {
        title: 'Share registered ⏳',
        body: `${data.coins} CR pending — unlocks when a friend opens your link.`,
      };
    case 'share_confirmed':
      return {
        title: 'Your share paid off 🎉',
        body: `Someone opened your shared ${data.itemType} — ${data.coins} CR added to your wallet.`,
      };
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}
