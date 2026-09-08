/**
 * One-off migration: remove the retired `username` field from the users
 * collection and drop its unique index.
 *
 * The `username` field was removed from the app (login is email-only now).
 * Existing documents still carry stored usernames and MongoDB still holds the
 * `username_1` unique index — this script cleans both. Safe to re-run.
 *
 * Usage:
 *   node src/scripts/dropUsername.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

async function run() {
  await connectDB();
  const coll = mongoose.connection.db.collection('users');

  // 1. Drop the username unique index if it exists.
  const indexes = await coll.indexes();
  const usernameIdx = indexes.find(
    (i) => i.key && Object.prototype.hasOwnProperty.call(i.key, 'username')
  );
  if (usernameIdx) {
    await coll.dropIndex(usernameIdx.name);
    console.log(`🗑️  Dropped index: ${usernameIdx.name}`);
  } else {
    console.log('ℹ️  No username index found (already gone).');
  }

  // 2. Unset the username field on every document that still has it.
  const res = await coll.updateMany(
    { username: { $exists: true } },
    { $unset: { username: '' } }
  );
  console.log(`🧹 Unset username on ${res.modifiedCount} document(s).`);

  await mongoose.disconnect();
  console.log('✅ Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
