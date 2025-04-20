import express from 'express';
import {
  handleRequestPickup,
  handleGetPickupHistory,
  handleGetCollectorPickups,
  handleGetPickupStatistics,
  handleGetNearbyPickups,
  handleGetAllPickups,
  handleGetPickupById,
  handleUpdatePickup,
  cancelPickupRequest,
  handleAssignCollector,
  handleDeletePickupRequest,
  handleBulkUpdateStatus
} from '../../controllers/pickupController.js';

import { authenticate, authorize } from '../../middlewares/auth.js';

import {
  apiLimiter,
  writeOperationsLimiter,
  bulkOperationsLimiter,
  analyticsLimiter,
  emergencyLimiter
} from '../../middlewares/rateLimiter.js';

import {
  validatePickupRequest,
  validatePickupRequestUpdate,
  validateBulkStatusUpdate,
  validateNearbyParams,
  validateAnalyticsParams,
  validateFilterParams
} from '../../validations/pickupValidation.js';

const router = express.Router();

// Global API rate limiting
router.use(apiLimiter);

// Require authentication for all routes
router.use(authenticate);

//
// GET ROUTES
//

// Fetch pickup history (accessible to all roles)
router.get('/history', validateFilterParams, handleGetPickupHistory);

// Fetch pickups for logged-in collector
router.get('/collector', authorize(['collector']), validateFilterParams, handleGetCollectorPickups);

// Fetch single pickup by ID
router.get('/:id', handleGetPickupById);

// Fetch all pickups (admin only)
router.get('/all', analyticsLimiter, authorize(['admin']), validateFilterParams, handleGetAllPickups);

// Fetch pickup statistics
router.get('/statistics', analyticsLimiter, validateAnalyticsParams, handleGetPickupStatistics);

// Fetch nearby pickups for collectors
router.get('/nearby', analyticsLimiter, authorize(['collector']), validateNearbyParams, handleGetNearbyPickups);

//
// POST ROUTES
//

// Request pickup (regular)
router.post('/request', writeOperationsLimiter, validatePickupRequest, handleRequestPickup);

// Request emergency pickup
router.post('/emergency', emergencyLimiter, validatePickupRequest, handleRequestPickup);

// Bulk assign (admin only)
router.post('/bulk/assign', bulkOperationsLimiter, authorize(['admin']), validateBulkStatusUpdate, handleAssignCollector);

//
// PATCH ROUTES
//

// Update pickup request
router.patch('/:id', writeOperationsLimiter, validatePickupRequestUpdate, handleUpdatePickup);

// Assign collector to pickup (admin)
router.patch('/:id/assign', writeOperationsLimiter, authorize(['admin']), validatePickupRequestUpdate, handleAssignCollector);

// Cancel pickup request
router.patch('/:id/cancel', writeOperationsLimiter, validatePickupRequestUpdate, cancelPickupRequest);

// Bulk status update (admin or collector)
router.patch('/bulk/status', bulkOperationsLimiter, authorize(['admin', 'collector']), validateBulkStatusUpdate, handleBulkUpdateStatus);

//
// DELETE ROUTES
//

// Delete pickup (admin only)
router.delete('/:id', writeOperationsLimiter, authorize(['admin']), handleDeletePickupRequest);

export default router;
