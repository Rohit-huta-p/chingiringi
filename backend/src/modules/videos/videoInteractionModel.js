import mongoose from 'mongoose';

const videoInteractionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  type: { type: String, enum: ['like', 'save'], required: true },
}, { timestamps: true });

videoInteractionSchema.index({ user: 1, video: 1, type: 1 }, { unique: true });

export default mongoose.model('VideoInteraction', videoInteractionSchema);
