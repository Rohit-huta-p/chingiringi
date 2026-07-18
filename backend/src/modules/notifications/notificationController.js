import Notification from './notificationModel.js';
import User from '../users/userModel.js';

// @desc    List the authenticated user's notifications (newest-first, paginated)
// @route   GET /api/notifications
// @access  Private
export const list = async (req, res) => {
  const { limit, before } = req.query;
  const userId = req.user._id;

  const filter = {
    userId,
    ...(before ? { createdAt: { $lt: before } } : {}),
  };

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(+limit || 30, 100))
    .lean();

  res.status(200).json({ status: 'success', data: { notifications } });
};

// @desc    Count the authenticated user's unread notifications
// @route   GET /api/notifications/unread-count
// @access  Private
export const unreadCount = async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    read: false,
  });

  res.status(200).json({ status: 'success', data: { count } });
};

// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markRead = async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, userId: req.user._id },
    { $set: { read: true, readAt: new Date() } }
  );

  res.status(200).json({ status: 'success', message: 'Notification marked as read' });
};

// @desc    Mark all of the authenticated user's notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllRead = async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  res.status(200).json({ status: 'success', message: 'All notifications marked as read' });
};

// @desc    Register (or refresh) an Expo push token for the authenticated user
// @route   POST /api/notifications/push-token
// @access  Private
export const registerPushToken = async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user._id;

  if (!token) {
    res.status(400);
    throw new Error('token is required');
  }

  // Dedupe: drop any existing entry for this token, then re-add it fresh so
  // platform/updatedAt stay current and the same token never appears twice.
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });
  await User.updateOne(
    { _id: userId },
    { $push: { pushTokens: { token, platform, updatedAt: new Date() } } }
  );

  res.status(200).json({ status: 'success', message: 'Push token registered' });
};

// @desc    Unregister a push token for the authenticated user
// @route   DELETE /api/notifications/push-token
// @access  Private
export const unregisterPushToken = async (req, res) => {
  const { token } = req.body;
  const userId = req.user._id;

  if (!token) {
    res.status(400);
    throw new Error('token is required');
  }

  await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token } } });

  res.status(200).json({ status: 'success', message: 'Push token unregistered' });
};
