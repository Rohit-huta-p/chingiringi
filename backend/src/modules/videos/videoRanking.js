import mongoose from 'mongoose';

export function buildFeedQuery({ cursor, limit } = {}) {
  const filter = { status: 'ready', 'moderation.state': 'approved' };
  if (cursor && mongoose.isValidObjectId(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  const n = Math.min(Math.max(Number(limit) || 5, 1), 20);
  return { filter, sort: { _id: -1 }, limit: n };
}

export function nextCursor(items) {
  if (!items || items.length === 0) return null;
  return String(items[items.length - 1]._id);
}

export function clampWatchSec(value, durationSec) {
  const cap = durationSec > 0 ? durationSec : 3600;
  const v = Number(value) || 0;
  return Math.max(0, Math.min(v, cap));
}
