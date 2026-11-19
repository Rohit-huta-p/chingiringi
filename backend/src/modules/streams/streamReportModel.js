import mongoose from 'mongoose';

// A viewer's report on a live stream. One per (stream, reporter) — the unique
// index makes re-reports idempotent (mirrors videoReportModel). `reportedUser`
// snapshots the broadcaster (stream.ownerId) so moderation can act on the
// person, not just this single stream. Rows are the audit trail: who / why /
// when, and how it was resolved.
const streamReportSchema = new mongoose.Schema({
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true, index: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: {
    type: String,
    enum: ['spam', 'inappropriate', 'violence', 'hate', 'misleading', 'copyright', 'other'],
    required: true,
  },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
}, { timestamps: true });

streamReportSchema.index({ stream: 1, reporter: 1 }, { unique: true });
streamReportSchema.index({ status: 1, _id: -1 }); // admin queue reads

export default mongoose.model('StreamReport', streamReportSchema);
