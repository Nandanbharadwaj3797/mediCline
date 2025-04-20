import mongoose from 'mongoose';
import {
  validateString,
  validateNumber,
  validateEnum,
  validateDate,
  validateObject,
  combineValidations,
  createValidationResult
} from './commonValidation.js';

// Constants
const WASTE_CATEGORIES = ['sharps', 'biohazard', 'expired_meds', 'others'];
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_VOLUME_KG = 1000;

// Waste category validation
export const validateWasteCategory = (category) => {
  return validateEnum(category, {
    values: WASTE_CATEGORIES,
    fieldName: 'Waste category',
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
export const validateDate = (date, fieldName = 'Date') => {
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
    validations.push(validateDate(startDate, 'Start date'));
  }

  if (endDate) {
    validations.push(validateDate(endDate, 'End date'));
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

// Validate new waste log entry
export const validateWasteLog = (data) => {
  return validateObject(data, {
    category: {
      required: true,
      validate: validateWasteCategory
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
    }
  }, {
    fieldName: 'Waste log'
  });
};

// Validate waste log update
export const validateWasteLogUpdate = (data) => {
  return validateObject(data, {
    category: {
      required: false,
      validate: validateWasteCategory
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
    }
  }, {
    fieldName: 'Waste log update',
    allowUnknown: false
  });
};

// Export shared validation helpers
export {
  validatePagination,
  validateDateRange,
  validateDate,
  validateId
};
