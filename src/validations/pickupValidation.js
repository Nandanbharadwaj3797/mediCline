import mongoose from 'mongoose';
import {
  validateString,
  validateNumber,
  validateEnum,
  validateDate,
  validateObject,
  validateArray,
  combineValidations,
  createValidationResult
} from './commonValidation.js';

import { validateCoordinates } from './userValidation.js';

// Constants
const WASTE_TYPES = ['sharps', 'biohazard', 'expired_meds', 'others'];
const PICKUP_STATUSES = ['pending', 'assigned', 'collected', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_VOLUME_KG = 1000;
const MAX_NOTE_LENGTH = 200;
const MAX_BULK_OPERATIONS = 50;

// Waste type validation
export const validateWasteType = (type) => {
  return validateEnum(type, {
    values: WASTE_TYPES,
    fieldName: 'Waste type',
    caseSensitive: true
  });
};

// Status validation
export const validateStatus = (status) => {
  return validateEnum(status, {
    values: PICKUP_STATUSES,
    fieldName: 'Status',
    caseSensitive: true
  });
};

// Volume validation
export const validateVolume = (volumeKg) => {
  return validateNumber(volumeKg, {
    min: 0,
    max: MAX_VOLUME_KG,
    positive: true,
    fieldName: 'Volume'
  });
};

// Description validation
export const validateDescription = (description) => {
  return validateString(description, {
    required: false,
    max: MAX_DESCRIPTION_LENGTH,
    trim: true,
    fieldName: 'Description'
  });
};

// Note validation
export const validateNote = (note) => {
  return validateString(note, {
    required: false,
    max: MAX_NOTE_LENGTH,
    trim: true,
    fieldName: 'Note'
  });
};

// Location validation
export const validateLocation = (location) => {
  if (!location) {
    return createValidationResult(false, 'Location is required');
  }

  return validateObject(location, {
    type: {
      required: true,
      validate: (type) => validateEnum(type, {
        values: ['Point'],
        fieldName: 'Location type'
      })
    },
    coordinates: {
      required: true,
      validate: (coords) => {
        if (!Array.isArray(coords) || coords.length !== 2) {
          return createValidationResult(false, 'Coordinates must be an array of [longitude, latitude]');
        }

        const [longitude, latitude] = coords;

        const lonValidation = validateNumber(longitude, {
          min: -180,
          max: 180,
          fieldName: 'Longitude'
        });
        if (!lonValidation.isValid) return lonValidation;

        const latValidation = validateNumber(latitude, {
          min: -90,
          max: 90,
          fieldName: 'Latitude'
        });
        if (!latValidation.isValid) return latValidation;

        return createValidationResult(true);
      }
    }
  }, {
    fieldName: 'Location'
  });
};

// Date validation
export const validatePickupDate = (date, fieldName = 'Date') => {
  return validateDate(date, {
    past: true,
    fieldName
  });
};

// Date range validation
export const validateDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return createValidationResult(true);
  }

  const validations = [];

  if (startDate) {
    validations.push(validatePickupDate(startDate, 'Start date'));
  }

  if (endDate) {
    validations.push(validatePickupDate(endDate, 'End date'));
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return createValidationResult(false, 'Start date cannot be after end date');
    }
  }

  return combineValidations(...validations);
};

// Pagination validation
export const validatePagination = (page, limit) => {
  const validations = [];

  if (page !== undefined) {
    validations.push(validateNumber(page, {
      required: true,
      min: 1,
      integer: true,
      fieldName: 'Page'
    }));
  }

  if (limit !== undefined) {
    validations.push(validateNumber(limit, {
      required: true,
      min: 1,
      max: 100,
      integer: true,
      fieldName: 'Limit'
    }));
  }

  return combineValidations(...validations);
};

// ObjectId validation
export const validateId = (id, fieldName = 'ID') => {
  const stringValidation = validateString(id, {
    required: true,
    fieldName
  });
  if (!stringValidation.isValid) return stringValidation;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return createValidationResult(false, `Invalid ${fieldName} format`);
  }

  return createValidationResult(true);
};

// Status transition validation
export const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    pending: ['assigned', 'cancelled'],
    assigned: ['collected', 'cancelled'],
    collected: [],
    cancelled: []
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return createValidationResult(
      false,
      `Cannot transition from ${currentStatus} to ${newStatus}`
    );
  }

  return createValidationResult(true);
};

// Priority validation
export const validatePriority = (priority) => {
  return validateEnum(priority, {
    values: PRIORITIES,
    fieldName: 'Priority',
    caseSensitive: true
  });
};

// Validate new pickup request
export const validatePickupRequest = (data) => {
  return validateObject(data, {
    wasteType: {
      required: true,
      validate: validateWasteType
    },
    volumeKg: {
      required: true,
      validate: validateVolume
    },
    description: {
      required: false,
      validate: validateDescription
    },
    location: {
      required: true,
      validate: validateLocation
    },
    priority: {
      required: false,
      validate: validatePriority
    },
    emergency: {
      required: false,
      validate: (emergency) => {
        if (!emergency) return createValidationResult(true);
        
        return validateObject(emergency, {
          isEmergency: {
            required: true,
            validate: (value) => createValidationResult(typeof value === 'boolean', 'isEmergency must be a boolean')
          },
          reason: {
            required: true,
            validate: (reason) => validateString(reason, {
              required: true,
              max: MAX_DESCRIPTION_LENGTH,
              fieldName: 'Emergency reason'
            })
          },
          responseDeadline: {
            required: true,
            validate: (date) => validatePickupDate(date, {
              future: true,
              fieldName: 'Response deadline'
            })
          }
        });
      }
    }
  }, {
    fieldName: 'Pickup request'
  });
};

// Validate pickup request update
export const validatePickupRequestUpdate = (data, currentStatus) => {
  const baseValidation = validateObject(data, {
    wasteType: {
      required: false,
      validate: validateWasteType
    },
    volumeKg: {
      required: false,
      validate: validateVolume
    },
    description: {
      required: false,
      validate: validateDescription
    },
    location: {
      required: false,
      validate: validateLocation
    },
    priority: {
      required: false,
      validate: validatePriority
    },
    status: {
      required: false,
      validate: (status) => {
        const statusValidation = validateStatus(status);
        if (!statusValidation.isValid) return statusValidation;

        return validateStatusTransition(currentStatus, status);
      }
    },
    note: {
      required: false,
      validate: validateNote
    }
  }, {
    fieldName: 'Pickup request update',
    allowUnknown: false
  });

  if (!baseValidation.isValid) return baseValidation;

  // Additional validation for status changes
  if (data.status === 'assigned' && !data.collectorId) {
    return createValidationResult(false, 'Collector ID is required when assigning a request');
  }

  // Validate priority changes for emergency requests
  if (data.priority && data.emergency?.isEmergency && data.priority !== 'urgent') {
    return createValidationResult(false, 'Emergency requests must maintain urgent priority');
  }

  return createValidationResult(true);
};

// Validate collector assignment
export const validateCollectorAssignment = (data) => {
  return validateObject(data, {
    collectorId: {
      required: true,
      validate: (id) => validateId(id, 'Collector ID')
    },
    note: {
      required: false,
      validate: validateNote
    }
  }, {
    fieldName: 'Collector assignment'
  });
};

// Validate cancellation
export const validateCancellation = (data) => {
  return validateObject(data, {
    reason: {
      required: true,
      validate: (reason) => validateString(reason, {
        required: true,
        max: MAX_NOTE_LENGTH,
        trim: true,
        fieldName: 'Cancellation reason'
      })
    },
    note: {
      required: false,
      validate: validateNote
    }
  }, {
    fieldName: 'Cancellation'
  });
};

/**
 * Validate bulk status update
 */
export const validateBulkStatusUpdate = (updates) => {
  if (!Array.isArray(updates)) {
    return createValidationResult(false, 'Updates must be an array');
  }

  if (updates.length === 0) {
    return createValidationResult(false, 'Updates array cannot be empty');
  }

  if (updates.length > MAX_BULK_OPERATIONS) {
    return createValidationResult(
      false,
      `Cannot update more than ${MAX_BULK_OPERATIONS} requests at once`
    );
  }

  return validateArray(updates, {
    validate: (update) => validateObject(update, {
      id: {
        required: true,
        validate: (id) => validateId(id, 'Request ID')
      },
      status: {
        required: true,
        validate: validateStatus
      },
      note: {
        required: false,
        validate: validateNote
      }
    }),
    fieldName: 'Status updates'
  });
};

/**
 * Validate nearby pickup request parameters
 */
export const validateNearbyParams = (params) => {
  return validateObject(params, {
    longitude: {
      required: true,
      validate: (lon) => validateNumber(lon, {
        min: -180,
        max: 180,
        fieldName: 'Longitude'
      })
    },
    latitude: {
      required: true,
      validate: (lat) => validateNumber(lat, {
        min: -90,
        max: 90,
        fieldName: 'Latitude'
      })
    },
    maxDistance: {
      required: false,
      validate: (dist) => validateNumber(dist, {
        min: 0,
        max: 50000, // 50km
        fieldName: 'Maximum distance'
      })
    },
    status: {
      required: false,
      validate: (status) => {
        if (Array.isArray(status)) {
          return validateArray(status, {
            validate: validateStatus,
            fieldName: 'Status'
          });
        }
        return validateStatus(status);
      }
    }
  }, {
    fieldName: 'Nearby parameters'
  });
};

/**
 * Validate analytics parameters
 */
export const validateAnalyticsParams = (params) => {
  return validateObject(params, {
    clinicId: {
      required: false,
      validate: (id) => validateId(id, 'Clinic ID')
    },
    collectorId: {
      required: false,
      validate: (id) => validateId(id, 'Collector ID')
    },
    startDate: {
      required: false,
      validate: (date) => validatePickupDate(date, 'Start date')
    },
    endDate: {
      required: false,
      validate: (date) => validatePickupDate(date, 'End date')
    }
  }, {
    fieldName: 'Analytics parameters'
  });
};

/**
 * Validate priority update
 */
export const validatePriorityUpdate = (data) => {
  return validateObject(data, {
    priority: {
      required: true,
      validate: validatePriority
    },
    note: {
      required: false,
      validate: validateNote
    }
  }, {
    fieldName: 'Priority update'
  });
};

/**
 * Validate filter parameters
 */
export const validateFilterParams = (params) => {
  return validateObject(params, {
    status: {
      required: false,
      validate: validateStatus
    },
    priority: {
      required: false,
      validate: validatePriority
    },
    wasteType: {
      required: false,
      validate: validateWasteType
    },
    startDate: {
      required: false,
      validate: (date) => validatePickupDate(date, 'Start date')
    },
    endDate: {
      required: false,
      validate: (date) => validatePickupDate(date, 'End date')
    },
    clinicId: {
      required: false,
      validate: (id) => validateId(id, 'Clinic ID')
    },
    collectorId: {
      required: false,
      validate: (id) => validateId(id, 'Collector ID')
    },
    minVolume: {
      required: false,
      validate: (vol) => validateNumber(vol, {
        min: 0,
        fieldName: 'Minimum volume'
      })
    },
    maxVolume: {
      required: false,
      validate: (vol) => validateNumber(vol, {
        min: 0,
        max: MAX_VOLUME_KG,
        fieldName: 'Maximum volume'
      })
    },
    isOverdue: {
      required: false,
      validate: (value) => createValidationResult(typeof value === 'boolean', 'isOverdue must be a boolean')
    },
    isEmergency: {
      required: false,
      validate: (value) => createValidationResult(typeof value === 'boolean', 'isEmergency must be a boolean')
    },
    page: {
      required: false,
      validate: (page) => validateNumber(page, {
        min: 1,
        integer: true,
        fieldName: 'Page'
      })
    },
    limit: {
      required: false,
      validate: (limit) => validateNumber(limit, {
        min: 1,
        max: 100,
        integer: true,
        fieldName: 'Limit'
      })
    },
    sortBy: {
      required: false,
      validate: (field) => validateEnum(field, {
        values: ['requestedAt', 'volumeKg', 'status', 'wasteType', 'priority'],
        fieldName: 'Sort field'
      })
    },
    sortOrder: {
      required: false,
      validate: (order) => validateEnum(order, {
        values: ['asc', 'desc'],
        fieldName: 'Sort order',
        caseSensitive: false
      })
    }
  }, {
    fieldName: 'Filter parameters'
  });
};

// Export shared validation helpers
export {
  validateDate
};
