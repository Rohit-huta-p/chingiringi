import 'dotenv/config';
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../modules/users/userModel.js';

// Give any user without a referralCode a unique one. Idempotent; safe to re-run.
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const blanks = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }] }).select('_id');
  let fixed = 0;
  for (const u of blanks) {
    // Retry on the rare unique collision.
    for (let i = 0; i < 5; i++) {
      try {
        u.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        await u.save({ validateBeforeSave: false });
        fixed++;
        break;
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }
    }
  }
  console.log(`Backfilled ${fixed}/${blanks.length} referral codes.`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
