import mongoose from 'mongoose';

// Flat comments on a video (no threads, no likes). Mirrors reviewModel, minus the
// rating and the per-user uniqueness (a user may comment many times).
const videoCommentSchema = new mongoose.Schema({
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, trim: true, required: true, maxlength: 500 },
}, { timestamps: true });

// List a video's comments newest-first + cursor-paginate on _id.
videoCommentSchema.index({ video: 1, _id: -1 });

export default mongoose.model('VideoComment', videoCommentSchema);
