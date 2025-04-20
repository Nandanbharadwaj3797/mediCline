import {
    ValidationError,
    NotFoundError,
    InternalError
  } from '../utils/errors.js';
  
  /**
   * Handle 404 for undefined routes
   */
  export const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
  };
  
  /**
   * Global error handler
   */
  export const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';
  
    // Log error
    console.error('💥 Error Handler:', {
      message: err.message,
      stack: isDev ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      query: req.query,
      body: isDev ? req.body : undefined,
      user: req.user?.id
    });
  
    // Default values
    let statusCode = err.status || 500;
    let message = err.message || 'Internal Server Error';
    let errors = [];
  
    // Custom error types
    if (err instanceof ValidationError) {
      statusCode = 400;
      errors = err.errors || [];
    } else if (err instanceof NotFoundError) {
      statusCode = 404;
    } else if (err instanceof InternalError) {
      statusCode = 500;
    }
  
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
    }
  
    // Mongoose / Mongo errors
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      if (err.code === 11000) {
        statusCode = 409;
        message = 'Duplicate entry found';
        errors.push({ field: Object.keys(err.keyPattern)[0], type: 'duplicate' });
      } else {
        statusCode = 500;
        message = 'Database error';
      }
    }
  
    if (err.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid ID format';
    }
  
    // Mongoose validation errors (not your custom ValidationError)
    if (err.name === 'ValidationError' && err.errors) {
      statusCode = 400;
      message = 'Validation Error';
      errors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
    }
  
    // Final response
    res.status(statusCode).json({
      success: false,
      message,
      errors: errors.length > 0 ? errors : undefined,
      ...(isDev && { stack: err.stack, raw: err })
    });
  };
  