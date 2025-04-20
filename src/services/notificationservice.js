import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import { validateObjectId, validateString, validateEnum, validateDate } from '../utils/validation.js';
import notificationRepository from '../repository/notificationRepository.js';
import userRepository from '../repository/userRepository.js';

// Constants for validation
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_CATEGORIES = ['operational', 'administrative', 'system', 'emergency'];
const VALID_CHANNELS = ['in_app', 'email', 'sms', 'all'];
const VALID_STATUSES = ['unread', 'read', 'archived'];
const VALID_TYPES = [
  'pickup_request',
  'pickup_assigned',
  'pickup_completed',
  'pickup_cancelled',
  'waste_log_created',
  'waste_log_updated',
  'waste_threshold_exceeded',
  'system_maintenance',
  'emergency_alert',
  'account_update',
  'compliance_alert',
  'report_ready'
];

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_RECIPIENTS = 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

class NotificationService {
  /**
   * Creates a new notification
   * @param {Object} params Notification parameters
   * @returns {Promise<Object>} Created notification
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    data = null,
    createdBy = null,
    priority = 'medium',
    category = 'operational',
    channel = 'in_app',
    recipients = [],
    expiresAt = null
  }) {
    try {
      // Required field validation
      if (!userId || !type || !title || !message) {
        throw new ValidationError('userId, type, title, and message are required');
      }

      // Validate userId and createdBy
      if (!validateObjectId(userId)) {
        throw new ValidationError('Invalid userId');
      }
      if (createdBy && !validateObjectId(createdBy)) {
        throw new ValidationError('Invalid createdBy userId');
      }

      // Validate string fields
      if (!validateString(title, 1, MAX_TITLE_LENGTH)) {
        throw new ValidationError(`Title must be between 1 and ${MAX_TITLE_LENGTH} characters`);
      }
      if (!validateString(message, 1, MAX_MESSAGE_LENGTH)) {
        throw new ValidationError(`Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`);
      }

      // Validate enums
      if (!validateEnum(type, VALID_TYPES)) {
        throw new ValidationError(`Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`);
      }
      if (!validateEnum(priority, VALID_PRIORITIES)) {
        throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }
      if (!validateEnum(category, VALID_CATEGORIES)) {
        throw new ValidationError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }
      if (!validateEnum(channel, VALID_CHANNELS)) {
        throw new ValidationError(`Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`);
      }

      // Validate data object
      if (data && typeof data !== 'object') {
        throw new ValidationError('Data must be an object');
      }

      // Validate expiresAt
      if (expiresAt) {
        if (!validateDate(expiresAt)) {
          throw new ValidationError('Invalid expiration date');
        }
        if (new Date(expiresAt) <= new Date()) {
          throw new ValidationError('Expiration date must be in the future');
        }
      }

      // Check if user exists
      const userExists = await userRepository.exists(userId);
      if (!userExists) {
        throw new NotFoundError('User not found');
      }

      // Validate recipients
      if (recipients.length > 0) {
        if (recipients.length > MAX_RECIPIENTS) {
          throw new ValidationError(`Maximum number of recipients (${MAX_RECIPIENTS}) exceeded`);
        }

        const uniqueRecipients = [...new Set(recipients)];
        const validRecipients = await userRepository.findByIds(uniqueRecipients);

        if (validRecipients.length !== uniqueRecipients.length) {
          throw new ValidationError('One or more recipients not found');
        }

        recipients = uniqueRecipients.map(id => ({ userId: id }));
      }

      return await notificationRepository.create({
        userId,
        type,
        title,
        message,
        data,
        createdBy,
        priority,
        category,
        channel,
        recipients,
        expiresAt
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to create notification', error);
    }
  }

  /**
   * Creates a broadcast notification
   * @param {Object} params Broadcast notification parameters
   * @returns {Promise<Object>} Created broadcast notification
   */
  async createBroadcastNotification({
    type,
    title,
    message,
    targetRoles,
    data = null,
    createdBy = null,
    priority = 'medium',
    category = 'system',
    channel = 'all',
    expiresAt = null
  }) {
    try {
      // Required field validation
      if (!type || !title || !message || !targetRoles?.length) {
        throw new ValidationError('type, title, message, and targetRoles are required');
      }

      // Reuse validation from createNotification
      if (!validateString(title, 1, MAX_TITLE_LENGTH)) {
        throw new ValidationError(`Title must be between 1 and ${MAX_TITLE_LENGTH} characters`);
      }
      if (!validateString(message, 1, MAX_MESSAGE_LENGTH)) {
        throw new ValidationError(`Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`);
      }

      // Additional validation for broadcast-specific fields
      if (!Array.isArray(targetRoles)) {
        throw new ValidationError('targetRoles must be an array');
      }

      return await notificationRepository.createBroadcast({
        type,
        title,
        message,
        targetRoles,
        data,
        createdBy,
        priority,
        category,
        channel,
        expiresAt
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InternalError('Failed to create broadcast notification', error);
    }
  }

  /**
   * Fetches notifications for a user with advanced filtering
   */
  async fetchUserNotifications({
    userId,
    status,
    type,
    category,
    priority,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    includeExpired = false,
    includeRecipients = false
  }) {
    try {
      // Validate required fields
      if (!userId) {
        throw new ValidationError('userId is required');
      }
      if (!validateObjectId(userId)) {
        throw new ValidationError('Invalid userId');
      }

      // Validate enums if provided
      if (status && !validateEnum(status, VALID_STATUSES)) {
        throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      if (type && !validateEnum(type, VALID_TYPES)) {
        throw new ValidationError(`Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`);
      }
      if (category && !validateEnum(category, VALID_CATEGORIES)) {
        throw new ValidationError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
      }
      if (priority && !validateEnum(priority, VALID_PRIORITIES)) {
        throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      // Validate pagination parameters
      page = Math.max(1, parseInt(page));
      limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit)));

      // Check if user exists
      const userExists = await userRepository.exists(userId);
      if (!userExists) {
        throw new NotFoundError('User not found');
      }

      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (category) filters.category = category;
      if (priority) filters.priority = priority;

      const options = {
        sort: { createdAt: -1 },
        skip: (page - 1) * limit,
        limit,
        includeExpired,
        populate: ['createdBy']
      };

      if (includeRecipients) {
        options.populate.push('recipients.userId');
      }

      const [notifications, total] = await Promise.all([
        notificationRepository.findForUser(userId, filters, options),
        notificationRepository.countForUser(userId, filters)
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to fetch notifications', error);
    }
  }

  /**
   * Marks a notification as read
   */
  async markNotificationRead(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new ValidationError('notificationId and userId are required');
      }

      return await notificationRepository.markAsRead(notificationId, userId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to mark notification as read', error);
    }
  }

  /**
   * Archives a notification
   */
  async archiveNotification(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new ValidationError('notificationId and userId are required');
      }

      return await notificationRepository.archive(notificationId, userId);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to archive notification', error);
    }
  }

  /**
   * Marks all notifications as read for a user
   */
  async markAllRead(userId) {
    try {
      if (!userId) {
        throw new ValidationError('userId is required');
      }

      return await notificationRepository.markAllRead(userId);
    } catch (error) {
      throw new InternalError('Failed to mark all notifications as read', error);
    }
  }

  /**
   * Gets unread notification count for a user
   */
  async getUnreadCount(userId) {
    try {
      if (!userId) {
        throw new ValidationError('userId is required');
      }

      return await notificationRepository.getUnreadCount(userId);
    } catch (error) {
      throw new InternalError('Failed to get unread count', error);
    }
  }

  /**
   * Updates user notification preferences
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      if (!userId || !preferences) {
        throw new ValidationError('userId and preferences are required');
      }

      // Validate preferences structure
      for (const [type, channels] of Object.entries(preferences)) {
        if (!VALID_TYPES.includes(type)) {
          throw new ValidationError(`Invalid notification type: ${type}`);
        }
        if (!Array.isArray(channels)) {
          throw new ValidationError(`Channels for type ${type} must be an array`);
        }
        for (const channel of channels) {
          if (!VALID_CHANNELS.includes(channel)) {
            throw new ValidationError(`Invalid channel ${channel} for type ${type}`);
          }
        }
      }

      return await notificationRepository.updateUserPreferences(userId, preferences);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to update notification preferences', error);
    }
  }

  /**
   * Gets notification statistics
   */
  async getStatistics(criteria = {}) {
    try {
      return await notificationRepository.getStatistics(criteria);
    } catch (error) {
      throw new InternalError('Failed to get notification statistics', error);
    }
  }

  /**
   * Creates a notification from a template
   */
  async createFromTemplate(type, data) {
    try {
      return await notificationRepository.createFromTemplate(type, data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InternalError('Failed to create notification from template', error);
    }
  }
}

// Create a singleton instance
const notificationService = new NotificationService();

// Export individual functions for convenience
export const createNotification = (params) => notificationService.createNotification(params);
export const createBroadcastNotification = (params) => notificationService.createBroadcastNotification(params);
export const fetchUserNotifications = (params) => notificationService.fetchUserNotifications(params);
export const markNotificationRead = (notificationId, userId) => notificationService.markNotificationRead(notificationId, userId);
export const archiveNotification = (notificationId, userId) => notificationService.archiveNotification(notificationId, userId);
export const markAllRead = (userId) => notificationService.markAllRead(userId);
export const getUnreadCount = (userId) => notificationService.getUnreadCount(userId);
export const updateNotificationPreferences = (userId, preferences) => notificationService.updateNotificationPreferences(userId, preferences);
export const getStatistics = (criteria) => notificationService.getStatistics(criteria);
export const createFromTemplate = (type, data) => notificationService.createFromTemplate(type, data);

// Export the service instance as default
export default notificationService; 