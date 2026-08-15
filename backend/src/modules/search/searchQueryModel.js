import mongoose from 'mongoose';

/**
 * Stores every unique normalized search query with an occurrence count.
 * All searches are logged (not just misses). lastResultCount = 0 marks a true
 * miss — filter for it in the admin screen to see what to stock next.
 *
 * q is normalized before storage: lowercased, trimmed, whitespace collapsed.
 * This collapses "Bluetooth ", "bluetooth", "BLUETOOTH" into one row.
 *
 * No userId stored — the aggregate is the point; per-user search history is a
 * privacy liability with no use here.
 */
const searchQuerySchema = new mongoose.Schema(
  {
    q:               { type: String, required: true, trim: true, unique: true },
    count:           { type: Number, default: 1, min: 0 },
    lastResultCount: { type: Number, default: 0, min: 0 },
    lastSeenAt:      { type: Date,   default: Date.now },
  },
  { timestamps: false },
);

searchQuerySchema.index({ count: -1 });

export default mongoose.model('SearchQuery', searchQuerySchema);
