/**
 * Purge a single user and ALL of their data from the database.
 *
 * Given an email (or phone / userId), this finds the account and removes every
 * document that belongs to, is created by, or is about that user across all
 * collections — wallet, addresses, transactions, notifications, follows,
 * clicks, shares, reviews, coupon redemptions, video content/interactions,
 * streams, stores, OTPs — and finally the user document itself.
 *
 * References on SHARED / independent documents (coupons created by the user,
 * videos an admin reviewed, other users' `referredBy`) are UNSET rather than
 * deleted, so real data owned by others is never destroyed.
 *
 * ReportImport rows are an immutable audit trail by design; this script only
 * REPORTS matches there and leaves them intact unless --purge-audit is passed.
 *
 * SAFE BY DEFAULT: with no flag it is a DRY RUN — it counts and prints exactly
 * what it would remove, and changes nothing. Pass --confirm to actually delete.
 *
 * Usage:
 *   node src/scripts/purgeUser.js test_live@gmail.com            # dry run (report only)
 *   node src/scripts/purgeUser.js test_live@gmail.com --confirm  # actually delete
 *   node src/scripts/purgeUser.js test_live@gmail.com --confirm --purge-audit
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

import User from '../modules/users/userModel.js';
import Wallet from '../modules/wallet/walletModel.js';
import Address from '../modules/addresses/addressModel.js';
import Transaction from '../modules/transactions/transactionModel.js';
import Notification from '../modules/notifications/notificationModel.js';
import Follow from '../modules/follows/followModel.js';
import ClickEvent from '../modules/clicks/clickModel.js';
import ShareEvent from '../modules/shares/shareModel.js';
import ShareClick from '../modules/shares/shareClickModel.js';
import Review from '../modules/reviews/reviewModel.js';
import CouponRedemption from '../modules/coupons/couponRedemptionModel.js';
import Coupon from '../modules/coupons/couponModel.js';
import VideoComment from '../modules/videos/videoCommentModel.js';
import VideoInteraction from '../modules/videos/videoInteractionModel.js';
import VideoReport from '../modules/videos/videoReportModel.js';
import VideoBlock from '../modules/videos/videoBlockModel.js';
import Video from '../modules/videos/videoModel.js';
import Stream from '../modules/streams/streamModel.js';
import Store from '../modules/stores/storeModel.js';
import OTP from '../modules/otp/otpModel.js';
import ReportImport from '../modules/admin/reportImportModel.js';

const arg = process.argv[2];
const CONFIRM = process.argv.includes('--confirm');
const PURGE_AUDIT = process.argv.includes('--purge-audit');

const line = (c = '─') => c.repeat(66);

async function findUser(ident) {
  if (!ident) return null;
  if (mongoose.isValidObjectId(ident)) {
    const byId = await User.findById(ident);
    if (byId) return byId;
  }
  return User.findOne({
    $or: [{ phone: ident }, { email: String(ident).toLowerCase() }],
  });
}

async function run() {
  if (!arg) {
    console.log('\nUsage: node src/scripts/purgeUser.js <email|phone|userId> [--confirm] [--purge-audit]\n');
    process.exit(1);
  }

  await connectDB();

  const user = await findUser(arg);
  if (!user) {
    console.log(`\n⚠️  No user matched "${arg}". Nothing to do.\n`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const uid = user._id;
  const email = user.email;

  // Videos the user OWNS — needed to cascade-clean interactions on them.
  const ownedVideos = await Video.find({ createdBy: uid }).select('_id').lean();
  const ownedVideoIds = ownedVideos.map((v) => v._id);

  // ── DELETE targets: documents wholly owned by / about the user ────────────
  // Each entry: [label, Model, filter]
  const deletions = [
    ['wallets',             Wallet,           { userId: uid }],
    ['addresses',           Address,          { userId: uid }],
    ['transactions',        Transaction,      { userId: uid }],
    ['notifications',       Notification,     { userId: uid }],
    ['follows',             Follow,           { userId: uid }],
    ['clickevents',         ClickEvent,       { userId: uid }],
    ['shareevents',         ShareEvent,       { userId: uid }],
    ['shareclicks',         ShareClick,       { sharerUserId: uid }],
    ['reviews',             Review,           { user: uid }],
    ['couponredemptions',   CouponRedemption, { user: uid }],
    ['videocomments (by user)',        VideoComment,     { user: uid }],
    ['videointeractions (by user)',    VideoInteraction, { user: uid }],
    ['videoreports (by user)',         VideoReport,      { reporter: uid }],
    ['videoblocks (by user)',          VideoBlock,       { user: uid }],
    ['videoblocks (against user)',     VideoBlock,       { blockedUser: uid }],
    ['streams (owned)',     Stream,           { ownerId: uid }],
    ['stores (owned)',      Store,            { ownerId: uid }],
    ['videos (created by user)',       Video,            { createdBy: uid }],
    ['otps (by email)',     OTP,              { email }],
  ];

  // Cascade: other users' interactions/comments/reports/blocks on the videos
  // this user created (so deleting their videos leaves no orphans).
  if (ownedVideoIds.length) {
    deletions.push(
      ['videocomments (on user videos)',     VideoComment,     { video: { $in: ownedVideoIds } }],
      ['videointeractions (on user videos)', VideoInteraction, { video: { $in: ownedVideoIds } }],
      ['videoreports (on user videos)',      VideoReport,      { video: { $in: ownedVideoIds } }],
      ['videoblocks (on user videos)',       VideoBlock,       { video: { $in: ownedVideoIds } }],
    );
  }

  // ── UNSET targets: shared docs that merely reference the user ─────────────
  // Each entry: [label, Model, filter, updateOp]
  const unsets = [
    ['coupons.createdBy → null',     Coupon, { createdBy: uid }, { $set: { createdBy: null } }],
    ['videos.reviewedBy unset',      Video,  { reviewedBy: uid }, { $unset: { reviewedBy: '' } }],
    ['videos.createdByAdmin unset',  Video,  { createdByAdmin: uid }, { $unset: { createdByAdmin: '' } }],
    ['users.referredBy unset (other users)', User, { referredBy: uid }, { $unset: { referredBy: '', referralStatus: '' } }],
  ];

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\n${line('═')}`);
  console.log(`  PURGE USER  —  ${CONFIRM ? '⚠️  LIVE (deletions WILL run)' : 'DRY RUN (no changes)'}`);
  console.log(`${line('═')}\n`);
  console.log(`👤 Matched user:`);
  console.log(`     name:   ${user.name}`);
  console.log(`     email:  ${user.email}`);
  console.log(`     phone:  ${user.phone || '—'}`);
  console.log(`     role:   ${user.role}`);
  console.log(`     _id:    ${uid}\n`);

  console.log(line());
  console.log('  DELETE (documents owned by / about this user)');
  console.log(line());

  let totalToDelete = 0;
  const delPlan = [];
  for (const [label, Model, filter] of deletions) {
    const count = await Model.countDocuments(filter);
    delPlan.push({ label, Model, filter, count });
    totalToDelete += count;
    if (count > 0) console.log(`   ${String(count).padStart(5)}  ${label}`);
  }
  console.log(`   ${'─'.repeat(5)}`);
  console.log(`   ${String(totalToDelete).padStart(5)}  total documents  (+ 1 user document)\n`);

  console.log(line());
  console.log('  UNSET (references on shared docs — data preserved, ref cleared)');
  console.log(line());
  const unsetPlan = [];
  for (const [label, Model, filter, op] of unsets) {
    const count = await Model.countDocuments(filter);
    unsetPlan.push({ label, Model, filter, op, count });
    if (count > 0) console.log(`   ${String(count).padStart(5)}  ${label}`);
  }
  if (!unsetPlan.some((u) => u.count > 0)) console.log('   (none)');
  console.log('');

  // ReportImport audit trail — report always, purge only if asked.
  const auditCount = await ReportImport.countDocuments({ 'rows.matchedUserId': uid });
  const importedByCount = await ReportImport.countDocuments({ importedBy: uid });
  console.log(line());
  console.log('  AUDIT TRAIL (ReportImport — immutable by design)');
  console.log(line());
  console.log(`   ${String(auditCount).padStart(5)}  import records with a row matched to this user`);
  console.log(`   ${String(importedByCount).padStart(5)}  import records imported BY this user`);
  console.log(`          ${PURGE_AUDIT ? '→ will UNSET matched refs (--purge-audit)' : '→ left intact (pass --purge-audit to scrub matched refs)'}\n`);

  if (!CONFIRM) {
    console.log(line('═'));
    console.log('  DRY RUN — nothing was changed.');
    console.log('  Re-run with --confirm to perform the deletions above.');
    console.log(line('═'), '\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  console.log(line('═'));
  console.log('  EXECUTING…');
  console.log(line('═'), '\n');

  for (const { label, Model, filter, count } of delPlan) {
    if (count === 0) continue;
    const res = await Model.deleteMany(filter);
    console.log(`   🗑️  deleted ${String(res.deletedCount).padStart(5)}  ${label}`);
  }

  for (const { label, Model, filter, op, count } of unsetPlan) {
    if (count === 0) continue;
    const res = await Model.updateMany(filter, op);
    console.log(`   ✏️  updated ${String(res.modifiedCount).padStart(5)}  ${label}`);
  }

  if (PURGE_AUDIT && auditCount > 0) {
    const res = await ReportImport.updateMany(
      { 'rows.matchedUserId': uid },
      { $set: { 'rows.$[r].matchedUserId': null } },
      { arrayFilters: [{ 'r.matchedUserId': uid }] },
    );
    console.log(`   ✏️  scrubbed matchedUserId in ${res.modifiedCount} import record(s)`);
  }

  // Finally, the user document itself.
  await User.deleteOne({ _id: uid });
  console.log(`   🗑️  deleted     1  user document (${email})\n`);

  console.log(line('═'));
  console.log(`  ✅ Purge complete for ${email}`);
  console.log(line('═'), '\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('\nPurge failed:', err);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
