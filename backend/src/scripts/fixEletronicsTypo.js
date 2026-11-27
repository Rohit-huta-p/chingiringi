/**
 * One-off fix: correct the misspelled product category "eletronics" → "Electronics".
 *
 * `product.category` is a free-text String that references a Category by name, so
 * the typo lives in TWO collections and both must move together:
 *   • categories: rename the mis-spelled doc (name + slug) — OR, if a correctly
 *     spelled "Electronics" category already exists, drop the typo doc (merge).
 *   • products:   remap every product on an "eletronics" variant to "Electronics".
 *
 * Only the missing-"c" typo is touched (/^eletronics$/i); the correct spelling is
 * left alone. Idempotent — safe to re-run (reports 0 once clean).
 *
 * Usage:
 *   node src/scripts/fixEletronicsTypo.js           # dry run — prints the plan only
 *   node src/scripts/fixEletronicsTypo.js --apply    # perform the fix
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const TARGET_NAME = 'Electronics';
const TARGET_SLUG = 'electronics';
const TYPO_RE = /^eletronics$/i; // the missing-"c" typo, any casing — NOT "electronics"

const APPLY = process.argv.includes('--apply');

async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  const categories = db.collection('categories');
  const products = db.collection('products');

  // ── Inspect ────────────────────────────────────────────────────────────
  const typoCats = await categories.find({ name: { $regex: TYPO_RE } }).toArray();
  const correctCat = await categories.findOne({ name: { $regex: /^electronics$/i } });
  const slugClash = await categories.findOne({ slug: TARGET_SLUG });
  const prodTypoCount = await products.countDocuments({ category: { $regex: TYPO_RE } });
  const distinctCats = await products.distinct('category', { category: { $regex: /eletronic/i } });

  console.log('─── Inspection ──────────────────────────────');
  console.log('Typo category doc(s):',
    typoCats.map((c) => ({ _id: String(c._id), name: c.name, slug: c.slug, color: c.color, isActive: c.isActive })));
  console.log('Existing correct "Electronics" doc:',
    correctCat ? { _id: String(correctCat._id), name: correctCat.name, slug: correctCat.slug } : null);
  console.log('Doc already on slug "electronics":',
    slugClash ? { _id: String(slugClash._id), name: slugClash.name } : null);
  console.log('Products on an "eletronics" variant:', prodTypoCount);
  console.log('Distinct product category values matching /eletronic/i:', distinctCats);

  if (!typoCats.length && !prodTypoCount) {
    console.log('✅ Nothing to fix — no "eletronics" category or products found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Plan ──────────────────────────────────────────────────────────────
  const willMerge = !!correctCat; // correct doc already exists → drop the typo doc(s)
  console.log('─── Plan ────────────────────────────────────');
  console.log(`Products: set category → "${TARGET_NAME}" (${prodTypoCount} doc(s)).`);
  if (willMerge) {
    console.log(`Categories: "Electronics" already exists → DELETE the ${typoCats.length} typo doc(s) after remapping products (merge).`);
  } else if (typoCats.length) {
    console.log(`Categories: rename the typo doc → name="${TARGET_NAME}", slug="${TARGET_SLUG}".`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to perform the fix.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Apply ──────────────────────────────────────────────────────────────
  const pr = await products.updateMany({ category: { $regex: TYPO_RE } }, { $set: { category: TARGET_NAME } });
  console.log(`🔁 Products remapped: ${pr.modifiedCount}`);

  if (willMerge) {
    const dr = await categories.deleteMany({ _id: { $in: typoCats.map((c) => c._id) } });
    console.log(`🗑️  Typo category doc(s) deleted (merged into existing Electronics): ${dr.deletedCount}`);
  } else if (typoCats.length) {
    const [keep, ...dupes] = typoCats;
    await categories.updateOne({ _id: keep._id }, { $set: { name: TARGET_NAME, slug: TARGET_SLUG } });
    console.log(`✏️  Category renamed: "${keep.name}" → "${TARGET_NAME}"`);
    if (dupes.length) {
      const dr = await categories.deleteMany({ _id: { $in: dupes.map((d) => d._id) } });
      console.log(`🗑️  Extra duplicate typo doc(s) removed: ${dr.deletedCount}`);
    }
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  const leftoverProds = await products.countDocuments({ category: { $regex: TYPO_RE } });
  const leftoverCats = await categories.countDocuments({ name: { $regex: TYPO_RE } });
  const finalCat = await categories.findOne({ name: TARGET_NAME });
  console.log('─── Verify ──────────────────────────────────');
  console.log(`Products still on a typo value: ${leftoverProds}`);
  console.log(`Category doc(s) still on a typo value: ${leftoverCats}`);
  console.log('Final Electronics category:',
    finalCat ? { _id: String(finalCat._id), name: finalCat.name, slug: finalCat.slug } : null);
  console.log(leftoverProds === 0 && leftoverCats === 0 ? '✅ Clean.' : '⚠️  Leftovers remain — check above.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
