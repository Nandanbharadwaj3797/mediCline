import mongoose from 'mongoose';
import BaseRepository from './baseRepository.js';
import PickupRequest from '../schema/pickupRequestSchema.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';

// In-memory cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

class PickupRepository extends BaseRepository {
  constructor() {
    super(PickupRequest, 'PickupRequest');
    this.cache = new Map();
    this.validateWasteType = this.validateWasteType.bind(this);
    this.validateStatus = this.validateStatus.bind(this);
  }

  /**
   * Validate waste type
   * @private
   * @param {string} type - The waste type
   * @returns {boolean} Whether type is valid
   */
  validateWasteType(type) {
    return ['sharps', 'biohazard', 'expired_meds', 'others'].includes(type);
  }

  /**
   * Validate status
   * @private
   * @param {string} status - The status
   * @returns {boolean} Whether status is valid
   */
  validateStatus(status) {
    return ['pending', 'assigned', 'collected', 'cancelled'].includes(status);
  }

  /**
   * Set cache value
   * @private
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  setCacheValue(key, value) {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Get cache value
   * @private
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  getCacheValue(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }

  /**
   * Create pickup request
   * @param {Object} data - The pickup request data
   * @returns {Promise<Object>} Created pickup request
   */
  async create(data) {
    if (!data.clinicId) throw new ValidationError('Clinic ID is required');
    if (!data.wasteType || !this.validateWasteType(data.wasteType))
      throw new ValidationError('Invalid or missing waste type');
    if (!data.volumeKg || data.volumeKg <= 0 || data.volumeKg > 1000)
      throw new ValidationError('Volume must be between 0 and 1000 kg');
    if (!data.location?.coordinates || !Array.isArray(data.location.coordinates))
      throw new ValidationError('Valid location coordinates are required');

    // Set priority based on emergency status
    if (data.emergency?.isEmergency && (!data.priority || data.priority !== 'urgent')) {
      data.priority = 'urgent';
    }

    const request = await super.create({
      ...data,
      status: 'pending',
      requestedAt: new Date(),
      statusHistory: [{ status: 'pending', updatedAt: new Date() }]
    });

    return request.populate('clinicId', 'username email');
  }

  /**
   * Get pickup statistics
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Pickup statistics
   */
  async getStatistics(filters = {}) {
    const matchStage = { isDeleted: { $ne: true }, ...filters };

    const [statusStats, volumeStats, timeStats] = await Promise.all([
      // Status breakdown
      this.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Volume statistics
      this.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$volumeKg' },
            avgVolume: { $avg: '$volumeKg' },
            maxVolume: { $max: '$volumeKg' },
            minVolume: { $min: '$volumeKg' },
            totalRequests: { $sum: 1 }
          }
        }
      ]),

      // Time-based analysis
      this.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$requestedAt' },
              month: { $month: '$requestedAt' },
              day: { $dayOfMonth: '$requestedAt' }
            },
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' },
            avgResponseTime: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'collected'] },
                  { $subtract: ['$collectedAt', '$requestedAt'] },
                  null
                ]
              }
            }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } }
      ])
    ]);

    return {
      statusBreakdown: statusStats,
      volumeStatistics: volumeStats[0] || {
        totalVolume: 0,
        avgVolume: 0,
        maxVolume: 0,
        minVolume: 0,
        totalRequests: 0
      },
      timeDistribution: this.calculateTrends(timeStats)
    };
  }

  /**
   * Calculate trends from time statistics
   * @private
   * @param {Array} timeStats - Time-based statistics
   * @returns {Object} Calculated trends
   */
  calculateTrends(timeStats) {
    const sortedStats = timeStats.sort((a, b) => {
      const dateA = new Date(a._id.year, a._id.month - 1, a._id.day);
      const dateB = new Date(b._id.year, b._id.month - 1, b._id.day);
      return dateA - dateB;
    });

    const trends = {
      daily: sortedStats.map(stat => ({
        date: new Date(stat._id.year, stat._id.month - 1, stat._id.day),
        count: stat.count,
        volume: stat.totalVolume,
        avgResponseTime: stat.avgResponseTime
      })),
      weekly: [],
      monthly: []
    };

    // Calculate weekly and monthly aggregates
    let currentWeek = { count: 0, volume: 0, responseTime: [], days: [] };
    let currentMonth = { count: 0, volume: 0, responseTime: [], days: [] };

    sortedStats.forEach(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
      
      // Weekly
      if (currentWeek.days.length === 0 || 
          (date - currentWeek.days[0]) <= 7 * 24 * 60 * 60 * 1000) {
        currentWeek.count += stat.count;
        currentWeek.volume += stat.totalVolume;
        if (stat.avgResponseTime) currentWeek.responseTime.push(stat.avgResponseTime);
        currentWeek.days.push(date);
      } else {
        trends.weekly.push({
          startDate: currentWeek.days[0],
          endDate: currentWeek.days[currentWeek.days.length - 1],
          count: currentWeek.count,
          volume: currentWeek.volume,
          avgResponseTime: currentWeek.responseTime.length ? 
            currentWeek.responseTime.reduce((a, b) => a + b) / currentWeek.responseTime.length : 
            null
        });
        currentWeek = {
          count: stat.count,
          volume: stat.totalVolume,
          responseTime: stat.avgResponseTime ? [stat.avgResponseTime] : [],
          days: [date]
        };
      }

      // Monthly
      if (currentMonth.days.length === 0 || 
          (date.getMonth() === currentMonth.days[0].getMonth() && 
           date.getFullYear() === currentMonth.days[0].getFullYear())) {
        currentMonth.count += stat.count;
        currentMonth.volume += stat.totalVolume;
        if (stat.avgResponseTime) currentMonth.responseTime.push(stat.avgResponseTime);
        currentMonth.days.push(date);
      } else {
        trends.monthly.push({
          month: currentMonth.days[0].getMonth() + 1,
          year: currentMonth.days[0].getFullYear(),
          count: currentMonth.count,
          volume: currentMonth.volume,
          avgResponseTime: currentMonth.responseTime.length ? 
            currentMonth.responseTime.reduce((a, b) => a + b) / currentMonth.responseTime.length : 
            null
        });
        currentMonth = {
          count: stat.count,
          volume: stat.totalVolume,
          responseTime: stat.avgResponseTime ? [stat.avgResponseTime] : [],
          days: [date]
        };
      }
    });

    // Add last week and month if they have data
    if (currentWeek.days.length > 0) {
      trends.weekly.push({
        startDate: currentWeek.days[0],
        endDate: currentWeek.days[currentWeek.days.length - 1],
        count: currentWeek.count,
        volume: currentWeek.volume,
        avgResponseTime: currentWeek.responseTime.length ? 
          currentWeek.responseTime.reduce((a, b) => a + b) / currentWeek.responseTime.length : 
          null
      });
    }

    if (currentMonth.days.length > 0) {
      trends.monthly.push({
        month: currentMonth.days[0].getMonth() + 1,
        year: currentMonth.days[0].getFullYear(),
        count: currentMonth.count,
        volume: currentMonth.volume,
        avgResponseTime: currentMonth.responseTime.length ? 
          currentMonth.responseTime.reduce((a, b) => a + b) / currentMonth.responseTime.length : 
          null
      });
    }

    return trends;
  }

  /**
   * Find pickup requests with pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated pickup requests
   */
  async findWithFilters(filters = {}, options = {}) {
    const query = { isDeleted: { $ne: true } };

    if (filters.startDate || filters.endDate) {
      query.requestedAt = {};
      if (filters.startDate) query.requestedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.requestedAt.$lte = new Date(filters.endDate);
    }

    if (filters.status) query.status = filters.status;
    if (filters.clinicId) query.clinicId = filters.clinicId;
    if (filters.collectorId) query.collectorId = filters.collectorId;
    if (filters.wasteType) query.wasteType = filters.wasteType;
    if (filters.priority) query.priority = filters.priority;
    if (filters.minVolume) query.volumeKg = { $gte: filters.minVolume };
    if (filters.maxVolume) {
      query.volumeKg = { ...query.volumeKg, $lte: filters.maxVolume };
    }
    if (filters.isEmergency) query['emergency.isEmergency'] = true;
    if (filters.isScheduled) query['scheduledPickup.isScheduled'] = true;
    if (filters.isOverdue) {
      const overdueLimits = {
        urgent: 2,
        high: 6,
        medium: 24,
        low: 48
      };
      
      query.$or = Object.entries(overdueLimits).map(([priority, hours]) => ({
        priority,
        status: 'pending',
        requestedAt: {
          $lte: new Date(Date.now() - hours * 60 * 60 * 1000)
        }
      }));
    }

    return this.findWithPagination(query, {
      sort: options.sort || { priority: -1, requestedAt: -1 },
      populate: [
        { path: 'clinicId', select: 'username email' },
        { path: 'collectorId', select: 'username email' }
      ],
      page: options.page,
      limit: options.limit
    });
  }

  /**
   * Get pickup request by ID
   * @param {string} id - The pickup request ID
   * @returns {Promise<Object>} Found pickup request
   */
  async findById(id) {
    const cacheKey = `pickup:${id}`;
    const cached = this.getCacheValue(cacheKey);
    if (cached) return cached;

    const request = await super.findOne(
      { _id: id, isDeleted: { $ne: true } },
      {
        populate: [
          { path: 'clinicId', select: 'username email' },
          { path: 'collectorId', select: 'username email' }
        ]
      }
    );

    if (!request) throw new NotFoundError('Pickup request not found');

    this.setCacheValue(cacheKey, request);
    return request;
  }

  /**
   * Update pickup request
   * @param {string} id - The pickup request ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated pickup request
   */
  async update(id, data) {
    if (data.status && !this.validateStatus(data.status))
      throw new ValidationError('Invalid status');
    if (data.wasteType && !this.validateWasteType(data.wasteType))
      throw new ValidationError('Invalid waste type');
    if (data.volumeKg && data.volumeKg <= 0)
      throw new ValidationError('Volume must be a positive number');

    const request = await this.findById(id);

    // Validate status transitions
    if (data.status) {
      const currentStatus = request.status;
      if (currentStatus === 'collected' && data.status !== 'collected')
        throw new ValidationError('Cannot change status of collected requests');
      if (currentStatus === 'cancelled' && data.status !== 'cancelled')
        throw new ValidationError('Cannot change status of cancelled requests');
      if (data.status === 'assigned' && !data.collectorId)
        throw new ValidationError('Collector ID required for assigned status');
    }

    const update = {
      ...data,
      ...(data.status && {
        statusHistory: [
          ...request.statusHistory,
          {
            status: data.status,
            updatedAt: new Date(),
            note: data.statusNote
          }
        ]
      }),
      ...(data.status === 'collected' && { collectedAt: new Date() })
    };

    const updated = await super.update(id, update);
    this.cache.delete(`pickup:${id}`);
    return updated.populate([
      { path: 'clinicId', select: 'username email' },
      { path: 'collectorId', select: 'username email' }
    ]);
  }

  /**
   * Assign collector to pickup request
   * @param {string} requestId - The pickup request ID
   * @param {string} collectorId - The collector ID
   * @param {string} note - Optional note
   * @returns {Promise<Object>} Updated pickup request
   */
  async assignCollector(requestId, collectorId, note = '') {
    return this.update(requestId, {
      collectorId,
      status: 'assigned',
      statusNote: note
    });
  }

  /**
   * Cancel pickup request
   * @param {string} id - The pickup request ID
   * @param {Object} data - Cancellation data
   * @returns {Promise<Object>} Cancelled pickup request
   */
  async cancel(id, { reason, cancelledBy }) {
    if (!reason) throw new ValidationError('Cancellation reason is required');

    return this.update(id, {
      status: 'cancelled',
      statusNote: reason,
      cancelledBy,
      cancelledAt: new Date()
    });
  }

  /**
   * Get nearby pickup requests
   * @param {Array<number>} coordinates - [longitude, latitude]
   * @param {number} maxDistance - Maximum distance in meters
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Nearby pickup requests
   */
  async findNearby(coordinates, maxDistance = 10000, filters = {}) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new ValidationError('Valid coordinates [longitude, latitude] are required');
    }

    return this.find(
      {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: coordinates
            },
            $maxDistance: maxDistance
          }
        },
        isDeleted: { $ne: true },
        ...filters
      },
      {
        populate: [
          { path: 'clinicId', select: 'username email' },
          { path: 'collectorId', select: 'username email' }
        ]
      }
    );
  }

  /**
   * Bulk update pickup request statuses
   * @param {Array<{id: string, status: string, note?: string}>} updates - Array of status updates
   * @returns {Promise<Object>} Bulk write result
   */
  async bulkUpdateStatus(updates) {
    try {
      const bulkOps = [];
      const errors = [];
      const now = new Date();

      // Validate all updates first
      for (const [index, update] of updates.entries()) {
        try {
          if (!update.id || !update.status) {
            throw new ValidationError('Missing required fields: id and status');
          }

          const pickup = await this.findById(update.id);
          if (!pickup) {
            throw new NotFoundError(`Pickup request ${update.id} not found`);
          }

          // Validate status transition
          pickup.validateStatusTransition(update.status);

          bulkOps.push({
            updateOne: {
              filter: { _id: update.id },
              update: {
                $set: {
                  status: update.status,
                  lastModifiedAt: now
                },
                $push: {
                  statusHistory: {
                    status: update.status,
                    note: update.note || '',
                    updatedAt: now
                  }
                }
              }
            }
          });
        } catch (error) {
          errors.push({
            index,
            id: update.id,
            error: error.message
          });
        }
      }

      // If there are any validation errors, throw them
      if (errors.length > 0) {
        throw new ValidationError('Bulk update validation failed', { errors });
      }

      // Execute bulk operation
      if (bulkOps.length > 0) {
        const result = await this.model.bulkWrite(bulkOps, { ordered: false });
        return {
          success: true,
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        };
      }

      return {
        success: false,
        modifiedCount: 0,
        matchedCount: 0,
        message: 'No valid updates to process'
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to process bulk status updates', error);
    }
  }

  /**
   * Get pickup requests by status with pagination
   * @param {string} status - The status to filter by
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated pickup requests
   */
  async findByStatus(status, options = {}) {
    if (!this.validateStatus(status)) {
      throw new ValidationError('Invalid status');
    }

    return this.findWithFilters({ status }, options);
  }

  /**
   * Get pickup requests count by status
   * @returns {Promise<Object>} Status counts
   */
  async getStatusCounts() {
    const counts = await this.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return counts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});
  }

  /**
   * Update pickup request priority
   * @param {string} id - The pickup request ID
   * @param {string} priority - New priority level
   * @param {string} note - Optional note
   * @returns {Promise<Object>} Updated pickup request
   */
  async updatePriority(id, priority, note = '') {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      throw new ValidationError('Invalid priority level');
    }

    const request = await this.findById(id);
    
    if (request.emergency.isEmergency && priority !== 'urgent') {
      throw new ValidationError('Emergency requests must maintain urgent priority');
    }

    const updated = await this.update(id, {
      priority,
      statusHistory: [
        ...request.statusHistory,
        {
          status: request.status,
          updatedAt: new Date(),
          note: `Priority changed to ${priority}${note ? ': ' + note : ''}`
        }
      ]
    });

    this.cache.delete(`pickup:${id}`);
    return updated;
  }

  /**
   * Get pickup requests by priority
   * @param {string} priority - Priority level to filter by
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated pickup requests
   */
  async findByPriority(priority, options = {}) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      throw new ValidationError('Invalid priority level');
    }

    return this.findWithFilters({ priority }, options);
  }

  /**
   * Get pickup requests count by priority
   * @returns {Promise<Object>} Priority counts
   */
  async getPriorityCounts() {
    const counts = await this.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    return counts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});
  }

  async bulkAssignCollectors(assignments) {
    try {
      const bulkOps = [];
      const errors = [];
      const now = new Date();

      // Validate all assignments first
      for (const [index, assignment] of assignments.entries()) {
        try {
          if (!assignment.pickupId || !assignment.collectorId) {
            throw new ValidationError('Missing required fields: pickupId and collectorId');
          }

          const pickup = await this.findById(assignment.pickupId);
          if (!pickup) {
            throw new NotFoundError(`Pickup request ${assignment.pickupId} not found`);
          }

          if (pickup.status !== 'pending') {
            throw new ValidationError(`Cannot assign collector to ${pickup.status} pickup request`);
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: assignment.pickupId },
              update: {
                $set: {
                  collectorId: assignment.collectorId,
                  status: 'assigned',
                  lastModifiedAt: now
                },
                $push: {
                  statusHistory: {
                    status: 'assigned',
                    note: assignment.note || '',
                    updatedAt: now
                  }
                }
              }
            }
          });
        } catch (error) {
          errors.push({
            index,
            pickupId: assignment.pickupId,
            error: error.message
          });
        }
      }

      // If there are any validation errors, throw them
      if (errors.length > 0) {
        throw new ValidationError('Bulk assignment validation failed', { errors });
      }

      // Execute bulk operation
      if (bulkOps.length > 0) {
        const result = await this.model.bulkWrite(bulkOps, { ordered: false });
        return {
          success: true,
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        };
      }

      return {
        success: false,
        modifiedCount: 0,
        matchedCount: 0,
        message: 'No valid assignments to process'
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalError('Failed to process bulk collector assignments', error);
    }
  }
}

export default new PickupRepository();
  