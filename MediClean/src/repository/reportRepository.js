import mongoose from 'mongoose';
import BaseRepository from './baseRepository.js';
import Report from '../schema/reportSchema.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';

class ReportRepository extends BaseRepository {
  constructor() {
    super(Report, 'Report');
  }

  /**
   * Create a new report
   * @param {Object} reportData - The report data
   * @returns {Promise<Object>} Created report
   */
  async create(reportData) {
    try {
      const report = new Report(reportData);
      return await report.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError('Invalid report data: ' + error.message);
      }
      throw error;
    }
  }

  /**
   * Find report by ID
   * @param {string} reportId - The report ID
   * @returns {Promise<Object>} Found report
   */
  async findById(reportId) {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    return report;
  }

  /**
   * Find reports by user with pagination
   * @param {string} userId - The user ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated reports
   */
  async findByUser(userId, filters = {}, options = {}) {
    return this.findWithPagination(
      { userId, ...filters },
      {
        sort: options.sort || { createdAt: -1 },
        populate: options.populate || [],
        page: options.page,
        limit: options.limit
      }
    );
  }

  /**
   * Find reports by criteria with pagination
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated reports
   */
  async findByCriteria(criteria, options = {}) {
    const {
      startDate,
      endDate,
      type,
      status,
      frequency,
      format,
      searchText,
      isArchived
    } = criteria;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Basic filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (frequency) query.frequency = frequency;
    if (format) query.format = format;
    if (typeof isArchived === 'boolean') query.isArchived = isArchived;

    // Text search
    if (searchText) {
      query.$or = [
        { title: { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } },
        { 'parameters.name': { $regex: searchText, $options: 'i' } }
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
   * Update report status
   * @param {string} reportId - The report ID
   * @param {string} status - New status
   * @param {Object} [additionalData] - Additional data to update
   * @returns {Promise<Object>} Updated report
   */
  async updateStatus(reportId, status, additionalData = {}) {
    return this.update(reportId, {
      status,
      statusUpdatedAt: new Date(),
      ...additionalData
    });
  }

  /**
   * Find scheduled reports due for generation
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of due reports
   */
  async findDueScheduledReports(options = {}) {
    const now = new Date();
    return this.find(
      {
        isScheduled: true,
        nextRunAt: { $lte: now },
        status: { $ne: 'cancelled' },
        isDeleted: false
      },
      {
        sort: { nextRunAt: 1 },
        limit: options.limit,
        populate: options.populate
      }
    );
  }

  /**
   * Update next run time for scheduled report
   * @param {string} reportId - The report ID
   * @param {Date} nextRunAt - Next scheduled run time
   * @returns {Promise<Object>} Updated report
   */
  async updateNextRunTime(reportId, nextRunAt) {
    return this.update(reportId, {
      nextRunAt,
      lastRunAt: new Date()
    });
  }

  /**
   * Clean up old reports
   * @param {number} daysOld - Clean up reports older than these many days
   * @param {Object} criteria - Additional criteria for cleanup
   * @returns {Promise<Object>} Update result
   */
  async cleanupOldReports(daysOld = 30, criteria = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed', 'cancelled'] },
        ...criteria
      },
      {
        isDeleted: true,
        deletedAt: new Date()
      }
    );
  }

  /**
   * Get report statistics
   * @param {Object} criteria - Filter criteria
   * @returns {Promise<Object>} Report statistics
   */
  async getStatistics(criteria = {}) {
    const pipeline = [
      { $match: criteria },
      {
        $facet: {
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byFrequency: [
            { $group: { _id: '$frequency', count: { $sum: 1 } } }
          ],
          timeDistribution: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            }
          ],
          averageGenerationTime: [
            {
              $match: {
                status: 'completed',
                generationStartedAt: { $exists: true },
                generationEndedAt: { $exists: true }
              }
            },
            {
              $group: {
                _id: null,
                avgTime: {
                  $avg: {
                    $subtract: ['$generationEndedAt', '$generationStartedAt']
                  }
                }
              }
            }
          ]
        }
      }
    ];

    const [result] = await Report.aggregate(pipeline);
    return result;
  }

  /**
   * Archive completed reports
   * @param {number} daysOld - Archive reports older than these many days
   * @param {Object} criteria - Additional criteria for archiving
   * @returns {Promise<Object>} Update result
   */
  async archiveOldReports(daysOld = 7, criteria = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.updateMany(
      {
        createdAt: { $lt: cutoffDate },
        status: 'completed',
        isArchived: false,
        ...criteria
      },
      {
        isArchived: true,
        archivedAt: new Date()
      }
    );
  }

  /**
   * Restore archived reports
   * @param {string} reportId - The report ID
   * @returns {Promise<Object>} Updated report
   */
  async unarchiveReport(reportId) {
    return this.update(reportId, {
      isArchived: false,
      archivedAt: null
    });
  }
}

export default new ReportRepository(); 