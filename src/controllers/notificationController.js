import { ValidationError } from '../utils/errors.js';
import {
  createNotification,
  fetchUserNotifications,
  markNotificationRead,
  deleteNotification,
  fetchUnreadCount,
  markAllRead,
  subscribeToNotifications,
  unsubscribeFromNotifications
} from '../services/notificationservice.js';

// GET /api/notifications
export const handleGetNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const notifications = await fetchUserNotifications({
      userId: req.user.id,
      status,
      page: Number(page),
      limit: Number(limit)
    });

    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/unread-count
export const handleGetUnreadCount = async (req, res, next) => {
  try {
    const count = await fetchUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications
export const handleCreateNotification = async (req, res, next) => {
  try {
    const { userId, type, title, message, data } = req.body;

    // Only admin and health roles can create notifications for others
    if (userId !== req.user.id && !['admin', 'health'].includes(req.user.role)) {
      throw new ValidationError('Unauthorized to create notifications for other users');
    }

    const notification = await createNotification({
      userId,
      type,
      title,
      message,
      data,
      createdBy: req.user.id
    });

    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
export const handleMarkRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await markNotificationRead(id, req.user.id);
    res.json(notification);
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/mark-all-read
export const handleMarkAllRead = async (req, res, next) => {
  try {
    await markAllRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notifications/:id
export const handleDeleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteNotification(id, req.user.id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/subscribe
export const handleSubscribe = async (req, res, next) => {
  try {
    const { types } = req.body;
    
    if (!Array.isArray(types)) {
      throw new ValidationError('Types must be an array');
    }

    const subscription = await subscribeToNotifications(req.user.id, types);
    res.json(subscription);
  } catch (err) {
    next(err);
  }
};

// POST /api/notifications/unsubscribe
export const handleUnsubscribe = async (req, res, next) => {
  try {
    const { types } = req.body;
    
    if (!Array.isArray(types)) {
      throw new ValidationError('Types must be an array');
    }

    const subscription = await unsubscribeFromNotifications(req.user.id, types);
    res.json(subscription);
  } catch (err) {
    next(err);
  }
};

// Helper function to send push notification
export const sendPushNotification = async (userId, notification) => {
  try {
    // Implementation will depend on your push notification service
    // This could use Firebase Cloud Messaging, OneSignal, etc.
    const userDevices = await getUserDevices(userId);
    
    for (const device of userDevices) {
      await sendToDevice(device.token, {
        title: notification.title,
        body: notification.message,
        data: notification.data
      });
    }
  } catch (err) {
    console.error('Push Notification Error:', err);
  }
}; 