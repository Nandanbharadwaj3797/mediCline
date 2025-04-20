import Notification from '../schema/notificationSchema.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import { validateObjectId } from '../utils/validation.js';

class NotificationRepository {
  async create(data) {
    try {
      const notification = new Notification(data);
      await notification.save();
      return notification;
    } catch (err) {
      console.error('Error in create:', err);
      throw new InternalError('Failed to create notification');
    }
  }

  async createBroadcast(data) {
    try {
      const notification = new Notification({
        ...data,
        isBroadcast: true
      });
      await notification.save();
      return notification;
    } catch (err) {
      console.error('Error in createBroadcast:', err);
      throw new InternalError('Failed to create broadcast notification');
    }
  }

  async findForUser(userId, filters = {}, options = {}) {
    try {
      const { status, type, category, priority, page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const query = {
        $or: [
          { userId },
          {
            isBroadcast: true,
            targetRoles: { $in: filters.roles || [] }
          }
        ]
      };

      if (status) query.status = status;
      if (type) query.type = type;
      if (category) query.category = category;
      if (priority) query.priority = priority;
      if (!filters.includeExpired) {
        query.$or = query.$or.map(condition => ({
          ...condition,
          $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null }
          ]
        }));
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return notifications;
    } catch (err) {
      console.error('Error in findForUser:', err);
      throw new InternalError('Failed to find notifications');
    }
  }

  async countForUser(userId, filters = {}) {
    try {
      const query = {
        $or: [
          { userId },
          {
            isBroadcast: true,
            targetRoles: { $in: filters.roles || [] }
          }
        ]
      };

      if (!filters.includeExpired) {
        query.$or = query.$or.map(condition => ({
          ...condition,
          $or: [
            { expiresAt: { $gt: new Date() } },
            { expiresAt: null }
          ]
        }));
      }

      return await Notification.countDocuments(query);
    } catch (err) {
      console.error('Error in countForUser:', err);
      throw new InternalError('Failed to count notifications');
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      await notification.markAsRead(userId);
      return notification;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      console.error('Error in markAsRead:', err);
      throw new InternalError('Failed to mark notification as read');
    }
  }

  async archive(notificationId, userId) {
    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      await notification.archive(userId);
      return notification;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      console.error('Error in archive:', err);
      throw new InternalError('Failed to archive notification');
    }
  }

  async markAllRead(userId) {
    try {
      await Notification.markAllRead(userId);
      return { success: true };
    } catch (err) {
      console.error('Error in markAllRead:', err);
      throw new InternalError('Failed to mark all notifications as read');
    }
  }

  async getUnreadCount(userId) {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (err) {
      console.error('Error in getUnreadCount:', err);
      throw new InternalError('Failed to get unread count');
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      const result = await Notification.updateOne(
        { userId },
        { $set: { preferences } },
        { upsert: true }
      );
      return { success: true, ...result };
    } catch (err) {
      console.error('Error in updateUserPreferences:', err);
      throw new InternalError('Failed to update preferences');
    }
  }

  async getStatistics(criteria = {}) {
    try {
      const { startDate, endDate, type, category } = criteria;
      const query = {};

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      if (type) query.type = type;
      if (category) query.category = category;

      const stats = await Notification.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              type: '$type',
              category: '$category',
              priority: '$priority'
            },
            count: { $sum: 1 },
            readCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'read'] }, 1, 0]
              }
            }
          }
        }
      ]);

      return stats;
    } catch (err) {
      console.error('Error in getStatistics:', err);
      throw new InternalError('Failed to get statistics');
    }
  }

  async createFromTemplate(type, data) {
    try {
      // Implementation would depend on your template system
      throw new Error('Not implemented');
    } catch (err) {
      console.error('Error in createFromTemplate:', err);
      throw new InternalError('Failed to create from template');
    }
  }
}

// Export a singleton instance
export default new NotificationRepository();
