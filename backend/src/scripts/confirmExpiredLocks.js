import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import Transaction from '../modules/transactions/transactionModel.js';
import Wallet from '../modules/wallet/walletModel.js';

/**
 * Confirmation job — flips lock-expired pending coin_credit transactions
 * from `pending` to `confirmed`, and moves the coin amount from the user's
 * `pendingCoins` bucket into their spendable `coins` balance.
 *
 * Run in production either as:
 *   • A cron job every hour:  0 * * * *  node src/scripts/confirmExpiredLocks.js
 *   • A one-shot manual run:  npm run cron:confirm-locks
 *
 * Testing aid:
 *   • npm run cron:confirm-locks -- --force
 *     Ignores the lock date and confirms ALL pending coin_credits right away,
 *     so you can watch pendingCoins → coins without waiting out the 30-day
 *     window. Never use --force in production.
 *
 * Idempotent — never double-credits. Filters by status='pending' so once a
 * row flips to 'confirmed' it's out of scope on the next run.
 */
const force = process.argv.includes('--force');

async function run() {
  await connectDB();

  const now = new Date();
  const filter = {
    type: 'coin_credit',
    status: 'pending',
    // --force skips the lock-date gate (testing only).
    ...(force ? {} : { 'metadata.lockExpiresAt': { $lte: now } }),
  };
  if (force) console.log('⚠️  --force: confirming ALL pending coin credits regardless of lock date.');
  const expired = await Transaction.find(filter);

  if (!expired.length) {
    console.log('No expired locks to confirm.');
    process.exit(0);
  }

  let confirmedCount = 0;
  let coinsMoved = 0;
  const perUser = new Map(); // userId → coins to move

  for (const tx of expired) {
    tx.status = 'confirmed';
    tx.metadata = { ...(tx.metadata || {}), confirmedAt: now };
    await tx.save();

    const prior = perUser.get(String(tx.userId)) || 0;
    perUser.set(String(tx.userId), prior + tx.amount);

    confirmedCount += 1;
    coinsMoved += tx.amount;
  }

  // Bulk-move pendingCoins → coins per user
  for (const [userId, amt] of perUser.entries()) {
    await Wallet.updateOne(
      { userId },
      { $inc: { pendingCoins: -amt, coins: amt, lifetimeEarned: amt } },
    );
  }

  console.log(`Confirmed ${confirmedCount} transactions across ${perUser.size} users.`);
  console.log(`Total coins moved from pending → confirmed: ${coinsMoved}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Confirm job failed:', err);
  process.exit(1);
});
