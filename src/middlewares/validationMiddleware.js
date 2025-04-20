import { ValidationError } from '../utils/errors.js';
import notificationRepository from '../repository/notificationRepository.js';

/**
 * Validates request data against a schema
 * @param {Object} schema - Joi schema for validation
 * @param {Object} options - Additional validation options
 */
export const validateRequest = (schema, options = {}) => {
  return (req, res, next) => {
    try {
      const validationContext = {
        body: req.body,
        query: req.query,
        params: req.params,
        user: req.user,
        files: req.files
      };

      const { error, value } = schema.validate(validationContext, {
        abortEarly: false,
        stripUnknown: true,
        context: {
          isUpdate: req.method === 'PATCH' || req.method === 'PUT',
          user: req.user,
          ...options.context
        },
        ...options
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }));

        throw new ValidationError('Validation failed', errors);
      }

      // Update request with validated and sanitized values
      if (value.body) req.body = value.body;
      if (value.query) req.query = value.query;
      if (value.params) req.params = value.params;
      if (value.files) req.files = value.files;

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Sanitizes request data
 * @param {Object} options - Sanitization options
 */
export const sanitizeRequest = (options = {}) => {
  const {
    trimStrings = true,
    removeNull = true,
    removeUndefined = true,
    convertToBoolean = true,
    convertToNumber = true
  } = options;

  return (req, res, next) => {
    try {
      const sanitizeValue = (value) => {
        if (value === null && removeNull) return undefined;
        if (value === undefined && removeUndefined) return undefined;
        
        if (typeof value === 'string') {
          if (trimStrings) value = value.trim();
          
          if (convertToBoolean && ['true', 'false'].includes(value.toLowerCase())) {
            return value.toLowerCase() === 'true';
          }
          
          if (convertToNumber && !isNaN(value) && value.trim() !== '') {
            const num = Number(value);
            return Number.isInteger(num) ? parseInt(value, 10) : parseFloat(value);
          }
        }
        
        return value;
      };

      const sanitizeObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        const sanitized = Array.isArray(obj) ? [] : {};

        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
          } else {
            const sanitizedValue = sanitizeValue(value);
            if (sanitizedValue !== undefined) {
              sanitized[key] = sanitizedValue;
            }
          }
        }

        return sanitized;
      };

      // Sanitize request data
      if (req.body) req.body = sanitizeObject(req.body);
      if (req.query) req.query = sanitizeObject(req.query);
      if (req.params) req.params = sanitizeObject(req.params);

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Validates pagination parameters
 */
export const validatePagination = () => {
  return (req, res, next) => {
    try {
      const { page, limit, sortBy, sortOrder } = req.query;

      // Validate and convert page
      if (page !== undefined) {
        const pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) {
          throw new ValidationError('Page must be a positive integer');
        }
        req.query.page = pageNum;
      }

      // Validate and convert limit
      if (limit !== undefined) {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
          throw new ValidationError('Limit must be between 1 and 100');
        }
        req.query.limit = limitNum;
      }

      // Validate sort parameters
      if (sortBy && typeof sortBy !== 'string') {
        throw new ValidationError('Invalid sort field');
      }

      if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
        throw new ValidationError('Sort order must be either "asc" or "desc"');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}; 