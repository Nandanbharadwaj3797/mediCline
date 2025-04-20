import express from 'express';
import { 
  authMiddleware, 
  clinicOnly, 
  clinicOrCollector, 
  clinicOrHealth 
} from '../../middlewares/authMiddlewares.js';
import { validateRequest, validatePagination, sanitizeRequest } from '../../middlewares/validationMiddleware.js';
import {
  handleCreateWasteLog,
  handleGetWasteLogs,
  handleGetWasteLogById,
  handleUpdateWasteLog,
  handleDeleteWasteLog,
  handleGetWasteStatistics
} from '../../controllers/wasteLogController.js';

const router = express.Router();

// Create waste log
router.post(
  '/',
  clinicOnly,
  sanitizeRequest(),
  handleCreateWasteLog
);

// Get all waste logs with filters
router.get(
  '/',
  authMiddleware(['clinic', 'collector', 'health']),
  validatePagination(),
  handleGetWasteLogs
);

// Get waste log by ID
router.get(
  '/:id',
  authMiddleware(['clinic', 'collector', 'health']),
  handleGetWasteLogById
);

// Update waste log
router.patch(
  '/:id',
  clinicOnly,
  sanitizeRequest(),
  handleUpdateWasteLog
);

// Delete waste log
router.delete(
  '/:id',
  clinicOnly,
  handleDeleteWasteLog
);

// Get waste statistics
router.get(
  '/statistics',
  clinicOrHealth,
  handleGetWasteStatistics
);

export default router; 