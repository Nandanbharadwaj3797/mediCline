
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}


export class AuthenticationError extends AppError {
  constructor(message) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
  constructor(message) {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Internal server error class
 */
export class InternalError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);
    this.name = 'InternalError';
    if (originalError) {
      this.originalError = originalError;
    }
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export default {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  InternalError,
  ConflictError
};

// Helper function to determine if an error is operational (expected) or programming error
export const isOperationalError = (error) => {
  if (error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof ConflictError) {
    return true;
  }
  return false;
}; 