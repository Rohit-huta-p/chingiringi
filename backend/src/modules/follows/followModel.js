import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate follows; also speeds up isFollowing lookups
followSchema.index({ userId: 1, storeId: 1 }, { unique: true });
// Fast "get all follows for a user"
followSchema.index({ userId: 1 });

const Follow = mongoose.model('Follow', followSchema);

export default Follow;
