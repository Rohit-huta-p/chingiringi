import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../modules/users/userModel.js';

/*
 * Wipe the database down to admin accounts only, for a clean real-data start.
 *
 * SAFE BY DEFAULT: with no flags this is a DRY RUN — it prints the admins it
 * would keep and the per-collection counts it would delete, and changes
 * nothing. You must pass --confirm to actually delete.
 *
 * Usage:
 *   node src/scripts/resetToAdminOnly.js                     # dry run (audit)
 *   node src/scripts/resetToAdminOnly.js --confirm           # delete users + activity
 *   node src/scripts/resetToAdminOnly.js --confirm --include-content
 *                                                            # also wipe deals/products/etc
 *
 * Always kept: admin users, their wallets, and AdminSettings (economy +
 * Razorpay config). Never touched unless --include-content: deals, products,
 * categories, banners, coupons.
 */

const CONFIRM = process.argv.includes('--confirm');
const INCLUDE_CONTENT = process.argv.includes('--include-content');

const line = (c = '─') => c.repeat(64);

// Collections wiped for everyone-but-admins (user + activity data).
// key = collection name, filter = what to delete (adminIds injected below).
const activityPlan = (adminIds) => ([
  { name: 'users',        filter: { _id: { $nin: adminIds } },    label: 'Users (non-admin)' },
  { name: 'wallets',      filter: { userId: { $nin: adminIds } }, label: 'Wallets (non-admin)' },
  { name: 'transactions', filter: { userId: { $nin: adminIds } }, label: 'Transactions (non-admin)' },
  { name: 'clickevents',  filter: {},                             label: 'Click events (all)' },
  { name: 'reportimports',filter: {},                             label: 'Report imports (all)' },
]);

// Content collections — only wiped with --include-content.
const contentPlan = [
  { name: 'deals',        filter: {}, label: 'Deals' },
  { name: 'products',     filter: {}, label: 'Products' },
  { name: 'categories',   filter: {}, label: 'Categories' },
  { name: 'banners',      filter: {}, label: 'Banners' },
  { name: 'coupons',      filter: {}, label: 'Coupons' },
  { name: 'couponusages', filter: {}, label: 'Coupon usages' },
];

async function run() {
  await connectDB();
  const db = mongoose.connection.db;

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  // ── Admins to keep ────────────────────────────────────────────────────────
  const admins = await User.find({ role: 'admin' }).select('name email phone _id').lean();
  const adminIds = admins.map((a) => a._id);

  console.log(`\n${line('═')}`);
  console.log('  RESET TO ADMIN-ONLY  ' + (CONFIRM ? '(LIVE — DELETING)' : '(DRY RUN — no changes)'));
  console.log(`${line('═')}\n`);

  console.log(`✅ Admins kept (${admins.length}):`);
  if (admins.length === 0) {
    console.log('   ⚠️  NO admin users found (role="admin"). Aborting — refusing to wipe every user.');
    process.exit(1);
  }
  admins.forEach((a) => console.log(`   • ${a.name} — ${a.email || a.phone || a._id}  (id=${a._id})`));
  console.log('');

  const plan = [
    ...activityPlan(adminIds),
    ...(INCLUDE_CONTENT ? contentPlan : []),
  ];

  console.log(`${INCLUDE_CONTENT ? 'Activity + CONTENT' : 'Activity'} collections targeted:\n`);

  let grandTotal = 0;
  for (const step of plan) {
    if (!existing.has(step.name)) {
      console.log(`   ${step.label.padEnd(26)} — collection missing, skipped`);
      continue;
    }
    const coll = db.collection(step.name);
    const willDelete = await coll.countDocuments(step.filter);
    const total = await coll.countDocuments({});
    grandTotal += willDelete;
    console.log(`   ${step.label.padEnd(26)} delete ${String(willDelete).padStart(6)} / ${total} total`);

    if (CONFIRM && willDelete > 0) {
      const res = await coll.deleteMany(step.filter);
      console.log(`   ${''.padEnd(26)} ↳ deleted ${res.deletedCount}`);
    }
  }

  if (!INCLUDE_CONTENT) {
    console.log('\n   (content kept: deals, products, categories, banners, coupons —');
    console.log('    re-run with --include-content to wipe those too)');
  }
  console.log('\n   (always kept: AdminSettings — economy + Razorpay config)');

  console.log(`\n${line()}`);
  if (CONFIRM) {
    console.log(`  DONE. Deleted ${grandTotal} documents. DB is now admin-only.`);
  } else {
    console.log(`  DRY RUN. ${grandTotal} documents WOULD be deleted.`);
    console.log('  Re-run with --confirm to execute.');
  }
  console.log(line());
  console.log('');
  process.exit(0);
}

run().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
