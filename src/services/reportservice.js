import mongoose from 'mongoose';
import WasteLog from '../models/wastelog.js';
import PickupRequest from '../models/pickuprequest.js';
import User from '../models/user.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import { validateObjectId } from '../utils/validation.js';
import { formatDate, parseDate, calculateDateRange } from '../utils/dateUtils.js';
import { createNotification } from './notificationservice.js';
import { Parser } from 'json2csv';
import { getWasteStatistics } from './statisticsservice.js';
import { getPickupStatistics } from './statisticsservice.js';

const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];
const REPORT_TYPES = ['waste', 'pickup', 'combined'];
const REPORT_FORMATS = ['json', 'csv', 'pdf'];

/**
 * Generates a waste management report
 */
export const generateWasteReport = async ({
  clinicId,
  startDate,
  endDate,
  format = 'json',
  includeDetails = true,
  notifyUser = false,
  userId = null
}) => {
  try {
    // Validate parameters
    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    // Validate and parse dates
    const { start, end } = validateAndParseDates(startDate, endDate);

    // Build query
    const query = {};
    if (clinicId) {
      const clinic = await User.findOne({ _id: clinicId, role: 'clinic' });
      if (!clinic) {
        throw new NotFoundError('Clinic not found');
      }
      query.clinicId = new mongoose.Types.ObjectId(clinicId);
    }
    if (start && end) {
      query.createdAt = { $gte: start, $lte: end };
    }

    // Get waste statistics
    const stats = await getWasteStatistics({
      clinicId,
      startDate: start,
      endDate: end,
      groupBy: 'month'
    });

    // Get waste logs if details are requested
    const wasteLogs = includeDetails ? await WasteLog.find(query)
      .populate('clinicId', 'name address')
      .sort({ createdAt: -1 })
      .lean() : [];

    const report = {
      metadata: {
        generatedAt: new Date(),
        reportType: 'waste',
        period: {
          from: start ? formatDate(start) : 'All time',
          to: end ? formatDate(end) : 'Present'
        },
        clinic: clinicId ? {
          id: clinicId,
          name: wasteLogs[0]?.clinicId?.name
        } : null
      },
      summary: {
        totalLogs: stats.summary.totalLogs,
        totalVolume: stats.summary.totalVolume,
        avgVolumePerLog: stats.summary.avgVolumePerLog,
        categoryBreakdown: stats.categoryBreakdown,
        trends: stats.timeSeries
      }
    };

    if (includeDetails) {
      report.details = wasteLogs.map(log => ({
        id: log._id,
        date: formatDate(log.createdAt),
        category: log.category,
        volumeKg: log.volumeKg,
        description: log.description,
        location: log.location,
        clinic: log.clinicId ? {
          name: log.clinicId.name,
          address: log.clinicId.address
        } : null
      }));
    }

    // Format report
    const formattedReport = await formatReport(report, format);

    // Send notification if requested
    if (notifyUser && userId) {
      await createNotification({
        userId,
        type: 'report_generated',
        title: 'Waste Report Generated',
        message: `Your waste report for ${report.metadata.period.from} to ${report.metadata.period.to} is ready`,
        category: 'administrative',
        data: {
          reportType: 'waste',
          period: report.metadata.period
        }
      });
    }

    return formattedReport;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to generate waste report', error);
  }
};

/**
 * Generates a pickup report
 */
export const generatePickupReport = async ({
  clinicId,
  collectorId,
  startDate,
  endDate,
  format = 'json',
  includeDetails = true,
  notifyUser = false,
  userId = null
}) => {
  try {
    // Validate parameters
    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }
    if (collectorId && !validateObjectId(collectorId)) {
      throw new ValidationError('Invalid collector ID');
    }

    // Validate and parse dates
    const { start, end } = validateAndParseDates(startDate, endDate);

    // Build query
    const query = {};
    if (clinicId) {
      const clinic = await User.findOne({ _id: clinicId, role: 'clinic' });
      if (!clinic) {
        throw new NotFoundError('Clinic not found');
      }
      query.clinicId = new mongoose.Types.ObjectId(clinicId);
    }
    if (collectorId) {
      const collector = await User.findOne({ _id: collectorId, role: 'collector' });
      if (!collector) {
        throw new NotFoundError('Collector not found');
      }
      query.collectorId = new mongoose.Types.ObjectId(collectorId);
    }
    if (start && end) {
      query.createdAt = { $gte: start, $lte: end };
    }

    // Get pickup statistics
    const stats = await getPickupStatistics({
      clinicId,
      collectorId,
      startDate: start,
      endDate: end,
      groupBy: 'month'
    });

    // Get pickup details if requested
    const pickups = includeDetails ? await PickupRequest.find(query)
      .populate('clinicId', 'name address')
      .populate('collectorId', 'name')
      .sort({ createdAt: -1 })
      .lean() : [];

    const report = {
      metadata: {
        generatedAt: new Date(),
        reportType: 'pickup',
        period: {
          from: start ? formatDate(start) : 'All time',
          to: end ? formatDate(end) : 'Present'
        },
        clinic: clinicId ? {
          id: clinicId,
          name: pickups[0]?.clinicId?.name
        } : null,
        collector: collectorId ? {
          id: collectorId,
          name: pickups[0]?.collectorId?.name
        } : null
      },
      summary: {
        totalRequests: stats.volumeMetrics.totalRequests,
        completedRequests: stats.statusBreakdown.find(s => s.status === 'collected')?.count || 0,
        cancelledRequests: stats.statusBreakdown.find(s => s.status === 'cancelled')?.count || 0,
        totalVolume: stats.volumeMetrics.totalVolume,
        avgVolume: stats.volumeMetrics.avgVolume,
        responseTime: {
          average: stats.responseTime.avgResponseTime,
          minimum: stats.responseTime.minResponseTime,
          maximum: stats.responseTime.maxResponseTime
        },
        statusBreakdown: stats.statusBreakdown,
        trends: stats.timeSeries
      }
    };

    if (includeDetails) {
      report.details = pickups.map(pickup => ({
        id: pickup._id,
        requestDate: formatDate(pickup.createdAt),
        status: pickup.status,
        clinic: pickup.clinicId ? {
          name: pickup.clinicId.name,
          address: pickup.clinicId.address
        } : null,
        collector: pickup.collectorId ? {
          name: pickup.collectorId.name
        } : null,
        wasteType: pickup.wasteType,
        volumeKg: pickup.volumeKg,
        location: pickup.location,
        notes: pickup.notes,
        collectionDate: pickup.collectedAt ? formatDate(pickup.collectedAt) : null,
        responseTime: pickup.collectedAt ? 
          (pickup.collectedAt - pickup.createdAt) / (1000 * 60 * 60) : null // in hours
      }));
    }

    // Format report
    const formattedReport = await formatReport(report, format);

    // Send notification if requested
    if (notifyUser && userId) {
      await createNotification({
        userId,
        type: 'report_generated',
        title: 'Pickup Report Generated',
        message: `Your pickup report for ${report.metadata.period.from} to ${report.metadata.period.to} is ready`,
        category: 'administrative',
        data: {
          reportType: 'pickup',
          period: report.metadata.period
        }
      });
    }

    return formattedReport;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to generate pickup report', error);
  }
};

/**
 * Schedules periodic report generation
 */
export const scheduleReport = async ({
  userId,
  reportType,
  frequency,
  parameters,
  recipients,
  format = 'json'
}) => {
  try {
    // Validate parameters
    if (!validateObjectId(userId)) {
      throw new ValidationError('Invalid user ID');
    }
    if (!REPORT_TYPES.includes(reportType)) {
      throw new ValidationError(`Invalid report type. Must be one of: ${REPORT_TYPES.join(', ')}`);
    }
    if (!REPORT_FREQUENCIES.includes(frequency)) {
      throw new ValidationError(`Invalid frequency. Must be one of: ${REPORT_FREQUENCIES.join(', ')}`);
    }
    if (!REPORT_FORMATS.includes(format)) {
      throw new ValidationError(`Invalid format. Must be one of: ${REPORT_FORMATS.join(', ')}`);
    }

    // Validate recipients
    if (recipients && recipients.length > 0) {
      const validRecipients = await User.find({
        _id: { $in: recipients }
      }).select('_id email');

      if (validRecipients.length !== recipients.length) {
        throw new ValidationError('One or more recipients not found');
      }
    }

    // TODO: Implement report scheduling logic
    // This would typically involve:
    // 1. Creating a schedule record in the database
    // 2. Setting up a cron job or similar scheduling mechanism
    // 3. Configuring email delivery for the reports
    throw new Error('Report scheduling not implemented');
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new InternalError('Failed to schedule report', error);
  }
};

/**
 * Helper function to validate and parse dates
 */
const validateAndParseDates = (startDate, endDate) => {
  let start = null;
  let end = null;

  if (startDate) {
    start = parseDate(startDate);
    if (isNaN(start.getTime())) {
      throw new ValidationError('Invalid start date');
    }
  }

  if (endDate) {
    end = parseDate(endDate);
    if (isNaN(end.getTime())) {
      throw new ValidationError('Invalid end date');
    }
  }

  if (start && end && end < start) {
    throw new ValidationError('End date must be after start date');
  }

  return { start, end };
};

/**
 * Helper function to format report in different formats
 */
const formatReport = async (report, format) => {
  switch (format.toLowerCase()) {
    case 'json':
      return report;
    
    case 'csv':
      try {
        const fields = [];
        const data = [];

        // Add metadata fields
        fields.push(
          'reportType',
          'generatedAt',
          'periodFrom',
          'periodTo'
        );

        // Add summary fields based on report type
        if (report.metadata.reportType === 'waste') {
          fields.push(
            'totalLogs',
            'totalVolume',
            'avgVolumePerLog'
          );
        } else if (report.metadata.reportType === 'pickup') {
          fields.push(
            'totalRequests',
            'completedRequests',
            'cancelledRequests',
            'totalVolume',
            'avgResponseTime'
          );
        }

        // Add details if available
        if (report.details) {
          report.details.forEach(detail => {
            const row = {
              reportType: report.metadata.reportType,
              generatedAt: formatDate(report.metadata.generatedAt),
              periodFrom: report.metadata.period.from,
              periodTo: report.metadata.period.to,
              ...report.summary,
              ...detail
            };

            // Flatten nested objects
            if (detail.clinic) {
              row.clinicName = detail.clinic.name;
              row.clinicAddress = detail.clinic.address;
              delete row.clinic;
            }
            if (detail.collector) {
              row.collectorName = detail.collector.name;
              delete row.collector;
            }
            if (detail.location) {
              row.latitude = detail.location.coordinates[1];
              row.longitude = detail.location.coordinates[0];
              delete row.location;
            }

            data.push(row);
          });
        }

        const parser = new Parser({ fields });
        return parser.parse(data);
      } catch (error) {
        throw new InternalError('Failed to convert report to CSV', error);
      }

    case 'pdf':
      // TODO: Implement PDF generation
      throw new Error('PDF format not implemented');

    default:
      throw new ValidationError(`Unsupported format: ${format}`);
  }
};