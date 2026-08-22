import Follow from './followModel.js';
import Store from '../stores/storeModel.js';

/**
 * POST /api/stores/:id/follow
 * Authenticated buyer follows a store.
 */
export const followStore = async (req, res) => {
  const userId  = req.user._id;
  const storeId = req.params.id;

  // Verify store exists
  const store = await Store.findById(storeId);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  // upsert to avoid race-condition duplicates (the unique index is the real guard)
  const doc = await Follow.findOneAndUpdate(
    { userId, storeId },
    { userId, storeId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const isNew = doc.createdAt.getTime() > Date.now() - 2000; // created within last 2 s
  if (isNew) {
    // Increment followerCount atomically
    await Store.findByIdAndUpdate(storeId, { $inc: { followerCount: 1 } });
  }

  res.status(200).json({ message: 'Following store', storeId, following: true });
};

/**
 * DELETE /api/stores/:id/follow
 * Authenticated buyer unfollows a store.
 */
export const unfollowStore = async (req, res) => {
  const userId  = req.user._id;
  const storeId = req.params.id;

  const deleted = await Follow.findOneAndDelete({ userId, storeId });
  if (deleted) {
    // Decrement followerCount, floor at 0
    await Store.findByIdAndUpdate(storeId, [
      { $set: { followerCount: { $max: [0, { $subtract: ['$followerCount', 1] }] } } },
    ]);
  }

  res.status(200).json({ message: 'Unfollowed store', storeId, following: false });
};

/**
 * GET /api/users/me/following
 * Returns all stores the authenticated user follows.
 */
export const getFollowing = async (req, res) => {
  const userId = req.user._id;

  const follows = await Follow.find({ userId })
    .populate('storeId', 'name shortName logoUrl category city isLive followerCount')
    .sort({ createdAt: -1 })
    .lean();

  const stores = follows.map((f) => f.storeId).filter(Boolean);
  res.status(200).json({ stores });
};
