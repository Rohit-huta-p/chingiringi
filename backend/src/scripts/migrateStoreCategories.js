/**
 * One-off migration: align existing store categories with the new taxonomy.
 *
 * The store category taxonomy was replaced (see storeModel.js STORE_CATEGORIES).
 * All store data is test data, so retired values are remapped to their nearest
 * canonical category (rather than kept as custom) — this keeps the taxonomy AND
 * the GET /api/stores/categories suggestion list (canonical ∪ distinct in-use)
 * clean, so no retired value resurfaces as a suggestion:
 *   • Electronics, Sports, Beauty → unchanged (already canonical)
 *   • Jewellery    → 'Jewellery & Watches'
 *   • Fashion      → "Women's Fashion"
 *   • Health       → 'Beauty'
 *   • Grocery      → 'Wholesale & Deals'   (no direct equivalent — general bucket)
 *   • Food & Cafe  → 'Wholesale & Deals'   (no direct equivalent — general bucket)
 *
 * Idempotent — safe to re-run (reports 0 updated once clean).
 *
 * Usage:
 *   node src/scripts/migrateStoreCategories.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const REMAP = {
  Jewellery: 'Jewellery & Watches',
  Fashion: "Women's Fashion",
  Health: 'Beauty',
  Grocery: 'Wholesale & Deals',
  'Food & Cafe': 'Wholesale & Deals',
};

async function run() {
  await connectDB();
  const coll = mongoose.connection.db.collection('stores');

  let total = 0;
  for (const [from, to] of Object.entries(REMAP)) {
    const res = await coll.updateMany({ category: from }, { $set: { category: to } });
    total += res.modifiedCount;
    console.log(`🔁 ${from} → ${to}: ${res.modifiedCount} store(s) updated.`);
  }

  // Sanity check: nothing should remain on a retired value.
  const retired = Object.keys(REMAP);
  const leftover = await coll.countDocuments({ category: { $in: retired } });
  console.log(`✅ Done. Remapped ${total} store(s). Remaining on retired values: ${leftover}.`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
