/**
 * One-off migration: align existing store categories with the new taxonomy.
 *
 * The store category taxonomy was replaced (see storeModel.js STORE_CATEGORIES).
 * Mapping of the old 8 values:
 *   • Electronics, Sports, Beauty  → unchanged (identical in the new list)
 *   • Jewellery                    → 'Jewellery & Watches'  (only clean remap)
 *   • Fashion, Grocery,            → LEFT AS-IS by product decision. The new
 *     Food & Cafe, Health            taxonomy has no equivalent, so these stay
 *                                     as valid CUSTOM (free-text) categories;
 *                                     their sellers can re-pick from the
 *                                     dropdown next time they edit their store.
 *
 * This script performs only the Jewellery remap and reports how many stores
 * still sit on a retired value. Idempotent — safe to re-run.
 *
 * Usage:
 *   node src/scripts/migrateStoreCategories.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const REMAP = { Jewellery: 'Jewellery & Watches' };
const LEFT_AS_CUSTOM = ['Fashion', 'Grocery', 'Food & Cafe', 'Health'];

async function run() {
  await connectDB();
  const coll = mongoose.connection.db.collection('stores');

  let total = 0;
  for (const [from, to] of Object.entries(REMAP)) {
    const res = await coll.updateMany({ category: from }, { $set: { category: to } });
    total += res.modifiedCount;
    console.log(`🔁 ${from} → ${to}: ${res.modifiedCount} store(s) updated.`);
  }

  // Report (but do NOT touch) stores still on a retired value — these are now
  // custom categories by design.
  for (const c of LEFT_AS_CUSTOM) {
    const n = await coll.countDocuments({ category: c });
    if (n) console.log(`ℹ️  ${n} store(s) remain on "${c}" (kept as a custom category).`);
  }

  console.log(`✅ Done. Remapped ${total} store(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
