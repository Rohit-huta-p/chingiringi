// Rows created under instant-credit have no `status` and were already paid →
// mark them confirmed so dashboard confirmed-coin sums include them. Run once.
import dotenv from 'dotenv'; dotenv.config();
import mongoose from 'mongoose';
import ShareEvent from '../modules/shares/shareModel.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await ShareEvent.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'confirmed' } },
  );
  console.log(`[backfill] marked ${r.modifiedCount} legacy shares confirmed`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
