import mongoose from 'mongoose';

const shareEventSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemType: { type: String, enum: ['product', 'store'], required: true },
    itemId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    coinsAwarded: { type: Number, required: true },
    // IST calendar-day bucket 'YYYY-MM-DD' — powers daily count + per-item dedup.
    day: { type: String, required: true },
  },
  { timestamps: true },
);

shareEventSchema.index({ userId: 1, day: 1 });                                  // fast daily count
shareEventSchema.index({ userId: 1, itemType: 1, itemId: 1, day: 1 }, { unique: true }); // idempotency: one credit per item per day
shareEventSchema.index({ day: 1 }); // dashboard: bare day-bucket counts (not covered by the userId-prefixed compounds)

const ShareEvent = mongoose.model('ShareEvent', shareEventSchema);
export default ShareEvent;
