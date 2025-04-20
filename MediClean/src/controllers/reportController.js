import { ValidationError } from '../utils/errors.js';
import {
  generateWasteReport,
  generatePickupReport,
  fetchReportById,
  fetchUserReports,
  deleteReport,
  scheduleReport
} from '../services/reportservice.js';

const generateReportByType = async ({ type, ...options }) => {
  switch (type) {
    case 'waste':
      return await generateWasteReport(options);
    case 'pickup':
      return await generatePickupReport(options);
    default:
      throw new ValidationError('Invalid report type');
  }
};

// POST /api/reports/generate
export const handleGenerateReport = async (req, res, next) => {
  try {
    const { type, startDate, endDate, format = 'pdf', filters = {} } = req.body;

    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    const reportFilters = {
      ...filters,
      clinicId: req.user.role === 'clinic' ? req.user.id : filters.clinicId,
      collectorId: req.user.role === 'collector' ? req.user.id : filters.collectorId
    };

    if ((reportFilters.clinicId && req.user.role === 'clinic' && reportFilters.clinicId !== req.user.id) ||
        (reportFilters.collectorId && req.user.role === 'collector' && reportFilters.collectorId !== req.user.id)) {
      throw new ValidationError('Unauthorized to generate report for other users');
    }

    const report = await generateReportByType({
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format,
      filters: reportFilters,
      generatedBy: req.user.id,
      generatedFor: reportFilters.clinicId || reportFilters.collectorId || 'all'
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports/:id
export const handleGetReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await fetchReportById(id);

    if (!report) {
      throw new ValidationError('Report not found');
    }

    // Authorization check
    if (req.user.role === 'clinic' && report.generatedFor !== req.user.id) {
      throw new ValidationError('Unauthorized to access this report');
    }
    if (req.user.role === 'collector' && report.generatedFor !== req.user.id) {
      throw new ValidationError('Unauthorized to access this report');
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
};

// GET /api/reports
export const handleGetUserReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, startDate, endDate } = req.query;

    const filters = {
      userId: req.user.id,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: Number(page),
      limit: Number(limit)
    };

    const reports = await fetchUserReports(filters);
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reports/:id
export const handleDeleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await fetchReportById(id);

    if (!report) {
      throw new ValidationError('Report not found');
    }

    if (req.user.role !== 'admin' && report.generatedBy !== req.user.id) {
      throw new ValidationError('Unauthorized to delete this report');
    }

    await deleteReport(id);
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/reports/schedule
export const handleScheduleReport = async (req, res, next) => {
  try {
    const { 
      type,
      frequency,
      format = 'pdf',
      filters = {},
      recipients = [],
      startTime,
      endTime
    } = req.body;

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      throw new ValidationError(`Frequency must be one of: ${validFrequencies.join(', ')}`);
    }

    const reportFilters = {
      ...filters,
      clinicId: req.user.role === 'clinic' ? req.user.id : filters.clinicId,
      collectorId: req.user.role === 'collector' ? req.user.id : filters.collectorId
    };

    if (!['admin', 'health'].includes(req.user.role)) {
      throw new ValidationError('Unauthorized to schedule reports');
    }

    const schedule = await scheduleReport({
      type,
      frequency,
      format,
      filters: reportFilters,
      recipients,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : null,
      createdBy: req.user.id
    });

    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
};

export const handleRequestPickup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { collectorId } = req.body;
    const userId = req.user.id;
    const result = await assignPickupCollector(id, collectorId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
export const handleGetPickupHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await fetchPickupHistory(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const handleCancelPickup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const result = await cancelPickup(id, reason, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};