import { Expo } from 'expo-server-sdk';
import Notification from './notificationModel.js';
import User from '../users/userModel.js';
import { buildTemplate } from './notificationTemplates.js';

const expo = new Expo();

// Maps a notification type to the notificationPrefs category that gates it.
const CATEGORY = {
  coins_credited: 'cashback',
  coins_unlocked: 'cashback',
  withdrawal_submitted: 'withdrawals',
  withdrawal_paid: 'withdrawals',
  withdrawal_rejected: 'withdrawals',
};

/**
 * Create an in-app notification for a user and (best-effort) push it to
 * their devices. Respects the user's notificationPrefs:
 *  - category pref (cashback/withdrawals) === false  -> no row, no push
 *  - push pref === false                              -> row only, no push
 *
 * Push delivery is fire-and-forget: it never rejects/throws back to the
 * caller, so a down Expo API or a bad token can't block the trigger site
 * (e.g. a wallet credit) that called notify().
 *
 * `awaitPush` (default false): on the long-lived server, push is fire-and-forget
 * so it adds no request latency. Short-lived scripts (e.g. the confirm-locks
 * cron, which calls process.exit() right after its loop) must pass
 * `awaitPush: true` — otherwise process.exit() kills the in-flight Expo POST
 * before it's sent and the push is silently dropped. Awaiting is safe: the push
 * promise is `.catch()`-guarded, so it can never throw back into the caller.
 */
export async function notify({ userId, type, data }, { awaitPush = false } = {}) {
  const user = await User.findById(userId).select('pushTokens notificationPrefs').lean();
  if (!user) return null;

  const prefs = user.notificationPrefs || {};
  if (prefs[CATEGORY[type]] === false) return null;

  const { title, body } = buildTemplate(type, data);
  const notif = await Notification.create({ userId, type, title, body, data });

  if (prefs.push !== false && user.pushTokens?.length) {
    const pushed = sendPush(user, { title, body, data }).catch(() => {});
    if (awaitPush) await pushed;
  }

  return notif;
}

/**
 * Sends a push message to every valid Expo push token on the user, batched
 * through Expo's chunking helper. Never throws — errors are swallowed per
 * chunk so one bad chunk doesn't stop the others, and the caller also
 * wraps this call in .catch(() => {}) as a second safety net.
 */
async function sendPush(user, { title, body, data }) {
  const messages = user.pushTokens
    .filter((entry) => Expo.isExpoPushToken(entry?.token))
    .map((entry) => ({ to: entry.token, title, body, data }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const token = chunk[i].to;
          User.updateOne({ _id: user._id }, { $pull: { pushTokens: { token } } }).catch(() => {});
        }
      });
    } catch {
      // Network/API failure for this chunk — skip it, try the rest.
    }
  }
}
