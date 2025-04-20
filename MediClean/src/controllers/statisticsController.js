import { ValidationError } from '../utils/errors.js';
import { fetchWasteStatistics } from '../services/wastelogservice.js';
import { fetchPickupStatistics } from '../services/pickupservice.js';
import { fetchUserStatistics } from '../services/userservice.js';

// GET /api/statistics/dashboard
export const handleGetDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = {
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
      endDate: endDate ? new Date(endDate) : new Date()
    };

    const filters = {
      clinicId: req.user.role === 'clinic' ? req.user.id : undefined,
      collectorId: req.user.role === 'collector' ? req.user.id : undefined,
      ...dateRange
    };

    const [wasteStats, pickupStats, userStats] = await Promise.all([
      fetchWasteStatistics(filters),
      fetchPickupStatistics(filters),
      fetchUserStatistics(filters)
    ]);

    res.json({
      waste: {
        totalVolume: wasteStats.totalVolume,
        categoryBreakdown: wasteStats.categoryBreakdown,
        monthlyTrends: wasteStats.monthlyTrends
      },
      pickups: {
        total: pickupStats.total,
        completed: pickupStats.completed,
        pending: pickupStats.pending,
        cancelled: pickupStats.cancelled,
        averageResponseTime: pickupStats.averageResponseTime,
        monthlyTrends: pickupStats.monthlyTrends
      },
      users: {
        totalClinics: userStats.clinics,
        totalCollectors: userStats.collectors,
        activeUsers: userStats.active,
        newUsersThisMonth: userStats.newUsers
      },
      dateRange
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/statistics/analytics
export const handleGetAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;
    const dateRange = {
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date()
    };

    if (!['admin', 'health'].includes(req.user.role)) {
      throw new ValidationError('Unauthorized to access analytics');
    }

    let analytics = {};

    switch (type) {
      case 'waste':
        analytics = await getWasteAnalytics(dateRange);
        break;
      case 'pickups':
        analytics = await getPickupAnalytics(dateRange);
        break;
      case 'users':
        analytics = await getUserAnalytics(dateRange);
        break;
      default:
        const [waste, pickups, users] = await Promise.all([
          getWasteAnalytics(dateRange),
          getPickupAnalytics(dateRange),
          getUserAnalytics(dateRange)
        ]);
        analytics = { waste, pickups, users };
    }

    res.json({
      analytics,
      dateRange
    });
  } catch (err) {
    next(err);
  }
};

// Inlined Helper Functions

const getWasteAnalytics = async (dateRange) => {
  const stats = await fetchWasteStatistics({
    ...dateRange,
    includeAnalytics: true
  });

  return {
    volumeMetrics: stats.volumeMetrics || {},
    categoryTrends: stats.categoryTrends || [],
    geographicalDistribution: stats.geographicalDistribution || [],
    complianceMetrics: stats.complianceMetrics || {},
    seasonalPatterns: stats.seasonalPatterns || []
  };
};

const getPickupAnalytics = async (dateRange) => {
  const stats = await fetchPickupStatistics({
    ...dateRange,
    includeAnalytics: true
  });

  return {
    responseTimeMetrics: stats.responseTimeMetrics || {},
    completionRates: stats.completionRates || {},
    collectorPerformance: stats.collectorPerformance || [],
    routeEfficiency: stats.routeEfficiency || [],
    peakTimes: stats.peakTimes || []
  };
};

const getUserAnalytics = async (dateRange) => {
  const stats = await fetchUserStatistics({
    ...dateRange,
    includeAnalytics: true
  });

  return {
    userGrowth: stats.userGrowth || [],
    activityMetrics: stats.activityMetrics || {},
    geographicalCoverage: stats.geographicalCoverage || [],
    userRetention: stats.userRetention || {},
    serviceUtilization: stats.serviceUtilization || {}
  };
};
