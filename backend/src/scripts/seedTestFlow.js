import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../modules/users/userModel.js';
import Category from '../modules/categories/categoryModel.js';
import Deal from '../modules/deals/dealModel.js';
import Wallet from '../modules/wallet/walletModel.js';
import ClickEvent from '../modules/clicks/clickModel.js';
import AdminSettings from '../modules/admin/adminSettingsModel.js';

/*
 * End-to-end affiliate-flow smoke test.
 *
 * Sets up two TEST deals (one Cuelinks, one Amazon) and prints a ready-to-paste
 * merchant CSV keyed to a real user's ID, so you can walk the full arc:
 *
 *   add product  →  user clicks Shop Now  →  paste report  →  coins credited
 *
 * Usage:
 *   npm run seed:test-flow -- <phone | email | username | userId>
 *   npm run seed:test-flow -- 9876543210 --with-click
 *
 *   --with-click  also inserts a ClickEvent (simulates the Shop Now tap) so the
 *                 deal-linkage / promo-override path is exercised too. Without
 *                 it, crediting still works purely from the cr_<userId> subid.
 *
 * Re-runnable: deals upsert by title; each run prints a fresh orderId so the
 * importer never rejects it as a duplicate.
 */

const arg = process.argv[2];
const withClick = process.argv.includes('--with-click');

const line = (c = '─') => c.repeat(64);

async function findUser(ident) {
  if (!ident) return null;
  if (mongoose.isValidObjectId(ident)) {
    const byId = await User.findById(ident);
    if (byId) return byId;
  }
  return User.findOne({
    $or: [{ phone: ident }, { email: String(ident).toLowerCase() }, { username: ident }],
  });
}

async function run() {
  await connectDB();

  // ── 1. Resolve the user ──────────────────────────────────────────────────
  const user = await findUser(arg);
  if (!user) {
    console.log(`\n⚠️  No user matched "${arg || '(none passed)'}".`);
    console.log('\nPass a phone / email / username / userId. Pick one below:\n');
    const users = await User.find().select('name phone email username role').limit(10).lean();
    if (users.length === 0) {
      console.log('   (no users in DB — sign up in the app first)');
    } else {
      users.forEach((u) => {
        console.log(`   • ${u.name.padEnd(18)} ${(u.phone || u.email || u.username || u._id).toString().padEnd(24)} [${u.role}]  id=${u._id}`);
      });
    }
    console.log('\n   e.g.  npm run seed:test-flow -- 9876543210\n');
    process.exit(0);
  }

  // ── 2. Ensure a category exists (Deal.category is required) ───────────────
  let category = await Category.findOne();
  if (!category) {
    category = await Category.create({ name: 'Fashion', slug: 'fashion', icon: 'shirt', sortOrder: 1 });
  }

  // ── 3. Upsert two TEST deals ──────────────────────────────────────────────
  const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const cuelinksDeal = await Deal.findOneAndUpdate(
    { title: "TEST — Levi's 511 Jeans (Cuelinks)" },
    {
      $set: {
        title: "TEST — Levi's 511 Jeans (Cuelinks)",
        description: 'Test deal to verify the affiliate → coins flow via the Cuelinks aggregator.',
        brand: 'Myntra',
        category: category._id,
        cashbackPercent: 8,
        affiliateUrl: 'https://www.myntra.com/jeans/levis/levis-men-511-slim-fit-jeans/12345/buy',
        viaCuelinks: true,
        coinsReward: 0, // 0 → uses the commission × passThrough × rate formula
        lockPeriodDays: 30,
        expiresAt: in90,
        isActive: true,
        isFeatured: true,
        tags: ['test'],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const amazonDeal = await Deal.findOneAndUpdate(
    { title: 'TEST — Amazon Echo Dot (Direct)' },
    {
      $set: {
        title: 'TEST — Amazon Echo Dot (Direct)',
        description: 'Test deal to verify the direct Amazon Associates flow.',
        brand: 'Amazon',
        category: category._id,
        cashbackPercent: 4,
        affiliateUrl: 'https://www.amazon.in/dp/B09B8V1LZ3',
        viaCuelinks: false,
        coinsReward: 0,
        lockPeriodDays: 30,
        expiresAt: in90,
        isActive: true,
        isFeatured: true,
        tags: ['test'],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const subid = `cr_${user._id}`;

  // ── 4. Optionally simulate the Shop Now click ─────────────────────────────
  if (withClick) {
    await ClickEvent.create({
      userId: user._id,
      dealId: cuelinksDeal._id,
      merchant: 'cuelinks',
      source: 'test_script',
      originalUrl: cuelinksDeal.affiliateUrl,
      redirectedTo: `https://linksredirect.com/?cid=TESTPUB&source=linkkit&url=${encodeURIComponent(cuelinksDeal.affiliateUrl)}&subid=${subid}`,
      subid,
    });
  }

  // ── 5. Current wallet snapshot ────────────────────────────────────────────
  const wallet = await Wallet.findOne({ userId: user._id });

  // ── 6. Live settings → accurate expected-coins math ───────────────────────
  const settings = await AdminSettings.get();
  const commission = 179.14;
  const expectedCoins = Math.round(commission * settings.passThroughPercent * settings.coinsPerRupee);

  // ── 7. Fresh order id + ready-to-paste CSV ────────────────────────────────
  const orderId = `TEST-CUE-${Date.now().toString(36).toUpperCase()}`;
  const csv =
    `order_id,subid,amount,commission,status\n` +
    `${orderId},${subid},2799,${commission},confirmed`;

  // ── Print the playbook ────────────────────────────────────────────────────
  console.log(`\n${line('═')}`);
  console.log('  AFFILIATE FLOW — END-TO-END TEST');
  console.log(`${line('═')}\n`);

  console.log(`👤 User:     ${user.name}  (${user.phone || user.email || user.username})`);
  console.log(`   userId:   ${user._id}`);
  console.log(`   role:     ${user.role}`);
  console.log(`   wallet:   coins=${wallet?.coins ?? 0}  pendingCoins=${wallet?.pendingCoins ?? 0}\n`);

  console.log(`💰 Economy:  passThrough=${settings.passThroughPercent * 100}%  rate=${settings.coinsPerRupee} coins/₹  lock=${settings.defaultLockDays}d\n`);

  console.log('🛍️  Test deals created (visible in the app / admin Deals):');
  console.log(`   • Cuelinks : ${cuelinksDeal.title}`);
  console.log(`               dealId=${cuelinksDeal._id}`);
  console.log(`   • Amazon   : ${amazonDeal.title}`);
  console.log(`               dealId=${amazonDeal._id}\n`);

  if (withClick) {
    console.log('🖱️  Simulated a Shop Now click on the Cuelinks deal (ClickEvent inserted).\n');
  }

  console.log(line());
  console.log('  STEPS');
  console.log(line());
  console.log(`
  1. (optional) Open the app as ${user.name} → find the "TEST — Levi's…"
     deal → tap Shop Now. This logs a real ClickEvent + rewrites the URL.
     (Skip if you passed --with-click, or skip entirely — the paste below
      credits coins purely from the cr_<userId> subid.)

  2. Open Admin → Wallet Ops → Reports tab.
       · Merchant chip:  Cuelinks (aggregator)
       · Paste the CSV below
       · Parse Report  →  you should see 1 row, green "subid ✓",
                          ≈ ${expectedCoins} coins
       · Import

  3. Open the user's Wallet → you should see +${expectedCoins} PENDING coins.
     (Pending because of the ${settings.defaultLockDays}-day lock. Run
      \`npm run cron:confirm-locks\` after moving the lock date to confirm.)
`);

  console.log(line());
  console.log('  PASTE THIS CSV (Cuelinks merchant):');
  console.log(line());
  console.log(`\n${csv}\n`);

  console.log(line());
  console.log(`  EXPECTED:  ₹${commission} commission → ${expectedCoins} pending coins`);
  console.log(`             (${commission} × ${settings.passThroughPercent} × ${settings.coinsPerRupee} = ${expectedCoins})`);
  console.log(line());
  console.log('');

  process.exit(0);
}

run().catch((err) => {
  console.error('Test-flow setup failed:', err);
  process.exit(1);
});
