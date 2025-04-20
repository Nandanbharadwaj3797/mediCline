import { ValidationError, NotFoundError } from '../utils/errors.js';
import wasteLogRepository from '../repository/wasteLogRepository.js';
import { validateObjectId } from '../utils/validation.js';

export const createWasteLog = async (data) => {
  try {
    if (!data.clinicId || !validateObjectId(data.clinicId)) {
      throw new ValidationError('Valid clinic ID is required');
    }

    return await wasteLogRepository.create(data);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new Error('Failed to create waste log');
  }
};

export const getWasteLogs = async (filters = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      clinicId,
      startDate,
      endDate,
      category
    } = filters;

    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const query = {};
    if (clinicId) query.clinicId = clinicId;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    return await wasteLogRepository.findWithFilters(query, options);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new Error('Failed to fetch waste logs');
  }
};

export const getWasteLogById = async (id) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid waste log ID');
    }

    const wasteLog = await wasteLogRepository.findById(id);
    if (!wasteLog) {
      throw new NotFoundError('Waste log not found');
    }

    return wasteLog;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new Error('Failed to fetch waste log');
  }
};

export const updateWasteLog = async (id, data) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid waste log ID');
    }

    const wasteLog = await wasteLogRepository.findById(id);
    if (!wasteLog) {
      throw new NotFoundError('Waste log not found');
    }

    // Check if log is within 24 hours for modification
    const hoursElapsed = (Date.now() - wasteLog.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      throw new ValidationError('Waste logs can only be modified within 24 hours of creation');
    }

    return await wasteLogRepository.update(id, {
      ...data,
      updatedAt: new Date()
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new Error('Failed to update waste log');
  }
};

export const deleteWasteLog = async (id) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid waste log ID');
    }

    const wasteLog = await wasteLogRepository.findById(id);
    if (!wasteLog) {
      throw new NotFoundError('Waste log not found');
    }

    // Check if log is within 24 hours for deletion
    const hoursElapsed = (Date.now() - wasteLog.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      throw new ValidationError('Waste logs can only be deleted within 24 hours of creation');
    }

    await wasteLogRepository.softDelete(id);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new Error('Failed to delete waste log');
  }
};

export const getWasteStatistics = async (filters = {}) => {
  try {
    const { clinicId, startDate, endDate } = filters;

    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    const query = {};
    if (clinicId) query.clinicId = clinicId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const statistics = await wasteLogRepository.getStatistics(query);
    return statistics;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new Error('Failed to fetch waste statistics');
  }
};