// Pending shares nobody opened within the window never pay. Cron hourly/daily:
//   node src/scripts/expirePendingShares.js   (npm run cron:expire-shares)
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import ShareEvent from '../modules/shares/shareModel.js';

const DAYS = Number(process.env.SHARE_PENDING_DAYS) || 30;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const r = await ShareEvent.updateMany(
    { status: 'pending', createdAt: { $lt: cutoff } },
    { $set: { status: 'expired' } },
  );
  console.log(`[expire-shares] expired ${r.modifiedCount} pending shares older than ${DAYS}d`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
