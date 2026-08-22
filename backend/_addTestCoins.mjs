// Temp: top up a user's withdrawable coins for a withdrawal test. DELETE after.
//   dry:  node _addTestCoins.mjs <userId> <rupees> --dry
//   real: node _addTestCoins.mjs <userId> <rupees>
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Wallet from './src/modules/wallet/walletModel.js';
import User from './src/modules/users/userModel.js';
import AdminSettings from './src/modules/admin/adminSettingsModel.js';
import Transaction from './src/modules/transactions/transactionModel.js';

const userId = process.argv[2];
const rupees = Number(process.argv[3] || 10);
const dry = process.argv.includes('--dry');

async function main() {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error(`bad userId: ${userId}`);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('DB:', mongoose.connection.name, '@', mongoose.connection.host);

  const user = await User.findById(userId).select('name email phone').lean();
  if (!user) throw new Error(`user NOT FOUND in this DB: ${userId} (wrong database?)`);

  const settings = await AdminSettings.get();
  // Optionally correct the global rate first: --rate 1000
  const rateArgIdx = process.argv.indexOf('--rate');
  const targetRate = rateArgIdx > -1 ? Number(process.argv[rateArgIdx + 1]) : null;
  if (targetRate && settings.coinsPerRupee !== targetRate) {
    console.log(`coinsPerRupee: ${settings.coinsPerRupee} -> ${targetRate}${dry ? ' (dry)' : ''}`);
    if (!dry) { settings.coinsPerRupee = targetRate; await settings.save(); }
  }
  const rate = targetRate || settings.coinsPerRupee;
  const addCoins = Math.round(rupees * rate);
  const before = (await Wallet.findOne({ userId }).lean())?.coins ?? 0;

  // Will the instant Cashfree payout actually fire on a withdrawal?
  console.log(`payout: provider=${settings.payoutProvider} cashfreeEnabled=${settings.cashfreeEnabled} env=${settings.cashfreeEnv} instant=${settings.instantPayoutEnabled} cap=₹${settings.instantPayoutCapRupees}`);

  console.log('user:', user.name || user.email || user.phone || userId);
  console.log(`coinsPerRupee: ${rate}  |  adding ${addCoins} coins (₹${rupees})`);
  console.log(`coins before: ${before}  (₹${(before / rate).toFixed(2)})`);

  if (dry) { console.log('DRY RUN — no changes made.'); await mongoose.disconnect(); return; }

  await Wallet.updateOne(
    { userId },
    { $inc: { coins: addCoins }, $setOnInsert: { pendingCoins: 0, confirmedCashback: 0, pendingCashback: 0, lifetimeEarned: 0 } },
    { upsert: true },
  );
  await Transaction.create({
    userId, type: 'coin_credit', amount: addCoins, status: 'confirmed',
    description: `Admin test top-up (₹${rupees} withdrawal test)`,
    metadata: { adminTestTopUp: true },
  });

  const after = (await Wallet.findOne({ userId }).lean())?.coins ?? 0;
  console.log(`coins after:  ${after}  (₹${(after / rate).toFixed(2)} withdrawable)`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
