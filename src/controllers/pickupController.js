import {
  addPickupRequest,
  fetchAllPickupRequests,
  fetchPickupRequestById,
  modifyPickupRequest,
  assignPickupCollector,
  cancelPickup,
  findNearbyPickups,
  getPickupAnalytics,
  deletePickupRequest,
  bulkUpdatePickupStatus
} from '../services/pickupservice.js';

/**
 * Request a new pickup
 */
export const handleRequestPickup = async (req, res) => {
  try {
    const data = {
      ...req.body,
      clinicId: req.user.id // assumes user ID is clinic if authenticated
    };
    const pickupRequest = await addPickupRequest(data);
    res.status(201).json(pickupRequest);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Fetch pickup history
 */
export const handleGetPickupHistory = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      clinicId: req.user.role === 'clinic' ? req.user.id : req.query.clinicId,
      collectorId: req.user.role === 'collector' ? req.user.id : req.query.collectorId
    };
    const result = await fetchAllPickupRequests(filters);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Fetches a single pickup request by ID
 */
export const handleGetPickupById = async (req, res) => {
  try {
    const { id } = req.params;
    const pickupRequest = await fetchPickupRequestById(id);
    res.status(200).json(pickupRequest);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Updates a pickup request
 */
export const handleUpdatePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    const userId = req.user.id;
    const updatedPickupRequest = await modifyPickupRequest(id, updatedData, userId);
    res.status(200).json(updatedPickupRequest);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Fetches pickup statistics
 */
export const handleGetPickupStatistics = async (req, res) => {
  try {
    const filters = {
      clinicId: req.user.role === 'clinic' ? req.user.id : req.query.clinicId,
      collectorId: req.user.role === 'collector' ? req.user.id : req.query.collectorId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const analytics = await getPickupAnalytics(filters);
    res.status(200).json(analytics);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Assigns a collector to a pickup request
 */
export const handleAssignCollector = async (req, res) => {
  try {
    const { id } = req.params;
    const { collectorId } = req.body;
    const result = await assignPickupCollector(id, collectorId);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Finds nearby pickup requests
 */
export const handleGetNearbyPickups = async (req, res) => {
  try {
    const { longitude, latitude, radius = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Longitude and latitude are required' });
    }

    const location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    const pickups = await findNearbyPickups(location, parseInt(radius));
    res.status(200).json(pickups);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Bulk update status of multiple pickup requests
 */
export const handleBulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status, reason } = req.body;

    if (!Array.isArray(ids) || !status) {
      return res.status(400).json({ message: 'Missing ids or status' });
    }

    const result = await bulkUpdatePickupStatus(ids, status, reason, req.user.id);
    res.status(200).json({
      message: 'Pickup statuses updated successfully',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Deletes a pickup request
 */
export const handleDeletePickupRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await deletePickupRequest(id);
    res.status(204).send();
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Fetches all pickup requests (admin only)
 */
export const handleGetAllPickups = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      // Admin can see all pickups, no need to filter by clinic or collector
    };
    const result = await fetchAllPickupRequests(filters);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Fetches all pickup requests for a specific collector
 */
export const handleGetCollectorPickups = async (req, res) => {
  try {
    const filters = {
      ...req.query,
      collectorId: req.user.id, // Only show pickups assigned to this collector
      // Don't allow overriding collectorId from query params for security
    };
    const result = await fetchAllPickupRequests(filters);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

/**
 * Cancels a pickup request
 */
export const cancelPickupRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const result = await cancelPickup(id, reason, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};
