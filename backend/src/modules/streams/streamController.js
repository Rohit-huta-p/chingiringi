import Stream from './streamModel.js';

/**
 * GET /api/streams/active
 * Returns all currently-live streams sorted by viewerCount desc.
 * Public — no auth required.
 */
export const getActiveStreams = async (req, res) => {
  const streams = await Stream.find({ status: 'live' })
    .populate('storeId', 'name shortName logoUrl category city')
    .sort({ viewerCount: -1 })
    .lean();

  res.status(200).json({ status: 'success', data: { streams } });
};
