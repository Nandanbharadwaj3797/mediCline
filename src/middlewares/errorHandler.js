import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  InternalError
} from '../utils/errors.js';

/**
 * Not found handler — catches all unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

      /**
       * Central error-handling middleware
       */
      export const errorHandler = (err, req, res, next) => {
        const isDev = process.env.NODE_ENV === 'development';

        console.error('🔴 Error:', {
          message: err.message,
          stack: isDev ? err.stack : undefined,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
          body: isDev ? req.body : undefined,
          user: req.user?.id
        });

        let statusCode = err.status || 500;
        let message = err.message || 'Internal Server Error';
        let errors = [];

        if (err instanceof ValidationError) {
          statusCode = 400;
          errors = err.errors || [];
        }

        if (err instanceof AuthenticationError) {
          statusCode = 401;
        }

        if (err instanceof NotFoundError) {
          statusCode = 404;
        }

        if (err instanceof InternalError) {
          statusCode = 500;
        }

        // Handle JWT errors
        if (err.name === 'JsonWebTokenError') {
          statusCode = 401;
          message = 'Invalid token';
        }

        if (err.name === 'TokenExpiredError') {
          statusCode = 401;
          message = 'Token expired';
        }

        // Handle Mongoose errors
        if (err.name === 'CastError') {
          statusCode = 400;
          message = 'Invalid ID format';
        }

        if (err.name === 'ValidationError' && err.errors) {
          statusCode = 400;
          message = 'Validation Error';
          errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
          }));
        }

        if (err.code === 11000) {
          statusCode = 409;
          message = 'Duplicate field value';
          const field = Object.keys(err.keyValue || {})[0];
          errors.push({ field, message: 'Already exists' });
        }

        res.status(statusCode).json({
          success: false,
          message,
          errors: errors.length > 0 ? errors : undefined,
          ...(isDev && { stack: err.stack })
        });
      };
