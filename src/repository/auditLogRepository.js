import mongoose from 'mongoose';
import BaseRepository from './baseRepository.js';
import AuditLog from '../schema/auditLogSchema.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog, 'AuditLog');
  }

  /**
   * Create a new audit log entry
   * @param {Object} logData - The audit log data
   * @returns {Promise<Object>} Created audit log
   */
  async create(logData) {
    try {
      const log = new AuditLog(logData);
      return await log.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError('Invalid audit log data: ' + error.message);
      }
      throw error;
    }
  }

  /**
   * Find audit logs by entity with pagination
   * @param {string} entityType - The entity type
   * @param {string} entityId - The entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated audit logs
   */
  async findByEntity(entityType, entityId, options = {}) {
    return this.findWithPagination(
      { entityType, entityId },
      {
        sort: { createdAt: -1 },
        populate: options.populate || [],
        page: options.page,
        limit: options.limit
      }
    );
  }

  /**
   * Find audit logs by user with pagination
   * @param {string} userId - The user ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated audit logs
   */
  async findByUser(userId, filters = {}, options = {}) {
    return this.findWithPagination(
      { performedBy: userId, ...filters },
      {
        sort: { createdAt: -1 },
        populate: options.populate || [],
        page: options.page,
        limit: options.limit
      }
    );
  }

  /**
   * Find audit logs by criteria with pagination
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated audit logs
   */
  async findByCriteria(criteria, options = {}) {
    const {
      startDate,
      endDate,
      action,
      status,
      severity,
      searchText
    } = criteria;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Basic filters
    if (action) query.action = action;
    if (status) query.status = status;
    if (severity) query.severity = severity;

    // Text search
    if (searchText) {
      query.$or = [
        { 'changes.field': { $regex: searchText, $options: 'i' } },
        { 'changes.oldValue': { $regex: searchText, $options: 'i' } },
        { 'changes.newValue': { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } }
      ];
    }

    return this.findWithPagination(query, {
      sort: options.sort || { createdAt: -1 },
      populate: options.populate || [],
      page: options.page,
      limit: options.limit
    });
  }

  /**
   * Get audit log statistics
   * @param {Object} criteria - Filter criteria
   * @returns {Promise<Object>} Audit log statistics
   */
  async getStatistics(criteria = {}) {
    const pipeline = [
      { $match: criteria },
      {
        $facet: {
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } }
          ],
          byEntityType: [
            { $group: { _id: '$entityType', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byUser: [
            { $group: { _id: '$performedBy', count: { $sum: 1 } } }
          ],
          timeDistribution: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const [result] = await AuditLog.aggregate(pipeline);
    return result;
  }

  /**
   * Clean up old audit logs
   * @param {number} daysOld - Delete logs older than these many days
   * @param {Object} criteria - Additional criteria for cleanup
   * @returns {Promise<Object>} Deletion result
   */
  async cleanupOldLogs(daysOld = 90, criteria = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        ...criteria
      },
      { isDeleted: true, deletedAt: new Date() }
    );
  }

  /**
   * Get entity history with pagination
   * @param {string} entityType - The entity type
   * @param {string} entityId - The entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated entity history
   */
  async getEntityHistory(entityType, entityId, options = {}) {
    return this.findWithPagination(
      { entityType, entityId },
      {
        sort: { createdAt: 1 },
        populate: [
          { path: 'performedBy', select: 'username displayName' }
        ],
        page: options.page,
        limit: options.limit
      }
    );
  }
}

export default new AuditLogRepository(); 