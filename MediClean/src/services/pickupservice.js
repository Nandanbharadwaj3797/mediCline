import pickupRepository from '../repository/pickupRepository.js';
import { createNotification } from './notificationservice.js';
import { ValidationError, NotFoundError, InternalError } from '../utils/errors.js';
import { validateObjectId, validateCoordinates } from '../utils/validation.js';

const PICKUP_CANCELLATION_WINDOW = 48; // hours
const MAX_ACTIVE_REQUESTS = 5; // per clinic

// Creates a new pickup request
export const addPickupRequest = async (data) => {
  try {
    if (!validateObjectId(data.clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }

    if (data.location && !validateCoordinates(data.location.coordinates)) {
      throw new ValidationError('Invalid coordinates');
    }

    // Check active requests limit
    const activeRequests = await pickupRepository.findByStatus(['pending', 'assigned']);
    if (activeRequests.docs.length >= MAX_ACTIVE_REQUESTS) {
      throw new ValidationError(`Maximum active requests (${MAX_ACTIVE_REQUESTS}) reached`);
    }

    if (data.emergency?.isEmergency) {
      data.priority = 'urgent';
    }

    const pickupRequest = await pickupRepository.create(data);

    await createNotification({
      userId: pickupRequest.clinicId,
      type: 'pickup_request',
      title: 'New Pickup Request Created',
      message: `${pickupRequest.priority.toUpperCase()} priority pickup request #${pickupRequest._id} has been created`,
      category: 'operational',
      priority: pickupRequest.priority,
      data: {
        pickupRequestId: pickupRequest._id,
        wasteType: pickupRequest.wasteType,
        volumeKg: pickupRequest.volumeKg,
        priority: pickupRequest.priority
      }
    });

    return pickupRequest;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to create pickup request', error);
  }
};

// Fetches all pickup requests with filters and pagination
export const fetchAllPickupRequests = async ({
  page = 1,
  limit = 20,
  sortBy = 'priority',
  sortOrder = 'desc',
  status = null,
  priority = null,
  wasteType = null,
  startDate = null,
  endDate = null,
  clinicId = null,
  collectorId = null,
  minVolume = null,
  maxVolume = null,
  isOverdue = false,
  isEmergency = false
} = {}) => {
  try {
    if (clinicId && !validateObjectId(clinicId)) {
      throw new ValidationError('Invalid clinic ID');
    }
    if (collectorId && !validateObjectId(collectorId)) {
      throw new ValidationError('Invalid collector ID');
    }

    const filters = {
      status,
      priority,
      wasteType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      clinicId,
      collectorId,
      minVolume: minVolume ? Number(minVolume) : null,
      maxVolume: maxVolume ? Number(maxVolume) : null,
      isOverdue,
      isEmergency
    };

    const options = {
      page,
      limit,
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const result = await pickupRepository.findWithFilters(filters, options);
    const [statusCounts, priorityCounts] = await Promise.all([
      pickupRepository.getStatusCounts(),
      pickupRepository.getPriorityCounts()
    ]);

    return {
      ...result,
      statistics: {
        statusCounts,
        priorityCounts,
        totalRequests: Object.values(statusCounts).reduce((a, b) => a + b, 0)
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to fetch pickup requests', error);
  }
};

// Fetch a single pickup request by ID
export const fetchPickupRequestById = async (id) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid pickup request ID');
    }

    return await pickupRepository.findById(id);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to fetch pickup request', error);
  }
};

// Update pickup request
export const modifyPickupRequest = async (id, updatedData, userId) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid pickup request ID');
    }

    if (updatedData.location && !validateCoordinates(updatedData.location.coordinates)) {
      throw new ValidationError('Invalid coordinates');
    }

    const pickupRequest = await pickupRepository.update(id, updatedData);

    if (updatedData.status) {
      const notificationData = {
        userId: pickupRequest.clinicId,
        type: `pickup_${updatedData.status}`,
        title: `Pickup Request ${updatedData.status.charAt(0).toUpperCase() + updatedData.status.slice(1)}`,
        message: `Pickup request #${pickupRequest._id} has been ${updatedData.status}`,
        category: 'operational',
        data: {
          pickupRequestId: pickupRequest._id,
          status: updatedData.status,
          updatedBy: userId
        }
      };

      if (updatedData.status === 'assigned' && pickupRequest.collectorId) {
        notificationData.recipients = [pickupRequest.collectorId];
      }

      await createNotification(notificationData);
    }

    return pickupRequest;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to update pickup request', error);
  }
};

// Assign collector to pickup request
export const assignPickupCollector = async (pickupRequestId, collectorId) => {
  try {
    if (!validateObjectId(pickupRequestId) || !validateObjectId(collectorId)) {
      throw new ValidationError('Invalid pickup request or collector ID');
    }

    const updatedRequest = await pickupRepository.assignCollector(pickupRequestId, collectorId);

    await createNotification({
      userId: updatedRequest.clinicId,
      type: 'pickup_assigned',
      title: 'Pickup Assigned',
      message: `Collector assigned to pickup request #${pickupRequestId}`,
      category: 'operational',
      recipients: [collectorId],
      data: { pickupRequestId }
    });

    return updatedRequest;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to assign collector to pickup request', error);
  }
};

// Cancel a pickup request
export const cancelPickup = async (pickupRequestId, reason, userId) => {
  try {
    if (!validateObjectId(pickupRequestId)) {
      throw new ValidationError('Invalid pickup request ID');
    }

    const updatedRequest = await pickupRepository.updateStatus(pickupRequestId, 'cancelled', reason);

    await createNotification({
      userId,
      type: 'pickup_cancelled',
      title: 'Pickup Cancelled',
      message: `Pickup request #${pickupRequestId} has been cancelled`,
      category: 'operational',
      data: { pickupRequestId, reason }
    });

    return updatedRequest;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to cancel pickup request', error);
  }
};

// Find nearby pickups based on location
export const findNearbyPickups = async (location, radius = 5000) => {
  try {
    if (!validateCoordinates(location?.coordinates)) {
      throw new ValidationError('Invalid location coordinates');
    }

    return await pickupRepository.findNearby(location, radius);
  } catch (error) {
    throw new InternalError('Failed to fetch nearby pickups', error);
  }
};

// Fetch pickup statistics (analytics)
export const getPickupAnalytics = async (filters = {}) => {
  try {
    return await pickupRepository.getStatistics(filters);
  } catch (error) {
    throw new InternalError('Failed to get pickup analytics', error);
  }
};
export const bulkUpdatePickupStatus = async (ids, status, reason = '', userId) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('Invalid pickup request IDs');
    }

    const updateResult = await pickupRepository.bulkUpdateStatus(ids, status, reason, userId);
    return updateResult;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError('Failed to bulk update pickup statuses', error);
  }
};

// Delete a pickup request
export const deletePickupRequest = async (id) => {
  try {
    if (!validateObjectId(id)) {
      throw new ValidationError('Invalid pickup request ID');
    }

    const result = await pickupRepository.delete(id);
    if (!result) {
      throw new NotFoundError('Pickup request not found');
    }

    return result;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
    throw new InternalError('Failed to delete pickup request', error);
  }
};
