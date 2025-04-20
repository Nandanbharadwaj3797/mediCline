import mongoose from 'mongoose';
import WasteLog from '../models/wastelog.js';
import PickupRequest from '../models/pickuprequest.js';
import User from '../models/user.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import { validateObjectId } from '../utils/validation.js';

const COMPLIANCE_WEIGHTS = {
  wasteLogging: 0.4,
  pickupCompletion: 0.3,
  responseTime: 0.2,
  volumeConsistency: 0.1
};

/**
 * Gets waste statistics with various aggregations
 */
export const getWasteStatistics = async ({
  clinicId,
  startDate,
  endDate,
  groupBy = 'month'
}) => {
  try {
    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    const matchStage = {};
    if (clinicId) {
      // Verify clinic exists
      const clinicExists = await User.exists({ _id: clinicId, role: 'clinic' });
      if (!clinicExists) {
        throw new NotFoundError('Clinic not found');
      }
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format');
      }
      if (end < start) {
        throw new ValidationError('End date must be after start date');
      }
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const timeGrouping = getTimeGrouping(groupBy);

    const [volumeByTime, categoryBreakdown, totalStats, volumeDistribution] = await Promise.all([
      // Time series data
      WasteLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: timeGrouping,
            totalVolume: { $sum: '$volumeKg' },
            count: { $sum: 1 },
            categories: { $addToSet: '$category' }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Category breakdown
      WasteLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category',
            totalVolume: { $sum: '$volumeKg' },
            count: { $sum: 1 },
            avgVolume: { $avg: '$volumeKg' },
            minVolume: { $min: '$volumeKg' },
            maxVolume: { $max: '$volumeKg' }
          }
        }
      ]),

      // Overall statistics
      WasteLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$volumeKg' },
            avgVolumePerLog: { $avg: '$volumeKg' },
            totalLogs: { $sum: 1 },
            uniqueCategories: { $addToSet: '$category' }
          }
        }
      ]),

      // Volume distribution
      WasteLog.aggregate([
        { $match: matchStage },
        {
          $bucket: {
            groupBy: '$volumeKg',
            boundaries: [0, 10, 25, 50, 100, 200, 500],
            default: 'Above 500',
            output: {
              count: { $sum: 1 },
              totalVolume: { $sum: '$volumeKg' }
            }
          }
        }
      ])
    ]);

    return {
      timeSeries: volumeByTime.map(item => ({
        period: formatPeriod(item._id, groupBy),
        volume: item.totalVolume,
        count: item.count,
        categoriesCount: item.categories.length
      })),
      categoryBreakdown: categoryBreakdown.map(item => ({
        category: item._id,
        volume: item.totalVolume,
        count: item.count,
        avgVolume: item.avgVolume,
        minVolume: item.minVolume,
        maxVolume: item.maxVolume
      })),
      volumeDistribution: volumeDistribution.map(item => ({
        range: typeof item._id === 'string' ? item._id : `${item._id}-${item._id + 1}`,
        count: item.count,
        totalVolume: item.totalVolume
      })),
      summary: totalStats[0] || {
        totalVolume: 0,
        avgVolumePerLog: 0,
        totalLogs: 0,
        uniqueCategories: []
      }
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to fetch waste statistics', error);
  }
};

/**
 * Gets pickup statistics with various aggregations
 */
export const getPickupStatistics = async ({
  clinicId,
  collectorId,
  startDate,
  endDate,
  groupBy = 'month'
}) => {
  try {
    // Validate IDs
    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }
    if (collectorId && !validateObjectId(collectorId)) {
      throw new ValidationError('Invalid collector ID');
    }

    const matchStage = {};
    if (clinicId) {
      const clinicExists = await User.exists({ _id: clinicId, role: 'clinic' });
      if (!clinicExists) {
        throw new NotFoundError('Clinic not found');
      }
      matchStage.clinicId = new mongoose.Types.ObjectId(clinicId);
    }
    if (collectorId) {
      const collectorExists = await User.exists({ _id: collectorId, role: 'collector' });
      if (!collectorExists) {
        throw new NotFoundError('Collector not found');
      }
      matchStage.collectorId = new mongoose.Types.ObjectId(collectorId);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format');
      }
      if (end < start) {
        throw new ValidationError('End date must be after start date');
      }
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const timeGrouping = getTimeGrouping(groupBy);

    const [pickupsByTime, statusBreakdown, responseTimeStats, volumeStats] = await Promise.all([
      // Time series data
      PickupRequest.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: timeGrouping,
            totalRequests: { $sum: 1 },
            completedRequests: {
              $sum: { $cond: [{ $eq: ['$status', 'collected'] }, 1, 0] }
            },
            cancelledRequests: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            totalVolume: { $sum: '$volumeKg' },
            avgResponseTime: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'collected'] },
                  { $subtract: ['$collectedAt', '$createdAt'] },
                  null
                ]
              }
            }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Status breakdown
      PickupRequest.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalVolume: { $sum: '$volumeKg' }
          }
        }
      ]),

      // Response time statistics
      PickupRequest.aggregate([
        { $match: { ...matchStage, status: 'collected', collectedAt: { $exists: true } } },
        {
          $project: {
            responseTime: { $subtract: ['$collectedAt', '$createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            minResponseTime: { $min: '$responseTime' },
            maxResponseTime: { $max: '$responseTime' },
            stdDevResponseTime: { $stdDevPop: '$responseTime' }
          }
        }
      ]),

      // Volume statistics
      PickupRequest.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$volumeKg' },
            avgVolume: { $avg: '$volumeKg' },
            minVolume: { $min: '$volumeKg' },
            maxVolume: { $max: '$volumeKg' },
            stdDevVolume: { $stdDevPop: '$volumeKg' }
          }
        }
      ])
    ]);

    return {
      timeSeries: pickupsByTime.map(item => ({
        period: formatPeriod(item._id, groupBy),
        totalRequests: item.totalRequests,
        completedRequests: item.completedRequests,
        cancelledRequests: item.cancelledRequests,
        completionRate: item.totalRequests ? item.completedRequests / item.totalRequests : 0,
        volume: item.totalVolume,
        avgResponseTime: item.avgResponseTime
      })),
      statusBreakdown: statusBreakdown.map(item => ({
        status: item._id,
        count: item.count,
        volume: item.totalVolume
      })),
      responseTime: responseTimeStats[0] || {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        stdDevResponseTime: 0
      },
      volumeMetrics: volumeStats[0] || {
        totalVolume: 0,
        avgVolume: 0,
        minVolume: 0,
        maxVolume: 0,
        stdDevVolume: 0
      }
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to fetch pickup statistics', error);
  }
};

/**
 * Gets comprehensive clinic performance metrics
 */
export const getClinicPerformanceMetrics = async ({
  clinicId,
  startDate,
  endDate
}) => {
  try {
    if (!validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    const clinic = await User.findOne({ _id: clinicId, role: 'clinic' });
    if (!clinic) {
      throw new NotFoundError('Clinic not found');
    }

    const matchStage = {
      clinicId: new mongoose.Types.ObjectId(clinicId)
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format');
      }
      if (end < start) {
        throw new ValidationError('End date must be after start date');
      }
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const [wasteMetrics, pickupMetrics, complianceMetrics] = await Promise.all([
      // Waste metrics
      WasteLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$volumeKg' },
            avgVolumePerLog: { $avg: '$volumeKg' },
            totalLogs: { $sum: 1 },
            uniqueCategories: { $addToSet: '$category' },
            volumeStdDev: { $stdDevPop: '$volumeKg' }
          }
        }
      ]),

      // Pickup metrics
      PickupRequest.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            completedRequests: {
              $sum: { $cond: [{ $eq: ['$status', 'collected'] }, 1, 0] }
            },
            cancelledRequests: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            avgResponseTime: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'collected'] },
                  { $subtract: ['$collectedAt', '$createdAt'] },
                  null
                ]
              }
            }
          }
        }
      ]),

      // Compliance metrics
      calculateComplianceMetrics(clinicId, matchStage.createdAt)
    ]);

    const waste = wasteMetrics[0] || {
      totalVolume: 0,
      avgVolumePerLog: 0,
      totalLogs: 0,
      uniqueCategories: [],
      volumeStdDev: 0
    };

    const pickups = pickupMetrics[0] || {
      totalRequests: 0,
      completedRequests: 0,
      cancelledRequests: 0,
      avgResponseTime: 0
    };

    return {
      waste,
      pickups,
      compliance: complianceMetrics,
      performance: calculatePerformanceScore(waste, pickups, complianceMetrics)
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to fetch clinic performance metrics', error);
  }
};

/**
 * Helper function to get time grouping for aggregation
 */
const getTimeGrouping = (groupBy) => {
  switch (groupBy) {
    case 'day':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    case 'week':
      return {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
    case 'month':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    case 'quarter':
      return {
        year: { $year: '$createdAt' },
        quarter: { $ceil: { $divide: [{ $month: '$createdAt' }, 3] } }
      };
    case 'year':
      return { year: { $year: '$createdAt' } };
    default:
      throw new ValidationError('Invalid groupBy parameter');
  }
};

/**
 * Helper function to format time period
 */
const formatPeriod = (period, groupBy) => {
  switch (groupBy) {
    case 'day':
      return new Date(period.year, period.month - 1, period.day).toISOString().split('T')[0];
    case 'week':
      return `${period.year}-W${period.week.toString().padStart(2, '0')}`;
    case 'month':
      return `${period.year}-${period.month.toString().padStart(2, '0')}`;
    case 'quarter':
      return `${period.year}-Q${period.quarter}`;
    case 'year':
      return period.year.toString();
    default:
      return period;
  }
};

/**
 * Helper function to calculate compliance metrics
 */
const calculateComplianceMetrics = async (clinicId, dateRange) => {
  const matchStage = { clinicId: new mongoose.Types.ObjectId(clinicId) };
  if (dateRange) matchStage.createdAt = dateRange;

  const [wasteCompliance, pickupCompliance] = await Promise.all([
    WasteLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          consistentLogging: {
            $stdDevPop: {
              $dateDiff: {
                startDate: '$createdAt',
                endDate: { $add: ['$createdAt', 24 * 60 * 60 * 1000] },
                unit: 'day'
              }
            }
          }
        }
      }
    ]),
    PickupRequest.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          completedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'collected'] }, 1, 0] }
          },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'collected'] },
                { $subtract: ['$collectedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ])
  ]);

  const waste = wasteCompliance[0] || { totalLogs: 0, consistentLogging: 0 };
  const pickups = pickupCompliance[0] || { totalRequests: 0, completedRequests: 0, avgResponseTime: 0 };

  return {
    wasteLogging: waste.totalLogs > 0 ? Math.min(1, 1 / (1 + waste.consistentLogging)) : 0,
    pickupCompletion: pickups.totalRequests > 0 ? pickups.completedRequests / pickups.totalRequests : 0,
    responseTime: pickups.avgResponseTime ? Math.min(1, 24 * 60 * 60 * 1000 / pickups.avgResponseTime) : 0
  };
};

/**
 * Helper function to calculate overall performance score
 */
const calculatePerformanceScore = (waste, pickups, compliance) => {
  const scores = {
    wasteManagement: waste.totalLogs > 0 ? Math.min(1, waste.totalLogs / 30) : 0,
    pickupEfficiency: pickups.totalRequests > 0 ? 
      (pickups.completedRequests / pickups.totalRequests) * (1 - pickups.cancelledRequests / pickups.totalRequests) : 0,
    compliance: (
      compliance.wasteLogging * COMPLIANCE_WEIGHTS.wasteLogging +
      compliance.pickupCompletion * COMPLIANCE_WEIGHTS.pickupCompletion +
      compliance.responseTime * COMPLIANCE_WEIGHTS.responseTime
    )
  };

  return {
    scores,
    overall: (scores.wasteManagement + scores.pickupEfficiency + scores.compliance) / 3
  };
}; 