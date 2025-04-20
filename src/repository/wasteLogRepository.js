import mongoose from 'mongoose';
import BaseRepository from './baseRepository.js';
import WasteLog from '../schema/wasteLogSchema.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import NodeCache from 'node-cache';

// In-memory cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

class WasteLogRepository extends BaseRepository {
  constructor() {
    super('WasteLog');
    this.cache = new NodeCache({ stdTTL: 300, maxKeys: 1000 });
    this.validateWasteCategory = this.validateWasteCategory.bind(this);
  }

  /**
   * Validate waste category
   * @private
   * @param {string} category - The waste category
   * @returns {boolean} Whether category is valid
   */
  validateWasteCategory(category) {
    return ['sharps', 'biohazard', 'expired_meds', 'others'].includes(category);
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
   * Validate storage conditions
   * @param {Object} conditions - Storage conditions
   * @returns {Promise<boolean>} Whether conditions are valid
   */
  validateStorageConditions(conditions) {
    if (!conditions) return;
    
    const { temperature, humidity, specialRequirements } = conditions;
    
    if (temperature) {
      if (typeof temperature.min !== 'number' || typeof temperature.max !== 'number') {
        throw new ValidationError('Temperature min and max must be numbers');
      }
      if (temperature.min > temperature.max) {
        throw new ValidationError('Temperature min cannot be greater than max');
      }
    }
    
    if (humidity) {
      if (typeof humidity.min !== 'number' || typeof humidity.max !== 'number') {
        throw new ValidationError('Humidity min and max must be numbers');
      }
      if (humidity.min > humidity.max || humidity.min < 0 || humidity.max > 100) {
        throw new ValidationError('Invalid humidity range. Must be between 0-100%');
      }
    }
    
    if (specialRequirements && !Array.isArray(specialRequirements)) {
      throw new ValidationError('Special requirements must be an array');
    }
  }

  /**
   * Validate container info
   * @param {Object} containerInfo - Container info
   * @returns {Promise<boolean>} Whether container info is valid
   */
  validateContainerInfo(containerInfo) {
    if (!containerInfo) {
      throw new ValidationError('Container info is required');
    }

    const validTypes = ['bag', 'box', 'container', 'other'];
    const validConditions = ['new', 'used', 'damaged'];

    if (!validTypes.includes(containerInfo.type)) {
      throw new ValidationError('Invalid container type');
    }

    if (typeof containerInfo.quantity !== 'number' || containerInfo.quantity < 1) {
      throw new ValidationError('Container quantity must be a positive number');
    }

    if (!validConditions.includes(containerInfo.condition)) {
      throw new ValidationError('Invalid container condition');
    }
  }

  /**
   * Create a waste log
   * @param {Object} data - The waste log data
   * @param {Object} user - The user creating the waste log
   * @returns {Promise<Object>} Created waste log
   */
  async create(data, user) {
    if (!data.clinicId) throw new ValidationError('Clinic ID is required');
    if (!this.validateWasteCategory(data.category)) throw new ValidationError('Invalid category');
    if (!data.volumeKg || data.volumeKg <= 0) throw new ValidationError('Invalid volume');
    if (!data.location?.coordinates || !Array.isArray(data.location.coordinates)) {
      throw new ValidationError('Valid location coordinates are required');
    }
    this.validateStorageConditions(data.storageConditions);
    this.validateContainerInfo(data.containerInfo);

    const log = await super.create({
      ...data,
      loggedAt: new Date()
    });

    // Add audit trail
    log.addAuditTrail('created', user);

    await this.cache.del(`clinic:${data.clinicId}:logs`);
    await this.cache.del(`log:${log._id}`);

    return log.populate('clinicId', 'username email');
  }

  /**
   * Create multiple waste logs
   * @param {Array<Object>} logs - Array of waste log data
   * @returns {Promise<Array>} Created waste logs
   */
  async batchCreate(logs) {
    return super.batchCreate(logs.map(log => ({
      ...log,
      loggedAt: new Date()
    })));
  }

  /**
   * Find waste logs with pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated waste logs
   */
  async findWithFilters(filters = {}, options = {}) {
    const query = { isDeleted: { $ne: true } };

    if (filters.startDate || filters.endDate) {
      query.loggedAt = {};
      if (filters.startDate) query.loggedAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.loggedAt.$lte = new Date(filters.endDate);
    }

    if (filters.category) query.category = filters.category;
    if (filters.clinicId) query.clinicId = filters.clinicId;
    if (filters.minVolume) query.volumeKg = { $gte: filters.minVolume };
    if (filters.maxVolume) {
      query.volumeKg = { ...query.volumeKg, $lte: filters.maxVolume };
    }

    return this.findWithPagination(query, {
      sort: options.sort || { loggedAt: -1 },
      populate: [{ path: 'clinicId', select: 'username email' }],
      page: options.page,
      limit: options.limit
    });
  }

  /**
   * Get waste log by ID
   * @param {string} id - The waste log ID
   * @returns {Promise<Object>} Found waste log
   */
  async findById(id) {
    const cacheKey = `wastelog:${id}`;
    const cached = this.getCacheValue(cacheKey);
    if (cached) return cached;

    const log = await super.findOne(
      { _id: id, isDeleted: { $ne: true } },
      { populate: [{ path: 'clinicId', select: 'username email' }] }
    );

    if (!log) throw new NotFoundError('Waste log not found');

    this.setCacheValue(cacheKey, log);
    return log;
  }

  /**
   * Update waste log
   * @param {string} id - The waste log ID
   * @param {Object} data - Update data
   * @param {Object} user - The user updating the waste log
   * @returns {Promise<Object>} Updated waste log
   */
  async update(id, data, user) {
    if (data.category && !this.validateWasteCategory(data.category)) {
      throw new ValidationError('Invalid category');
    }
    if (data.volumeKg && data.volumeKg <= 0) {
      throw new ValidationError('Invalid volume');
    }

    const log = await this.findById(id);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (new Date(log.loggedAt).getTime() <= oneDayAgo) {
      throw new ValidationError('Cannot update logs older than 24 hours');
    }

    if (data.storageConditions) {
      this.validateStorageConditions(data.storageConditions);
    }

    if (data.containerInfo) {
      this.validateContainerInfo(data.containerInfo);
    }

    // Track changes for audit trail
    const changes = {};
    for (const [key, value] of Object.entries(data)) {
      if (JSON.stringify(log[key]) !== JSON.stringify(value)) {
        changes[key] = {
          old: log[key],
          new: value
        };
      }
    }

    Object.assign(log, data);
    log.addAuditTrail('updated', user, changes);

    const updated = await super.update(id, data);
    this.cache.del(`wastelog:${id}`);
    await this.cache.del(`clinic:${log.clinicId}:logs`);
    await this.cache.del(`log:${id}`);
    return updated.populate('clinicId', 'username email');
  }

  /**
   * Soft delete waste log
   * @param {string} id - The waste log ID
   * @param {Object} user - The user deleting the waste log
   * @returns {Promise<Object>} Deleted waste log
   */
  async softDelete(id, user) {
    const log = await this.findById(id);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (new Date(log.loggedAt).getTime() <= oneDayAgo) {
      throw new ValidationError('Cannot delete logs older than 24 hours');
    }

    if (!log.isDeletable()) {
      throw new ValidationError('Waste log is no longer deletable');
    }

    await log.softDelete(user);
    this.cache.delete(`wastelog:${id}`);
    return log;
  }

  /**
   * Get waste logs by clinic ID
   * @param {string} clinicId - The clinic ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated waste logs
   */
  async findByClinic(clinicId, filters = {}, options = {}) {
    if (!clinicId) throw new ValidationError('Clinic ID is required');
    return this.findWithFilters({ ...filters, clinicId }, options);
  }

  /**
   * Get waste statistics
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Waste statistics
   */
  async getStatistics(filters = {}) {
    const match = {
      isDeleted: false,
      ...filters
    };

    const [categoryStats, volumeStats, timeStats] = await Promise.all([
      // Category breakdown
      this.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' }
          }
        }
      ]),

      // Volume distribution
      this.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$volumeKg' },
            avgVolume: { $avg: '$volumeKg' },
            maxVolume: { $max: '$volumeKg' },
            minVolume: { $min: '$volumeKg' }
          }
        }
      ]),

      // Time distribution
      this.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$loggedAt' },
              month: { $month: '$loggedAt' },
              day: { $dayOfMonth: '$loggedAt' }
            },
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    return {
      categoryBreakdown: categoryStats,
      volumeStats: volumeStats[0] || {
        totalVolume: 0,
        avgVolume: 0,
        maxVolume: 0,
        minVolume: 0
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
        volume: stat.totalVolume
      })),
      weekly: [],
      monthly: []
    };

    // Calculate weekly and monthly aggregates
    let currentWeek = { count: 0, volume: 0, days: [] };
    let currentMonth = { count: 0, volume: 0, days: [] };

    sortedStats.forEach(stat => {
      const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
      
      // Weekly
      if (currentWeek.days.length === 0 || 
          (date - currentWeek.days[0]) <= 7 * 24 * 60 * 60 * 1000) {
        currentWeek.count += stat.count;
        currentWeek.volume += stat.totalVolume;
        currentWeek.days.push(date);
      } else {
        trends.weekly.push({
          startDate: currentWeek.days[0],
          endDate: currentWeek.days[currentWeek.days.length - 1],
          count: currentWeek.count,
          volume: currentWeek.volume
        });
        currentWeek = { 
          count: stat.count, 
          volume: stat.totalVolume, 
          days: [date] 
        };
      }

      // Monthly
      if (currentMonth.days.length === 0 || 
          (date.getMonth() === currentMonth.days[0].getMonth() && 
           date.getFullYear() === currentMonth.days[0].getFullYear())) {
        currentMonth.count += stat.count;
        currentMonth.volume += stat.totalVolume;
        currentMonth.days.push(date);
      } else {
        trends.monthly.push({
          month: currentMonth.days[0].getMonth() + 1,
          year: currentMonth.days[0].getFullYear(),
          count: currentMonth.count,
          volume: currentMonth.volume
        });
        currentMonth = { 
          count: stat.count, 
          volume: stat.totalVolume, 
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
        volume: currentWeek.volume
      });
    }

    if (currentMonth.days.length > 0) {
      trends.monthly.push({
        month: currentMonth.days[0].getMonth() + 1,
        year: currentMonth.days[0].getFullYear(),
        count: currentMonth.count,
        volume: currentMonth.volume
      });
    }

    return trends;
  }

  /**
   * Get nearby waste logs
   * @param {Array<number>} coordinates - [longitude, latitude]
   * @param {number} maxDistance - Maximum distance in meters
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Nearby waste logs
   */
  async findNearby(coordinates, maxDistance = 10000, filters = {}) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new ValidationError('Valid coordinates [longitude, latitude] are required');
    }

    return this.find({
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
    });
  }
}
export default new WasteLogRepository();
