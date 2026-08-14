import mongoose from 'mongoose';

// A user's report on a video. One per (video, reporter) — the unique index makes
// re-reports idempotent. Doubles as the reporter's personal hide-list (the feed
// excludes clips you've reported). Rows are the audit trail: who / why / when,
// and how it was resolved.
const videoReportSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: {
    type: String,
    enum: ['spam', 'inappropriate', 'violence', 'hate', 'misleading', 'copyright', 'other'],
    required: true,
  },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
}, { timestamps: true });

videoReportSchema.index({ video: 1, reporter: 1 }, { unique: true });
videoReportSchema.index({ status: 1, _id: -1 }); // admin queue reads

export default mongoose.model('VideoReport', videoReportSchema);
