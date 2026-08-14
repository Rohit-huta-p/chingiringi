import mongoose from 'mongoose';

// "Block the creator" — hides ALL of blockedUser's clips from user's feed.
const videoBlockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  blockedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

videoBlockSchema.index({ user: 1, blockedUser: 1 }, { unique: true });

export default mongoose.model('VideoBlock', videoBlockSchema);
