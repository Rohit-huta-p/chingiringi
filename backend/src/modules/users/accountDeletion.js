import User from './userModel.js';
import Wallet from '../wallet/walletModel.js';
import Address from '../addresses/addressModel.js';
import Notification from '../notifications/notificationModel.js';
import Review from '../reviews/reviewModel.js';

// Permanently delete a user and the personal data tied to their account.
//
// Transaction / click / share / payout records are intentionally NOT deleted:
// the Privacy Policy retains them for accounting, tax, and fraud-prevention, and
// once the User document is gone they reference only a dangling userId
// (pseudonymous). Used by BOTH the in-app deletion and the web (email-verified)
// deletion so the two paths stay in sync.
export async function deleteUserAndData(userId) {
  await Promise.all([
    Wallet.deleteMany({ userId }),
    Address.deleteMany({ userId }),
    Notification.deleteMany({ userId }),
    Review.deleteMany({ user: userId }),
  ]);
  await User.findByIdAndDelete(userId);
}
